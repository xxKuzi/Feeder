#include <Servo.h>

// ===== Pin mapping (change as needed) =====
static const int SERVO1_PIN = 9;   // Main stopper near launcher
static const int SERVO2_PIN = 10;  // Feeder stopper in net funnel

static const int SENSOR_1_PIN = A3; // Analog sensor 1
static const int SENSOR_2_PIN = A4; // Analog sensor 2
static const int SENSOR_3_PIN = A5; // Analog sensor 3

// ===== Servo angles =====
static const int SERVO1_STOP_ANGLE = 60;
static const int SERVO1_RELEASE_ANGLE = 140;

static const int SERVO2_STOP_ANGLE = -55;
static const int SERVO2_RELEASE_ANGLE = 110;

// Servo movement speed: higher value = slower movement.
static const int SERVO_STEP_DELAY_MS = 5;

// Servo2 one-shot dispense timing (ms)
static const unsigned long SERVO2_DISPENSE_OPEN_MS = 500; // Reduced from 1000ms to allow a faster cycle!

// Timing configurations for the non-blocking auto ball cycle (ms)
static const unsigned long CYCLE_RELEASE_MS = 1000;       // Time Servo 1 stays open for the ball to roll out (reduced from 1500ms)
static const unsigned long CYCLE_STOP_MS = 200;          // Time to wait for Servo 1 to fully close before dispensing (reduced from 400ms)
static const unsigned long CYCLE_COOLDOWN_MS = 300;      // Cooldown time after the cycle completes (total = 1000 + 200 + 500 + 300 = 2000ms)

// Scoring rule: all analog sensors must be above this value.
static const int ANALOG_TRIGGER_THRESHOLD = 300;

// Sensor test/read frequency: 10x per second.
static const unsigned long SAMPLE_INTERVAL_MS = 100;

// Optional serial monitoring of analog values.
static const bool DEBUG_ANALOG_VALUES = false;

Servo servo1;
Servo servo2;

int servo1CurrentAngle = SERVO1_STOP_ANGLE;
int servo2CurrentAngle = SERVO2_STOP_ANGLE;

int servo1TargetAngle = SERVO1_STOP_ANGLE;
int servo2TargetAngle = SERVO2_STOP_ANGLE;

unsigned long lastServo1StepMs = 0;
unsigned long lastServo2StepMs = 0;

unsigned long scoreCount = 0;
bool scoredInCurrentCrossing = false;
unsigned long lastSampleMs = 0;

int sensor1Value = 0;
int sensor2Value = 0;
int sensor3Value = 0;

// Non-blocking smooth servo updates
void updateServoSmoothNonBlocking() {
  unsigned long now = millis();
  
  // Update Servo 1
  if (servo1CurrentAngle != servo1TargetAngle) {
    if (now - lastServo1StepMs >= SERVO_STEP_DELAY_MS) {
      lastServo1StepMs = now;
      int step = (servo1TargetAngle > servo1CurrentAngle) ? 1 : -1;
      servo1CurrentAngle += step;
      servo1.write(servo1CurrentAngle);
    }
  }
  
  // Update Servo 2
  if (servo2CurrentAngle != servo2TargetAngle) {
    if (now - lastServo2StepMs >= SERVO_STEP_DELAY_MS) {
      lastServo2StepMs = now;
      int step = (servo2TargetAngle > servo2CurrentAngle) ? 1 : -1;
      servo2CurrentAngle += step;
      servo2.write(servo2CurrentAngle);
    }
  }
}

void setServo1Stop() {
  servo1TargetAngle = SERVO1_STOP_ANGLE;
}

void setServo1Release() {
  servo1TargetAngle = SERVO1_RELEASE_ANGLE;
}

void setServo2Stop() {
  servo2TargetAngle = SERVO2_STOP_ANGLE;
}

void setServo2Release() {
  servo2TargetAngle = SERVO2_RELEASE_ANGLE;
}

// Dispense Servo 2 state machine
enum DispenseState {
  DISPENSE_IDLE,
  DISPENSE_OPEN_WAIT,
  DISPENSE_CLOSE_WAIT
};
DispenseState dispenseState = DISPENSE_IDLE;
unsigned long dispenseStartMs = 0;

void startDispense() {
  if (dispenseState == DISPENSE_IDLE) {
    setServo2Release();
    dispenseState = DISPENSE_OPEN_WAIT;
    dispenseStartMs = millis();
  }
}

void updateDispense() {
  if (dispenseState == DISPENSE_IDLE) return;
  
  unsigned long now = millis();
  if (dispenseState == DISPENSE_OPEN_WAIT) {
    if (now - dispenseStartMs >= SERVO2_DISPENSE_OPEN_MS) {
      setServo2Stop();
      dispenseState = DISPENSE_CLOSE_WAIT;
      dispenseStartMs = now;
    }
  } else if (dispenseState == DISPENSE_CLOSE_WAIT) {
    // Give it 300ms to fully sweep back to stop angle before returning to idle
    if (now - dispenseStartMs >= 300) {
      dispenseState = DISPENSE_IDLE;
    }
  }
}

void dispenseServo2ToServo1() {
  startDispense();
}

// Auto ball cycle state machine
enum CycleState {
  CYCLE_IDLE,
  CYCLE_RELEASE_WAIT,
  CYCLE_STOP_WAIT,
  CYCLE_DISPENSE_WAIT,
  CYCLE_COOLDOWN_WAIT
};
CycleState cycleState = CYCLE_IDLE;
unsigned long cycleStartMs = 0;
unsigned long cycleDuration = 0;

void startAutoCycle() {
  if (cycleState == CYCLE_IDLE) {
    setServo1Release();
    cycleState = CYCLE_RELEASE_WAIT;
    cycleStartMs = millis();
    cycleDuration = CYCLE_RELEASE_MS;
  }
}

void updateAutoCycle() {
  if (cycleState == CYCLE_IDLE) return;
  
  unsigned long now = millis();
  if (now - cycleStartMs >= cycleDuration) {
    switch (cycleState) {
      case CYCLE_RELEASE_WAIT:
        setServo1Stop();
        cycleState = CYCLE_STOP_WAIT;
        cycleStartMs = now;
        cycleDuration = CYCLE_STOP_MS;
        break;
        
      case CYCLE_STOP_WAIT:
        // Trigger non-blocking dispense of servo 2
        dispenseServo2ToServo1();
        cycleState = CYCLE_DISPENSE_WAIT;
        cycleStartMs = now;
        // Wait for Servo 2 open duration + close sweep duration (approx 300ms)
        cycleDuration = SERVO2_DISPENSE_OPEN_MS + 300;
        break;
        
      case CYCLE_DISPENSE_WAIT:
        cycleState = CYCLE_COOLDOWN_WAIT;
        cycleStartMs = now;
        cycleDuration = CYCLE_COOLDOWN_MS;
        break;
        
      case CYCLE_COOLDOWN_WAIT:
        cycleState = CYCLE_IDLE;
        break;
        
      default:
        cycleState = CYCLE_IDLE;
        break;
    }
  }
}

void autoBallCycle() {
  startAutoCycle();
}

bool sensorsAllActive() {
  sensor1Value = analogRead(SENSOR_1_PIN);
  sensor2Value = analogRead(SENSOR_2_PIN);
  sensor3Value = analogRead(SENSOR_3_PIN);

  return sensor1Value > ANALOG_TRIGGER_THRESHOLD &&
         sensor2Value > ANALOG_TRIGGER_THRESHOLD &&
         sensor3Value > ANALOG_TRIGGER_THRESHOLD;
}

void processLine(String line) {
  line.trim();
  if (line.length() == 0) {
    return;
  }

  if (line == "PING") {
    Serial.println("PONG");
    return;
  }

  // Backward compatibility with old Rust commands
  if (line == "on") {
    setServo1Stop();
    Serial.println("OK:SERVO1_STOP");
    return;
  }
  if (line == "off") {
    setServo1Release();
    Serial.println("OK:SERVO1_RELEASE");
    return;
  }

  if (line == "SERVO1_STOP") {
    setServo1Stop();
    Serial.println("OK:SERVO1_STOP");
    return;
  }

  if (line == "SERVO1_RELEASE") {
    setServo1Release();
    Serial.println("OK:SERVO1_RELEASE");
    return;
  }

  if (line == "SERVO2_STOP") {
    setServo2Stop();
    Serial.println("OK:SERVO2_STOP");
    return;
  }

  if (line == "SERVO2_RELEASE") {
    setServo2Release();
    Serial.println("OK:SERVO2_RELEASE");
    return;
  }

  if (line == "SERVO2_DISPENSE") {
    dispenseServo2ToServo1();
    Serial.println("OK:SERVO2_DISPENSE");
    return;
  }

  if (line == "AUTO_BALL_CYCLE") {
    autoBallCycle();
    Serial.println("OK:AUTO_BALL_CYCLE");
    return;
  }

  if (line == "RESET_SCORE") {
    scoreCount = 0;
    Serial.println("OK:RESET_SCORE");
    return;
  }

  if (line == "STATE?") {
    Serial.print("STATE:SCORE=");
    Serial.println(scoreCount);
    return;
  }

  Serial.print("ERR:UNKNOWN_CMD:");
  Serial.println(line);
}

void setup() {
  Serial.begin(115200);

  pinMode(SENSOR_1_PIN, INPUT);
  pinMode(SENSOR_2_PIN, INPUT);
  pinMode(SENSOR_3_PIN, INPUT);

  servo1.attach(SERVO1_PIN);
  servo2.attach(SERVO2_PIN);

  // Ensure software and hardware state start synchronized.
  servo1.write(servo1CurrentAngle);
  servo2.write(servo2CurrentAngle);
  delay(100);

  // Safety default: both gates closed/stopping
  servo1TargetAngle = SERVO1_STOP_ANGLE;
  servo2TargetAngle = SERVO2_STOP_ANGLE;
  setServo1Stop();
  setServo2Stop();

  Serial.println("READY");
}

void loop() {
  // Update servo positions incrementally
  updateServoSmoothNonBlocking();
  
  // Update state machines
  updateAutoCycle();
  updateDispense();

  // --- Serial command handling ---
  if (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    processLine(line);
  }

  // --- Scoring logic: all 3 sensors crossed ---
  unsigned long now = millis();
  if (now - lastSampleMs >= SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;

    bool allActive = sensorsAllActive();

    if (DEBUG_ANALOG_VALUES) {
      Serial.print("ANALOG:");
      Serial.print(sensor1Value);
      Serial.print(",");
      Serial.print(sensor2Value);
      Serial.print(",");
      Serial.print(sensor3Value);
      Serial.print(" | allActive=");
      Serial.println(allActive ? "1" : "0");
    }

    if (allActive) {
      if (!scoredInCurrentCrossing) {
        scoredInCurrentCrossing = true;
        scoreCount++;

        Serial.print("SCORE:");
        Serial.println(1); //it sends only 1 plus
      }
    } else {
      // Re-arm detection after sensors drop under threshold.
      scoredInCurrentCrossing = false;
    }
  }
}

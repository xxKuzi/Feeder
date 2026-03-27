#include <Servo.h>

// ===== Pin mapping (change as needed) =====
static const int SERVO1_PIN = 9;   // Main stopper near launcher
static const int SERVO2_PIN = 10;  // Feeder stopper in net funnel

static const int SENSOR_1_PIN = A3; // Analog sensor 1
static const int SENSOR_2_PIN = A4; // Analog sensor 2
static const int SENSOR_3_PIN = A5; // Analog sensor 3

// ===== Servo angles =====
// Adjust after mechanical calibration
static const int SERVO1_STOP_ANGLE = 90;
static const int SERVO1_RELEASE_ANGLE = 0;

static const int SERVO2_STOP_ANGLE = 90;
static const int SERVO2_RELEASE_ANGLE = 0;

// Servo2 one-shot dispense timing (ms)
static const unsigned long SERVO2_DISPENSE_OPEN_MS = 220;

// Scoring rule: all analog sensors must be above this value.
static const int ANALOG_TRIGGER_THRESHOLD = 300;

// Sensor test/read frequency: 10x per second.
static const unsigned long SAMPLE_INTERVAL_MS = 100;

// Optional serial monitoring of analog values.
static const bool DEBUG_ANALOG_VALUES = false;

Servo servo1;
Servo servo2;

unsigned long scoreCount = 0;
bool scoredInCurrentCrossing = false;
unsigned long lastSampleMs = 0;

int sensor1Value = 0;
int sensor2Value = 0;
int sensor3Value = 0;

void setServo1Stop() {
  servo1.write(SERVO1_STOP_ANGLE);
}

void setServo1Release() {
  servo1.write(SERVO1_RELEASE_ANGLE);
}

void setServo2Stop() {
  servo2.write(SERVO2_STOP_ANGLE);
}

void setServo2Release() {
  servo2.write(SERVO2_RELEASE_ANGLE);
}

bool sensorsAllActive() {
  sensor1Value = analogRead(SENSOR_1_PIN);
  sensor2Value = analogRead(SENSOR_2_PIN);
  sensor3Value = analogRead(SENSOR_3_PIN);

  return sensor1Value > ANALOG_TRIGGER_THRESHOLD &&
         sensor2Value > ANALOG_TRIGGER_THRESHOLD &&
         sensor3Value > ANALOG_TRIGGER_THRESHOLD;
}

void dispenseServo2ToServo1() {
  // Open feeder gate briefly so one ball moves to servo1 area, then close again.
  setServo2Release();
  delay(SERVO2_DISPENSE_OPEN_MS);
  setServo2Stop();
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

  // Safety default: both gates closed/stopping
  setServo1Stop();
  setServo2Stop();

  Serial.println("READY");
}

void loop() {
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

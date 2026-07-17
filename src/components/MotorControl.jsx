import { useState, useEffect, useRef } from "react";
import { useData } from "../parts/Memory";

const MOTOR_DEGREES_PER_SECOND = 18;

const getTransitionDurationSeconds = (startValue, endValue) => {
  const angleDelta = Math.abs(Number(endValue) - Number(startValue));
  return Math.max(angleDelta / MOTOR_DEGREES_PER_SECOND, 0.1);
};

export default function MotorControl({
  motorData,
  runningRef,
  newWorkout,
  refresh,
  stopButton,
  setStopButton,
  reset,
  setReset,
  round,
  setRound,
  timer,
  setTimer,
  setNextAngle, //only used for changing values
  changeMotorAngle,
  changeMotorSpeed,
  releaseBall,
  end,
}) {
  const {
    globalAngle,
    setGlobalAngle,
    globalMotorSpeed,
    setGlobalMotorSpeed,
    saveAngle,
    lowSpec,
  } = useData();

  const [angleTransitionDuration, setAngleTransitionDuration] = useState(0);

  const stepIndexRef = useRef(0);
  const roundRef = useRef(0);
  const requestRef = useRef(null);
  const timerRef = useRef(null);
  const targetAngleRef = useRef(null);
  const shotFiredRef = useRef(false);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  //CLEAN UP
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (targetAngleRef.current !== null) {
        setGlobalAngle(targetAngleRef.current);
        saveAngle(targetAngleRef.current);
      }
    };
  }, []);

  //HANDLING RESET
  useEffect(() => {
    if (reset) {
      setRound(0);
      roundRef.current = 0;
      stepIndexRef.current = 0;
      shotFiredRef.current = false;

      setTimer(Math.max(motorData.intervals[0], 0).toFixed(lowSpec ? 0 : 1));

      const angleTransitionSeconds = getTransitionDurationSeconds(
        globalAngle,
        motorData.angles[0],
      );

      if (lowSpec) {
        setGlobalAngle(motorData.angles[0]);
        setGlobalMotorSpeed(motorData.distances[0]);
      } else {
        smoothTransition(
          globalAngle,
          motorData.angles[0],
          angleTransitionSeconds,
          setGlobalAngle,
        );
        smoothTransition(
          globalMotorSpeed,
          motorData.distances[0],
          3,
          setGlobalMotorSpeed,
        );
      }
      changeMotorAngle(
        globalAngle,
        motorData.angles[0],
        angleTransitionSeconds,
      );
      changeMotorSpeed(motorData.distances[0], 3);
    }
  }, [reset, lowSpec]);

  //HANDLING THE CODE RUNS
  useEffect(() => {
    if (runningRef.current) {
      if (newWorkout) {
        startMotor(true);
      } else {
        startMotor(false);
      }
    } else {
      // Pause: only clear the countdown timer interval, let smoothTransition finish its animation.
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [refresh]); //because refresh changes value every time NewWorkout CHANGES

  //FN FOR TRANSITION BETWEEN VALUES
  const smoothTransition = (
    startValue,
    endValue,
    duration,
    updateFunc,
    onComplete,
  ) => {
    const startTime = performance.now();

    const animate = (currentTime) => {
      //during the reset - Do NOT want TIMER to run
      if (reset && updateFunc === setTimer) return;

      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / (duration * 1000), 1);
      const newValue = startValue + progress * (endValue - startValue);

      updateFunc(newValue); //function which updates the value

      // console.log("sets global to: ", newValue);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else if (progress >= 1) {
        setReset(false); //set reset to false
      } else if (onComplete) {
        onComplete();
      }
    };
    requestAnimationFrame(animate);
  };

  //FN RESPONSIBLE FOR SETTING NEW VALUES AND RUNNING EVERYTHING
  const nextStep = (newWorkout = true) => {
    if (!runningRef.current) return;

    const anglesCount = motorData.angles.length;
    if (anglesCount === 0 || motorData.repetition <= 0) {
      runningRef.current = false;
      stopMotor();
      end();
      return;
    }

    // stepIndexRef.current is the global index of timed shots (0, 1, 2, ...)
    const timedShotIndex = stepIndexRef.current;
    const totalTimedShots = motorData.repetition * anglesCount - 1;

    if (timedShotIndex >= totalTimedShots) {
      runningRef.current = false;
      stopMotor();
      end();
      return;
    }

    // Calculate active angle index, target angle index, and round count based on the global timed shot index
    const activeAngleIndex = timedShotIndex % anglesCount;
    const targetAngleIndex = (timedShotIndex + 1) % anglesCount;
    const currentRound = Math.floor((timedShotIndex + 1) / anglesCount);

    // Update round state and ref
    setRound(currentRound);
    roundRef.current = currentRound;

    let actualInterval = motorData.intervals[0];
    // only if custom interval
    if (motorData.intervals.length > 1) {
      actualInterval = motorData.intervals[activeAngleIndex];
    }

    let actualAngle = motorData.angles[activeAngleIndex];
    let actualSpeed = motorData.distances[activeAngleIndex];
    let nextAngle = motorData.angles[targetAngleIndex];
    let nextSpeed = motorData.distances[targetAngleIndex];

    setNextAngle(nextAngle);
    targetAngleRef.current = nextAngle;

    // Capture starting values before updating states
    const startAngleForMotor = newWorkout ? actualAngle : globalAngle;
    const startSpeedForMotor = newWorkout ? actualSpeed : globalMotorSpeed;

    if (lowSpec) {
      // Update immediately on low spec so it is visible earlier
      setGlobalAngle(nextAngle);
      setGlobalMotorSpeed(nextSpeed);
    }

    //setting actual time left - after pause - only remaining time (SAVED IN TIMER) | after reset - NEW TIME
    let timeLeft = newWorkout ? actualInterval : timer;
    setTimer(Math.max(timeLeft, 0).toFixed(lowSpec ? 0 : 1));

    if (newWorkout) {
      shotFiredRef.current = false;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    const delay = lowSpec ? 1000 : 100;
    const step = lowSpec ? 1 : 0.1;

    timerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      timeLeft -= step;
      setTimer(Math.max(timeLeft, 0).toFixed(lowSpec ? 0 : 1));
      if (timeLeft <= 1 && !shotFiredRef.current) {
        releaseBall();
        shotFiredRef.current = true;
        setStopButton(false);
        setTimeout(() => {
          setStopButton(true);
        }, 1000);
      }
      if (timeLeft <= 0) {
        clearInterval(timerRef.current);
        stepIndexRef.current += 1;
        nextStep();
      }
    }, delay);

    setTimeout(
      () => {
        const angleTransitionSeconds = getTransitionDurationSeconds(
          startAngleForMotor,
          nextAngle,
        );

        if (!lowSpec) {
          smoothTransition(
            startAngleForMotor,
            nextAngle,
            angleTransitionSeconds,
            setGlobalAngle,
          );
          smoothTransition(
            startSpeedForMotor,
            nextSpeed,
            timeLeft > 2 ? timeLeft - 1 : 1,
            setGlobalMotorSpeed,
          );
        }
        changeMotorAngle(
          startAngleForMotor,
          nextAngle,
          angleTransitionSeconds,
        );
        changeMotorSpeed(nextSpeed, timeLeft > 2 ? timeLeft - 1 : 1);
      },
      newWorkout ? 1000 : 0,
    );
  };

  const startMotor = (state) => {
    nextStep(state); // Continue from the last state
  };

  const stopMotor = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (targetAngleRef.current !== null) {
      setGlobalAngle(targetAngleRef.current);
      saveAngle(targetAngleRef.current);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-zinc-50 rounded-3xl border border-zinc-200 shadow-xl w-[480px] mt-4 text-zinc-800">
      <h2 className="text-xl font-bold mb-6 text-zinc-400 tracking-wider uppercase">Motor Control Panel</h2>
      
      {/* Large visual representation of the angle */}
      <div className="relative w-96 h-48 border-b border-zinc-200 flex items-end justify-center overflow-hidden mb-8">
        {/* Semi-circle track */}
        <div className="absolute w-96 h-96 rounded-full border border-zinc-200/80 border-b-transparent -bottom-48 pointer-events-none"></div>
        
        {/* Tick labels */}
        <div className="absolute text-xs text-zinc-400 font-bold left-2 bottom-1">0°</div>
        <div className="absolute text-xs text-zinc-400 font-bold left-[25%] top-10 -translate-x-1/2">45°</div>
        <div className="absolute text-xs text-zinc-400 font-bold left-1/2 top-2 -translate-x-1/2">90°</div>
        <div className="absolute text-xs text-zinc-400 font-bold right-[25%] top-10 translate-x-1/2">135°</div>
        <div className="absolute text-xs text-zinc-400 font-bold right-2 bottom-1">180°</div>

        {/* Rotating needle */}
        <div 
          className="absolute w-1.5 h-48 origin-bottom -bottom-0"
          style={{ 
            transform: `rotate(${globalAngle - 90}deg)`,
            transition: lowSpec ? `transform ${angleTransitionDuration}s linear` : "none"
          }}
        >
          <div className="w-full h-full bg-gradient-to-t from-blue-500/10 via-blue-400 to-blue-500 rounded-full relative shadow-[0_0_10px_rgba(59,130,246,0.4)]">
            <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
          </div>
        </div>

        {/* Huge dynamic text displaying the current angle */}
        <div className="absolute bottom-2 text-center z-10">
          <span className="text-8xl font-black font-spaceMono text-blue-600 tracking-tighter drop-shadow-[0_2px_8px_rgba(37,99,235,0.1)]">
            {globalAngle.toFixed(0)}°
          </span>
          <p className="text-[10px] text-zinc-400 font-extrabold tracking-widest uppercase mt-1">ANGLE</p>
        </div>
      </div>

      {/* Numerical info details (Timer/Next Shot removed) */}
      <div className="w-full space-y-4 text-center px-4">
        <p className="text-2xl text-zinc-600">
          <strong>Speed:</strong> <span className="text-emerald-600 font-bold font-spaceMono">{globalMotorSpeed.toFixed(0)} rpm</span>
        </p>
        <p className="text-2xl text-zinc-650">
          <strong>Round:</strong> <span className="text-zinc-800 font-bold font-spaceMono">{round + 1} / {motorData.repetition}</span>
        </p>
      </div>
    </div>
  );
}

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
  } = useData();

  const [angleTransitionDuration, setAngleTransitionDuration] = useState(0);
  const [speedTransitionDuration, setSpeedTransitionDuration] = useState(0);

  const stepIndexRef = useRef(0);
  const roundRef = useRef(0);
  const timerRef = useRef(null);
  const targetAngleRef = useRef(null);
  const shotFiredRef = useRef(false);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  // CLEAN UP
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (targetAngleRef.current !== null) {
        setGlobalAngle(targetAngleRef.current);
        saveAngle(targetAngleRef.current);
      }
    };
  }, []);

  // HANDLING RESET
  useEffect(() => {
    if (reset) {
      setRound(0);
      roundRef.current = 0;
      stepIndexRef.current = 0;
      shotFiredRef.current = false;

      setTimer(Math.max(motorData.intervals[0], 0).toFixed(1));

      const angleTransitionSeconds = getTransitionDurationSeconds(
        globalAngle,
        motorData.angles[0],
      );

      setAngleTransitionDuration(angleTransitionSeconds);
      setSpeedTransitionDuration(3);

      setGlobalAngle(motorData.angles[0]);
      setGlobalMotorSpeed(motorData.distances[0]);

      changeMotorAngle(
        globalAngle,
        motorData.angles[0],
        angleTransitionSeconds,
      );
      changeMotorSpeed(motorData.distances[0], 3);
    }
  }, [reset]);

  // HANDLING THE CODE RUNS
  useEffect(() => {
    if (runningRef.current) {
      if (newWorkout) {
        startMotor(true);
      } else {
        startMotor(false);
      }
    } else {
      // Pause
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [refresh]);

  // FN RESPONSIBLE FOR SETTING NEW VALUES AND RUNNING EVERYTHING
  const nextStep = (newWorkout = true) => {
    if (!runningRef.current) return;

    const anglesCount = motorData.angles.length;
    if (anglesCount === 0 || motorData.repetition <= 0) {
      runningRef.current = false;
      stopMotor();
      end();
      return;
    }

    // ROUND AND INDEX OF CYCLE LOGIC
    let index = stepIndexRef.current;
    let currentRound = roundRef.current;

    if (index >= motorData.angles.length - 1) {
      // new round
      index = 0;
      stepIndexRef.current = 0;

      currentRound += 1;
      roundRef.current = currentRound;
      setRound(currentRound);
    }

    // First shot is fired in CountdownEnd, so this loop runs only totalShots - 1 times.
    const timedShotIndex = currentRound * anglesCount + index;
    const totalTimedShots = motorData.repetition * anglesCount - 1;

    if (timedShotIndex >= totalTimedShots) {
      runningRef.current = false;
      stopMotor();
      end();
      return;
    }

    let actualInterval = motorData.intervals[0];
    // only if custom interval
    if (motorData.intervals.length > 1) {
      actualInterval = motorData.intervals[index];
    }

    let actualAngle = motorData.angles[index];
    let actualSpeed = motorData.distances[index];
    let nextAngle = 0;
    let nextSpeed = 0;

    if (index + 1 !== motorData.angles.length) {
      nextAngle = motorData.angles[index + 1];
      nextSpeed = motorData.distances[index + 1];
    } else {
      nextAngle = motorData.angles[0];
      nextSpeed = motorData.distances[0];
    }

    setNextAngle(nextAngle);
    targetAngleRef.current = nextAngle;

    // setting actual time left - after pause - only remaining time (SAVED IN TIMER) | after reset - NEW TIME
    let timeLeft = newWorkout ? actualInterval : timer;
    setTimer(Math.max(timeLeft, 0).toFixed(1));

    if (newWorkout) {
      shotFiredRef.current = false;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      timeLeft -= 0.1;
      setTimer(Math.max(timeLeft, 0).toFixed(1));
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
    }, 100);

    setTimeout(
      () => {
        const angleTransitionSeconds = getTransitionDurationSeconds(
          newWorkout ? actualAngle : globalAngle,
          nextAngle,
        );
        const speedTransitionSeconds = timeLeft > 2 ? timeLeft - 1 : 1;

        setAngleTransitionDuration(angleTransitionSeconds);
        setSpeedTransitionDuration(speedTransitionSeconds);

        setGlobalAngle(nextAngle);
        setGlobalMotorSpeed(nextSpeed);

        changeMotorAngle(
          newWorkout ? actualAngle : globalAngle,
          nextAngle,
          angleTransitionSeconds,
        );
        changeMotorSpeed(nextSpeed, speedTransitionSeconds);
      },
      newWorkout ? 1000 : 0,
    );
  };

  const startMotor = (state) => {
    nextStep(state); // Continue from the last state
  };

  const stopMotor = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (targetAngleRef.current !== null) {
      setGlobalAngle(targetAngleRef.current);
      saveAngle(targetAngleRef.current);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-6 bg-zinc-950/40 rounded-2xl border border-zinc-800/80 backdrop-blur-md shadow-2xl w-96 mt-4">
      <h2 className="text-xl font-bold mb-6 text-zinc-100 tracking-wide uppercase">Motor Control Panel</h2>
      
      {/* Dial Visual Representation */}
      <div className="relative w-72 h-36 border-b border-zinc-700/50 flex items-end justify-center overflow-hidden mb-6">
        {/* Semi-circle track */}
        <div className="absolute w-72 h-72 rounded-full border border-zinc-800/80 border-b-transparent -bottom-36 pointer-events-none"></div>
        
        {/* Subtle Angle tick marks (0, 45, 90, 135, 180) */}
        <div className="absolute text-[10px] text-zinc-500 font-medium left-2 bottom-1">0°</div>
        <div className="absolute text-[10px] text-zinc-500 font-medium left-[25%] top-6 -translate-x-1/2">45°</div>
        <div className="absolute text-[10px] text-zinc-500 font-medium left-1/2 top-2 -translate-x-1/2">90°</div>
        <div className="absolute text-[10px] text-zinc-500 font-medium right-[25%] top-6 translate-x-1/2">135°</div>
        <div className="absolute text-[10px] text-zinc-500 font-medium right-2 bottom-1">180°</div>

        {/* Rotating needle wrapper */}
        <div 
          className="absolute w-1 h-36 origin-bottom -bottom-0"
          style={{ 
            transform: `rotate(${globalAngle - 90}deg)`, // Rotate relative to center 90deg vertical
            transition: `transform ${angleTransitionDuration}s linear`
          }}
        >
          {/* Needle visual line */}
          <div className="w-full h-full bg-gradient-to-t from-blue-500/20 via-blue-400 to-blue-500 rounded-full relative shadow-[0_0_12px_rgba(59,130,246,0.6)]">
            {/* Glowing tip */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-blue-400 border-2 border-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>
          </div>
        </div>

        {/* Dynamic Target Angle text in center */}
        <div className="absolute bottom-2 text-center z-10">
          <span className="text-3xl font-extrabold font-spaceMono text-blue-400 tracking-tighter drop-shadow-[0_0_10px_rgba(96,165,250,0.2)]">
            {globalAngle.toFixed(0)}°
          </span>
          <p className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase mt-0.5">Target Angle</p>
        </div>
      </div>

      {/* Speed & Stats Info */}
      <div className="w-full space-y-4 text-sm px-2">
        {/* Speed Bar */}
        <div>
          <div className="flex justify-between items-center mb-1 text-xs font-semibold text-zinc-400">
            <span>MOTOR SPEED</span>
            <span className="text-green-400 font-spaceMono">{globalMotorSpeed.toFixed(0)} rpm</span>
          </div>
          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
            <div 
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.3)]"
              style={{
                width: `${Math.min(100, (globalMotorSpeed / 6750) * 100)}%`,
                transition: `width ${speedTransitionDuration}s linear`
              }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60">
          <div className="bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-400 font-bold block tracking-wider uppercase">Next Shot In</span>
            <span className="text-xl font-bold font-spaceMono text-yellow-400">{timer}s</span>
          </div>
          <div className="bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-800/60">
            <span className="text-[10px] text-zinc-400 font-bold block tracking-wider uppercase">Current Round</span>
            <span className="text-xl font-bold font-spaceMono text-zinc-100">{round + 1} <span className="text-zinc-500 text-xs">/ {motorData.repetition}</span></span>
          </div>
        </div>
      </div>
    </div>
  );
}


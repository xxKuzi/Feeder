import { useState, useEffect, useRef } from "react";
import { useData } from "../parts/Memory";

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
  const { globalAngle, setGlobalAngle, globalMotorSpeed, setGlobalMotorSpeed } =
    useData();

  const stepIndexRef = useRef(0);
  const requestRef = useRef(null);
  const timerRef = useRef(null);

  //CLEAN UP
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  //HANDLING RESET
  useEffect(() => {
    if (reset) {
      setRound(0);
      stepIndexRef.current = 0;

      setTimer(Math.max(motorData.intervals[0], 0).toFixed(1));

      smoothTransition(globalAngle, motorData.angles[0], 3, setGlobalAngle);
      changeMotorAngle(globalAngle, motorData.angles[0], 3);
      smoothTransition(
        globalMotorSpeed,
        motorData.distances[0],
        3,
        setGlobalMotorSpeed
      );
      changeMotorSpeed(motorData.distances[0], 3);
    }
  }, [reset]);

  //HANDLING THE CODE RUNS
  useEffect(() => {
    if (runningRef.current) {
      if (newWorkout) {
        startMotor(true);
      } else {
        startMotor(false);
      }
    } else {
      stopMotor();
    }
  }, [refresh]); //because refresh changes value every time NewWorkout CHANGES

  //FN FOR TRANSITION BETWEEN VALUES
  const smoothTransition = (
    startValue,
    endValue,
    duration,
    updateFunc,
    onComplete
  ) => {
    const startTime = performance.now();

    const animate = (currentTime) => {
      //RUN only when it is globally enabled or in reset mode
      if (!runningRef.current && !reset) return;

      //during the reset - Do NOT want TIMER to run
      if (reset && updateFunc === setTimer) return;

      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / (duration * 1000), 1);
      const newValue = startValue + progress * (endValue - startValue);

      updateFunc(newValue); //function which updates the value

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

    //ROUND AND INDEX OF CYCLE LOGIC
    let index = stepIndexRef.current;
    if (index >= motorData.angles.length) {
      //new round
      index = 0;
      stepIndexRef.current = 0;

      setRound((prev) => {
        let newRound = prev + 1;
        if (newRound >= motorData.repetition) {
          runningRef.current = false;
          end();
        }
        return newRound;
      });
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

    //setting actual time left - after pause - only remaining time (SAVED IN TIMER) | after reset - NEW TIME
    let timeLeft = newWorkout ? actualInterval : timer;
    setTimer(Math.max(timeLeft, 0).toFixed(1));

    if (timerRef.current) clearInterval(timerRef.current);
    let shot = false; //for not shotting twice - maybe do not work

    timerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      timeLeft -= 0.1;
      console.log("timeleft ", Math.max(timeLeft.toFixed(1), 0));
      setTimer(Math.max(timeLeft, 0).toFixed(1));
      if (timeLeft <= 1 && !shot) {
        releaseBall();
        shot = true;
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
        smoothTransition(
          newWorkout ? actualAngle : globalAngle,
          nextAngle,
          timeLeft > 2 ? timeLeft - 1 : 1, //one second delay at the beginning of every countdown(before shoot)
          setGlobalAngle
        );
        changeMotorAngle(
          newWorkout ? actualAngle : globalAngle,
          nextAngle,
          timeLeft > 2 ? timeLeft - 1 : 1
        );
        smoothTransition(
          newWorkout ? actualSpeed : globalMotorSpeed,
          nextSpeed,
          timeLeft > 2 ? timeLeft - 1 : 1,
          setGlobalMotorSpeed
        );
        changeMotorSpeed(nextSpeed, timeLeft > 2 ? timeLeft - 1 : 1);
      },
      newWorkout ? 1000 : 0
    );
  };

  const startMotor = (state) => {
    nextStep(state); // Continue from the last state
  };

  const stopMotor = () => {
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-5">
      <div className=" p-6 rounded-lg shadow-lg text-center w-96">
        <h2 className="text-3xl font-bold mb-4">Motor Control Panel</h2>
        <div className="text-lg space-y-2">
          <p>
            <strong>Console Angle:</strong>{" "}
            <span className="text-blue-400">{globalAngle.toFixed(1)}°</span>
          </p>
          <p>
            <strong>Motor Speed:</strong>{" "}
            <span className="text-green-400">
              {globalMotorSpeed.toFixed(1)} rpm
            </span>
          </p>
          <p>
            <strong>Next Shot In:</strong>{" "}
            <span className="text-yellow-400">{timer}s</span>
          </p>
          <p>
            <strong>Round:</strong> {round + 1} / {motorData.repetition}
          </p>
        </div>
        <div className="mt-5 flex space-x-4"></div>
      </div>
    </div>
  );
}

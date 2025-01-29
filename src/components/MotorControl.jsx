import { useState, useEffect, useRef } from "react";
import { useData } from "../parts/Memory";

export default function MotorControl({
  motorData,
  runningRef,
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
}) {
  const { globalAngle, setGlobalAngle, globalMotorSpeed, setGlobalMotorSpeed } =
    useData();

  const stepIndexRef = useRef(0);
  const requestRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (reset) {
      console.log("RESETING");
      setRound(0);
      stepIndexRef.current = 0;
      // setTimer(motorData.intervals[0]);
      nextStep();

      setTimer(motorData.intervals[0]);
      smoothTransition(
        globalMotorSpeed,
        motorData.distances[0],
        3,
        setGlobalMotorSpeed
      );
      smoothTransition(globalAngle, motorData.angles[0], 3, setGlobalAngle);
    }
  }, [reset]);

  useEffect(() => {
    if (runningRef.current) {
      startMotor();
    } else {
      stopMotor();
    }
  }, [refresh]);

  const smoothTransition = (
    startValue,
    endValue,
    duration,
    updateFunc,
    onComplete
  ) => {
    console.log("CONTROL ", startValue, " ", endValue, " ", duration);
    const startTime = performance.now();

    const animate = (currentTime) => {
      console.log("ANIMATING ", updateFunc.name);
      if (!runningRef.current && !reset) {
        console.log("hello1");
        return;
      } // Stop if the motor is stopped, run
      if (reset && updateFunc === setTimer) {
        console.log("hello2");
        return;
      } //during the reset - Do NOT want TIMER to run

      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / (duration * 1000), 1);
      const newValue = startValue + progress * (endValue - startValue);

      updateFunc(newValue);

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else if (progress >= 1) {
        setReset(false);
      } else if (onComplete) {
        onComplete();
      }
    };

    requestAnimationFrame(animate);
  };

  const nextStep = (pause = false) => {
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
        }
        return newRound;
      });
    }
    let actualInterval = motorData.intervals[index];

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

    //setting actual time left

    let timeLeft = pause ? timer : actualInterval;
    setTimer(timeLeft);
    if (timerRef.current) clearInterval(timerRef.current);
    let shot = false;
    timerRef.current = setInterval(() => {
      if (!runningRef.current) return;
      timeLeft -= 0.1;
      setTimer(Math.max(timeLeft.toFixed(1), 0));
      if (timeLeft <= 1 && !shot) {
        console.log("SHOOT");

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
          pause ? globalAngle : actualAngle,
          nextAngle,
          timeLeft > 2 ? timeLeft - 1 : 1,
          setGlobalAngle
        ); // 1s transition
        smoothTransition(
          pause ? globalMotorSpeed : actualSpeed,
          nextSpeed,
          timeLeft > 2 ? timeLeft - 1 : 1,
          setGlobalMotorSpeed
        ); // 1s transition
      },
      pause ? 0 : 1000
    );
  };

  const startMotor = () => {
    nextStep(true); // Continue from the last state
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

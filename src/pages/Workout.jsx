import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";
import { listen } from "@tauri-apps/api/event";
import MotorControl from "../components/MotorControl.jsx";
import Pause from "../components/Pause";
import Countdown from "../components/Countdown";

export default function Workout() {
  const { statistics, shoot, addRecord, updateStatistics, workoutData } =
    useData();
  const [time, setTime] = useState(0);
  const [refresh, setRefresh] = useState(false); //time is running
  const [shootingProgress, setShootingProgress] = useState(0); //shotting success rate (0-1)

  const [intervalCounter, setIntervalCounter] = useState(0); //index of actual interval counter
  const [fullTime, setFullTime] = useState(5); //fulltime
  const [stopButton, setStopButton] = useState(false);
  const [counter, setCounter] = useState(true);
  const [reset, setReset] = useState(false);
  const [timer, setTimer] = useState(workoutData.intervals[0]); //not overall timer just INTERVAL between SHOOTS
  const [round, setRound] = useState(0);
  const [nextAngle, setNextAngle] = useState(0);

  const isRunningRef = useRef();
  const counterRef = useRef(true);
  const counterValueRef = useRef(0);
  const countdownRef = useRef(null);

  const navigate = useNavigate();

  //BLUETOOTH
  useEffect(() => {
    const unlisten = () =>
      listen("pause", () => {
        console.log("Pause command received from the server");
        isRunningRef.current(!isRunningRef.current);
      });

    return () => {
      unlisten();
    };
  }, []);

  useEffect(() => {
    initialization();
  }, []);

  //INITIALIZATION OR RESET
  const initialization = () => {
    setTime(0);
    setReset(true); //changes angle and motorSpeed to first value in array
    countdownRef.current.startCountdown(4); //Shows counter for 4s
    updateStatistics(0, 0); //reset statistics
    setFullTime(
      workoutData.repetition *
        workoutData.intervals.reduce((total, current) => total + current, 0)
    ); //NEED CHANGE  //calculate fullTime

    setTimeout(() => {
      shoot(true);
    }, 4000);
    setTimeout(() => {
      shoot(false);
      console.log("hello");
    }, 5000);
    setTimeout(() => {
      shoot(true);
    }, 6000);
  };

  //UPDATING SUCCESS RATE
  useEffect(() => {
    let success =
      statistics.taken === 0 ? 0 : statistics.made / statistics.taken;
    setShootingProgress(success);
  }, [statistics]);

  useEffect(() => {
    let interval = null;

    //TIME MANAGEMENT
    if (isRunningRef.current) {
      interval = setInterval(() => {
        setTime((prev) => prev + 0.1);
        if (time >= fullTime) {
          End();
        }
      }, 100);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isRunningRef.current]);

  //WHEN COUNTDOWN ENDS
  const CountdownEnd = () => {
    console.log("SHOOT (first shot)");
    setStopButton(true);
    isRunningRef.current = true;
    setRefresh((prev) => !prev); //for refresh in MotorControl
  };

  const formatTime = () => {
    let remainingTime = fullTime - time;
    let minutes = Math.floor((remainingTime % 3600) / 60);
    let seconds = Math.floor(remainingTime % 60);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  };

  return (
    <div className="flex relative flex-col items-center justify-center w-full">
      <Countdown
        ref={(fn) => (countdownRef.current = fn)}
        onCountdownEnd={CountdownEnd}
      />
      <div className="absolute top-8 right-8">
        {" "}
        <Pause
          enabled={stopButton}
          handleClick={() => {
            isRunningRef.current = false;
            setRefresh((prev) => !prev);
          }}
          handleResume={() => {
            isRunningRef.current = true;
            setRefresh((prev) => !prev);
          }}
          handleReset={
            () => {
              initialization();
            } //UPDATE NEEDED RESET MOTOR
          }
          handleExit={() => navigate("/menu")}
        />
      </div>
      <p className="text-4xl font-bold mt-10">{workoutData.name}</p>
      <div className="rounded-xl space-x-32 flex items-center justify-center w-full">
        <div className="mt-2 flex flex-col items-center justify-center gap-4">
          <CirclePB
            radius={90}
            stroke={30}
            color="blue"
            progress={shootingProgress}
          >
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-4xl font-bold">
                {Math.ceil(shootingProgress * 100)}%
              </p>
              <p className="text-2xl">
                {statistics.made}/{statistics.taken}
              </p>
            </div>
          </CirclePB>
          {/* <div className="flex items-center justify-center space-x-4">
            <button
              className="button button__positive"
              onClick={() => shoot(true)}
            >
              Bucket
            </button>
            <button
              className="button button__negative"
              onClick={() => shoot(false)}
            >
              Miss
            </button>
          </div> */}
        </div>
        <div className="flex flex-col items-center justify-center">
          {/* <div className="flex mt-16 px-4 py-3 border-2 rounded-lg flex-col items-center justify-center">
            <p className="text-xl font-bold">INFO</p>

            <p>angles: {workoutData.angles}</p>
            <p>distances: {workoutData.distances}</p>
            <p>repetition: {workoutData.repetition}</p>
            <p>intervals: {workoutData.intervals}</p>
            <img
              className="h-16 w-16 mt-2"
              src={workoutData.image}
              alt="image"
            />
          </div> */}

          <MotorControl
            motorData={workoutData}
            runningRef={isRunningRef}
            refresh={refresh}
            stopButton={stopButton}
            setStopButton={(e) => setStopButton(e)}
            reset={reset}
            setReset={(e) => setReset(e)}
            round={round}
            setRound={setRound}
            timer={timer}
            setTimer={setTimer}
            setNextAngle={setNextAngle}
          />

          <div className="flex items-center justify-center gap-2 mt-16">
            <p>{formatTime()}</p>
            <p>
              next shot: {timer}s | {nextAngle}°
            </p>
          </div>
          <div className="flex flex-col items-center justify-center h-8"></div>
        </div>
      </div>
      <div className="relative w-[1000px] h-2 rounded-md bg-black/10">
        <div
          className="absolute h-2 rounded-md  bg-green-400 duration-500"
          style={{ width: `${((time + 0.3) / fullTime) * 1000}` + "px" }} //not using timeProgress because of delay animation for smoother animations
        ></div>
      </div>
    </div>
  );
}

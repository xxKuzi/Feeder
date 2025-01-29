import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";
import { listen } from "@tauri-apps/api/event";
import MotorControl from "../components/MotorControl.jsx";
import Pause from "../components/Pause";

export default function Workout() {
  const { statistics, shoot, addRecord, updateStatistics, workoutData } =
    useData();
  const [time, setTime] = useState(0);
  const [refresh, setRefresh] = useState(false); //time is running
  const [shootingProgress, setShootingProgress] = useState(0); //shotting success rate (0-1)
  const [intervalTimer, setIntervalTimer] = useState(0); //current interval value
  const [intervalCounter, setIntervalCounter] = useState(0); //index of actual interval counter
  const [fullTime, setFullTime] = useState(5); //fulltime
  const [shottingData, setShottingData] = useState([]);
  const [stopButton, setStopButton] = useState(false);
  const [counter, setCounter] = useState(true);
  const [reset, setReset] = useState(false);
  const [motorSpeed, setMotorSpeed] = useState(workoutData.distances[0]);
  const [timer, setTimer] = useState(workoutData.intervals[0]);
  const [round, setRound] = useState(0);

  const isRunningRef = useRef();
  const counterRef = useRef(true);
  const beginningTimerRef = useRef(null);
  const counterValueRef = useRef(0);

  const navigate = useNavigate();

  useEffect(() => {
    //ready for BLUETOOTH
    const unlisten = () =>
      listen("pause", () => {
        console.log("Pause command received from the server");
        isRunningRef.current(!isRunningRef.current);
      });

    return () => {
      unlisten();
      if (beginningTimerRef.current) {
        clearInterval(beginningTimerRef.current);
      }
    };
  }, []);

  const updateData = (type, value) => {
    setShottingData((prev) => ({ ...prev, [type]: value }));
  };

  const initialization = () => {
    setReset(true);
    counterValueRef.current = 4;
    counterRef.current = true;

    beginningTimerRef.current = setInterval(() => {
      counterValueRef.current -= 0.1;
      setCounter(Math.max(Math.ceil(counterValueRef.current), 0));
      if (counterValueRef.current <= 0) {
        counterRef.current = false;
        clearInterval(beginningTimerRef.current);
        console.log("SHOOT (first shot)");
        isRunningRef.current = true;
        setRefresh((prev) => !prev);
        setStopButton(true);
        setTimeout(() => {
          shoot(true);
        }, 1000);
        setTimeout(() => {
          shoot(false);
          console.log("hello");
        }, 2000);
        setTimeout(() => {
          shoot(true);
        }, 3500);
      }
    }, 100);
  };

  //initialization
  useEffect(() => {
    initialization();
    // isRunningRef.current = true;
    updateStatistics(0, 0);
    setFullTime(
      workoutData.repetition *
        workoutData.intervals.reduce((total, current) => total + current, 0)
    ); //NEED CHANGE
    setIntervalTimer(workoutData.intervals[0]);
  }, []);

  useEffect(() => {
    let success =
      statistics.taken === 0 ? 0 : statistics.made / statistics.taken;
    setShootingProgress(success);
  }, [statistics]);

  useEffect(() => {
    let interval = null;

    if (isRunningRef.current && time < fullTime) {
      interval = setInterval(() => {
        // Update the time
        setTime((prev) => prev + 0.1);

        // Update the interval timer
        setIntervalTimer((prev) => {
          if (prev > 0) {
            return Math.floor((prev - 0.1) * 100) / 100; // Decrease the interval timer
          } else {
            //here
            return workoutData.intervals[intervalCounter];
          }
        });
      }, 100);
      //updateShottingData("");
    } else {
      clearInterval(interval);
    }

    // Cleanup interval on unmount or dependency change
    return () => clearInterval(interval);
  }, [isRunningRef.current, time, fullTime, workoutData]);

  useEffect(() => {
    if (time >= fullTime) {
      End();
    }
  }, [time]);

  const End = async () => {
    await addRecord(statistics.made, statistics.taken);
    navigate("/result");
  };

  const formatTime = () => {
    //let hours = Math.floor(time / 3600);
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
              //reset time, intervals, rounds, smoothAnimation to beginning values (motorSpeed, angle)
              setTime(0);
              setReset(true);
              counterRef.current = true;
              counterValueRef.current = 3;
              setTimeout(() => {
                initialization();
              }, 1000);
            } //UPDATE NEEDED RESET MOTOR
          }
          handleExit={() => navigate("/menu")}
        />
      </div>
      {counterRef.current && (
        <p className="absolute z-40 left-auto top-auto text-[500px] bg-gray-200 ">
          {counter}
        </p>
      )}
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
            motorSpeed={motorSpeed}
            setMotorSpeed={setMotorSpeed}
            round={round}
            setRound={setRound}
            timer={timer}
            setTimer={setTimer}
          />

          <div className="flex items-center justify-center gap-2 mt-16">
            <p>{formatTime()}</p>

            {/* <button
              className="button__small button__negative "
              onClick={() => (
                setTime(fullTime), setIntervalTimer(workoutData.interval[0])
              )}
            >
              END
            </button> */}
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

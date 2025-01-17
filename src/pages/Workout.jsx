import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";
import { listen } from "@tauri-apps/api/event";

export default function Workout() {
  const { statistics, shoot, addRecord, updateStatistics, workoutData } =
    useData();
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [shootingProgress, setShootingProgress] = useState(0);
  const [intervalTimer, setIntervalTimer] = useState(0);
  const [intervalCounter, setIntervalCounter] = useState(0);
  const [fullTime, setFullTime] = useState(5);

  const navigate = useNavigate();

  useEffect(() => {
    // Listen for the "pause" event emitted from the backend
    const unlisten = () =>
      listen("pause", () => {
        console.log("Pause command received from the server");
        setIsActive((prev) => !prev);
      });

    // Cleanup the listener when the component unmounts
    return () => {
      unlisten();
    };
  }, []);

  useEffect(() => {
    console.log("workoutData ", workoutData);
    setIsActive(true);
    updateStatistics(0, 0);
    setFullTime(Number(workoutData.repetition) * 5); //NEED CHANGE
    console.log("SETTING workoutData.intervals[0] ", workoutData.intervals[0]);
    setIntervalTimer(workoutData.intervals[0]);
  }, []);

  useEffect(() => {
    let success =
      statistics.taken === 0 ? 0 : statistics.made / statistics.taken;
    setShootingProgress(success);
  }, [statistics]);

  useEffect(() => {
    let interval = null;

    if (isActive && time < fullTime) {
      interval = setInterval(() => {
        // Update the time
        setTime((prev) => prev + 0.1);

        // Update the interval timer
        setIntervalTimer((prev) => {
          if (prev > 0) {
            return Math.floor((prev - 0.1) * 100) / 100; // Decrease the interval timer
          } else {
            setIntervalCounter((prev) => prev + 1);
            console.log("reset");
            console.log("intervalCounter ", intervalCounter);
            return workoutData.intervals[intervalCounter];
          }
        });
      }, 100);
    } else {
      clearInterval(interval);
    }

    // Cleanup interval on unmount or dependency change
    return () => clearInterval(interval);
  }, [isActive, time, fullTime, workoutData]);

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

    return `${minutes}:${seconds}`;
  };

  return (
    <div className="flex flex-col items-center justify-center">
      {" "}
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
          <div className="flex items-center justify-center space-x-4">
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
          </div>
        </div>
        <div className="flex flex-col items-center justify-center">
          <div className="flex mt-16 px-4 py-3 border-2 rounded-lg flex-col items-center justify-center">
            <p className="text-xl font-bold">INFO</p>
            <p>name: {workoutData.name}</p>

            <p>angles: {workoutData.angles}</p>
            <p>distances: {workoutData.distances}</p>
            <p>repetition: {workoutData.repetition}</p>
            <p>intervals: {workoutData.intervals}</p>
            <img
              className="h-16 w-16 mt-2"
              src={workoutData.image}
              alt="image"
            />
          </div>
          <div className="flex mt-8 px-4 py-2 border-2 rounded-lg flex-col items-center justify-center">
            <p className="text-xl font-bold">MOTOR</p>

            <p>Shoot in {intervalTimer} seconds</p>
            <p>motor speed: </p>
            <p>rotation: </p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-16">
            <p>{formatTime()}</p>
            <button
              className={
                "button__small text-white " +
                (isActive ? "bg-yellow-500" : "bg-green-500")
              }
              onClick={() => setIsActive((prev) => !prev)}
            >
              {isActive ? "Pause" : "Start"}
            </button>

            <button
              className="button__small button__negative"
              onClick={() => {
                setIsActive(false);
                setTime(0);
              }}
            >
              Reset
            </button>
            <button
              className="button__small button__negative "
              onClick={() => (
                setTime(fullTime), setIntervalTimer(workoutData.interval[0])
              )}
            >
              END
            </button>
          </div>
          <div className="flex flex-col items-center justify-center h-8">
            <div className="relative w-64 h-2 rounded-md bg-black/10">
              <div
                className="absolute h-2 rounded-md  bg-green-400 duration-500"
                style={{ width: `${((time + 0.3) / fullTime) * 256}` + "px" }} //not using timeProgress because of delay animation for smoother animations
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

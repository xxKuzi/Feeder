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
    setIsActive(true);
    updateStatistics(0, 0);
    setFullTime(Number(workoutData.time));
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
        setTime((prev) => prev + 0.1);
      }, 100);
    } else {
      clearInterval(interval);
    }

    return () => clearInterval(interval);
  }, [isActive]);

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
    <div>
      <div className="rounded-xl mt-4 flex flex-col items-center justify-center w-screen">
        <p className="font-bold text-2xl">Workout</p>
        <CirclePB
          radius={60}
          stroke={35}
          color="blue"
          progress={shootingProgress}
        >
          <div className="flex flex-col items-center justify-center h-full">
            <p>{Math.floor(shootingProgress * 100)}%</p>
          </div>
        </CirclePB>
        <div className="flex mt-4 p-4 py-2 border-2 rounded-lg flex-col items-center justify-center">
          <p>{workoutData.name}</p>
          <p>{workoutData.motor_speed}</p>
          <p>{workoutData.angles}</p>
          <p>{workoutData.interval}</p>
        </div>
        <div className="flex mt-4 p-4 py-2 border-2 rounded-lg flex-col items-center justify-center">
          <p>made: {statistics.made}</p>
          <p>taken: {statistics.taken}</p>

          <p>
            {(statistics.taken > 0
              ? "success: " +
                Math.round((statistics.made / statistics.taken) * 100)
              : "0") + "%"}
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4">
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
              setTimeProgress(0);
            }}
          >
            Reset
          </button>
          <button
            className="button__small button__negative "
            onClick={() => setTime(fullTime)}
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
      <div className="mt-2 flex items-center justify-center gap-4">
        <button className="button button__positive" onClick={() => shoot(true)}>
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
  );
}

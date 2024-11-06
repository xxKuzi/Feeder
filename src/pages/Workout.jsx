import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";

export default function Workout() {
  const { statistics, shoot, addRecord } = useData();
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [progress, setProgress] = useState(1);

  const fullTime = 3;
  const navigate = useNavigate();

  useEffect(() => {
    setIsActive(true);
    setProgress(0);
  }, []);

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
    if (progress < 1.0) {
      setProgress(time / fullTime);
    }
    if (progress > 1) {
      End();
    }
  }, [time]);

  const End = async () => {
    await addRecord(statistics.made, statistics.taken);
    navigate("/end");
  };

  const formatTime = () => {
    //let hours = Math.floor(time / 3600);
    let remainingTime = fullTime - time;
    let minutes = Math.floor((remainingTime % 3600) / 60);
    let seconds = Math.floor(remainingTime % 60);

    return `${minutes}:${seconds}`;
  };

  return (
    <div className="flex flex-col items-center justify-center w-screen">
      <p className="font-bold text-2xl">Workout</p>

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

      <div className="border-2 rounded-xl h-64 w-64 mt-4"></div>
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
            setProgress(0);
          }}
        >
          Reset
        </button>
      </div>
      <div className="relative">
        <div className="w-64 h-2 rounded-md bg-black/10 mt-4"></div>
        <div
          className="absolute top-0 h-2 rounded-md bg-green-400 duration-500 mt-4"
          style={{ width: `${progress * 256}` + "px" }}
        ></div>
      </div>
      <CirclePB radius={40} color="blue" progress={70} />
    </div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";
import { listen } from "@tauri-apps/api/event";
import MotorControl from "../components/MotorControl.jsx";
import Pause from "../components/Pause";
import Countdown from "../components/Countdown";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export default function Workout() {
  const {
    statistics,
    shoot,
    updateStatistics,
    workoutData,
    globalAngle,
    toggleServo,
    rotateStepperMotor,
  } = useData();
  const [time, setTime] = useState(0); //elapsed Time
  const [fullTime, setFullTime] = useState(5); //Fulltime
  const [shootingProgress, setShootingProgress] = useState(0); //shotting success rate (0-1)
  const [stopButton, setStopButton] = useState(false); //variable indicating whether the STOP button is enabled

  const [refresh, setRefresh] = useState(false);
  const [newWorkout, setNewWorkout] = useState(false); //for motor in children | after Pause - false, after Initialization/Reset - true
  const [reset, setReset] = useState(false); //helps to inform child's component to update
  const [timer, setTimer] = useState(workoutData.intervals[0]); //INTERVAL between SHOOTS
  const [round, setRound] = useState(0); //round of workout
  const [nextAngle, setNextAngle] = useState(0); //mainly for better UX

  const isRunningRef = useRef(); //main variable
  const countdownRef = useRef(null); //ref to INITIAL CountDown
  const pauseCountdownRef = useRef(null); //ref to PAUSE Countdown
  const [isOpen, setIsOpen] = useState(false);

  const navigate = useNavigate(); //used for navigation between pages

  const appWebview = getCurrentWebviewWindow();
  // console.log("appwebview", appWebview);

  appWebview.listen("state-changed", (event) => {
    // localStorage.setItem("console-message", event.payload);
    console.log("payload", event.payload);

    if (event.payload === "on") {
      pauseCountdownRef.current.startCountdown(2);
      setIsOpen(false);
    } else if (event.payload === "off") {
      isRunningRef.current = false;
      setIsOpen(true);
    } else {
      setWorkoutState("bad argument");
    }
  });

  const pauseWorkout = async () => {
    try {
      await invoke("pause_workout");
      console.log("PAUSING");
      // Optionally, update the state immediately.
    } catch (err) {
      console.error("Error pausing workout:", err);
    }
  };

  const startWorkout = async () => {
    try {
      await invoke("start_workout");
      // Optionally, you can update the state immediately.
    } catch (err) {
      console.error("Error starting workout:", err);
    }
  };

  //BLUETOOTH
  useEffect(() => {
    const unlisten = () =>
      listen("pause", () => {
        console.log("Pause command received from the server");
        isRunningRef.current = !isRunningRef.current;
      });

    return () => {
      unlisten();
    };
  }, []);

  useEffect(() => {
    initialization();
  }, []);

  // after delay after resume
  const onPauseResume = () => {
    isRunningRef.current = true;
    startWorkout(); //BLUETOOTH
    setNewWorkout(false);
    setRefresh((prev) => !prev);
  };

  //INITIALIZATION OR RESET
  const initialization = () => {
    setTime(0);
    setReset(true); //changes angle and motorSpeed to first value in array
    countdownRef.current.startCountdown(4); //Shows counter for 4s
    updateStatistics(0, 0); //reset statistics
    startWorkout(); //BLUETOOTH
    setFullTime(
      workoutData.intervals.length > 1
        ? workoutData.repetition *
            workoutData.intervals.reduce((total, current) => total + current, 0)
        : workoutData.repetition *
            workoutData.intervals[0] *
            workoutData.angles.length
    ); //calculate fullTime + ONE second safety

    setTimeout(() => {
      shoot(true);
    }, 4000);
    setTimeout(() => {
      shoot(false);
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

  //TIME MANAGEMENT
  useEffect(() => {
    let interval = null;
    if (isRunningRef.current) {
      interval = setInterval(() => {
        setTime((prev) => prev + 0.1);
      }, 100);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunningRef.current]);

  //At the end
  const end = async () => {
    navigate("/result", {
      state: {
        category: workoutData.category,
        name: workoutData.name,
      },
    });
  };

  //WHEN COUNTDOWN ENDS
  const CountdownEnd = () => {
    releaseBall();
    setStopButton(true);
    startWorkout(); //BLUETOOTH
    isRunningRef.current = true;
    setNewWorkout(true); //for newWorkout in MotorControl
    setRefresh((prev) => !prev);
  };

  const formatTime = () => {
    let remainingTime = fullTime - time;
    let minutes = Math.floor((remainingTime % 3600) / 60);
    let seconds;
    if (remainingTime < 10) {
      seconds = (remainingTime % 60).toFixed(1);
    } else {
      seconds = Math.floor(remainingTime % 60);
    }

    return remainingTime < 10
      ? `${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
          2,
          "0"
        )}`;
  };

  const changeMotorAngle = (starting, ending) => {
    const dif = ending - starting;
    rotateStepperMotor(dif);
  };
  const changeMotorSpeed = (ending) => {
    // console.log("updating Stepper motor speed to: ", ending);
  };

  const releaseBall = () => {
    console.log("A ball was released");
    toggleServo(true);
    setTimeout(() => {
      toggleServo(false);
    }, 1000);
  };

  return (
    <div className="flex relative flex-col items-center justify-center w-full">
      <Countdown
        ref={(fn) => (countdownRef.current = fn)}
        onCountdownEnd={CountdownEnd}
      />
      <Countdown
        ref={(fn) => (pauseCountdownRef.current = fn)}
        onCountdownEnd={onPauseResume}
      />
      <div className="absolute top-8 right-8">
        {" "}
        <Pause
          enabled={stopButton}
          handleClick={() => {
            setIsOpen(true);
            isRunningRef.current = false;
            pauseWorkout(); //BLUETOOTH
          }}
          handleResume={() => {
            setIsOpen(false);
            pauseCountdownRef.current.startCountdown(2);
          }}
          handleReset={() => {
            setIsOpen(false);
            initialization();
          }}
          handleExit={() => {
            setIsOpen(false);
            navigate("/menu");
          }}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      </div>
      <p className="text-4xl font-bold mt-10">{workoutData.name}</p>
      {/* MAIN */}
      <div className="rounded-xl space-x-4 flex items-center justify-center w-full">
        {/* Circle */}
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
        </div>

        {/* Motor Control */}
        <div className="flex flex-col items-center justify-center">
          <MotorControl
            motorData={workoutData}
            runningRef={isRunningRef}
            newWorkout={newWorkout}
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
            changeMotorAngle={changeMotorAngle}
            changeMotorSpeed={changeMotorSpeed}
            releaseBall={releaseBall}
            end={end}
          />
        </div>
      </div>
      {/* Bottom line*/}
      <div className="flex items-center justify-center flex-col">
        <div className="flex items-center justify-between space-x-[24px] font-spaceMono font-normal bg-green-200 rounded-lg px-4 py-2">
          <p className="text-6xl text-end">{timer}s</p>
          <p className="text-6xl font-light">|</p>
          <p className="text-6xl text-start">{nextAngle}°</p>
        </div>
        <div className="flex w-full items-end justify-center flex-col">
          <p className="text-6xl font-spaceMono">{formatTime()}</p>
        </div>

        <div className="relative w-[1000px] h-2 mt-2 rounded-md bg-black/10">
          <div
            className="absolute h-2 rounded-md  bg-green-400 duration-500"
            style={{ width: `${((time + 0.3) / fullTime) * 1000}` + "px" }} //not using timeProgress because of delay animation for smoother animations
          ></div>
        </div>
      </div>
    </div>
  );
}

{
  /* <div className="flex mt-16 px-4 py-3 border-2 rounded-lg flex-col items-center justify-center">
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
          </div> */
}
{
  /* <div className="flex items-center justify-center space-x-4">
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
          </div> */
}

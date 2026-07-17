import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "../parts/Memory";
import CirclePB from "../components/CirclePB";
import { listen } from "@tauri-apps/api/event";
import MotorControl from "../components/MotorControl.jsx";
import Pause from "../components/Pause";
import Countdown from "../components/Countdown";
import { invoke } from "@tauri-apps/api/core";

const WORKOUT_STATE_PAUSE = 0;
const WORKOUT_STATE_RUNNING = 1;
const WORKOUT_STATE_BREAK = 2;
const WORKOUT_STATE_STARTING = 3;
const MOTOR_DEGREES_PER_SECOND = 15;

export default function Workout() {
  const {
    statistics,
    updateStatistics,
    workoutData,
    globalAngle,
    toggleServo,
    toggleFeederServo,
    runAutoBallCycle,
    basketPoints,
    resetBasketPoints,
    rotateStepperMotor,
    motorQueueLength,
    lowSpec,
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
  const [attemptedShots, setAttemptedShots] = useState(0);
  const [waitingForSync, setWaitingForSync] = useState(false); //wait for motor synchronization

  const isRunningRef = useRef(); //main variable
  const countdownRef = useRef(null); //ref to INITIAL CountDown
  const pauseCountdownRef = useRef(null); //ref to PAUSE Countdown
  const [isOpen, setIsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const initializationRef = useRef(true); //to prevent multiple initialization calls in development mode with StrictMode
  const timeRef = useRef(0);
  const fullTimeRef = useRef(5);
  const attemptedShotsRef = useRef(0);
  const madeShotsRef = useRef(0);
  const motorQueueLengthRef = useRef(0);
  const firstShotFiredRef = useRef(false);

  const navigate = useNavigate(); //used for navigation between pages

  useEffect(() => {
    motorQueueLengthRef.current = motorQueueLength;
  }, [motorQueueLength]);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  useEffect(() => {
    fullTimeRef.current = fullTime;
  }, [fullTime]);

  useEffect(() => {
    attemptedShotsRef.current = Math.max(0, Number(attemptedShots) || 0);
  }, [attemptedShots]);

  useEffect(() => {
    madeShotsRef.current = Math.max(
      0,
      Math.min(Number(basketPoints) || 0, attemptedShotsRef.current),
    );
  }, [basketPoints, attemptedShots]);

  const syncWorkoutTimer = async () => {
    const elapsedSeconds = Math.max(0, Number(timeRef.current) || 0);
    const totalSeconds = Math.max(0, Number(fullTimeRef.current) || 0);
    const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
    const attempted = Math.max(0, Number(attemptedShotsRef.current) || 0);
    const made = Math.max(0, Number(madeShotsRef.current) || 0);

    try {
      await invoke("tcp_send_event", {
        event: "workout_timer_sync",
        payload: {
          elapsed_seconds: Number(elapsedSeconds.toFixed(1)),
          total_seconds: Number(totalSeconds.toFixed(1)),
          remaining_seconds: Number(remainingSeconds.toFixed(1)),
          attempted_shots: attempted,
          made_shots: made,
        },
      });
    } catch {
      // Ignore telemetry failures when no remote client is connected.
    }
  };

  useEffect(() => {
    syncWorkoutTimer();

    const timerId = setInterval(() => {
      syncWorkoutTimer();
    }, 3000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    syncWorkoutTimer();
  }, [attemptedShots, basketPoints]);

  const pauseWorkout = async () => {
    try {
      await invoke("pause_workout");

      // Optionally, update the state immediately.
    } catch (err) {
      console.error("Error pausing workout:", err);
    }
  };

  const startWorkout = async () => {
    try {
      // Ensure both servos are closed before starting the workout
      try {
        await toggleFeederServo(false);
        await toggleServo(false);
      } catch (err) {
        console.error("Failed to close servos before start_workout:", err);
      }

      await invoke("start_workout");
      // Optionally, you can update the state immediately.
    } catch (err) {
      console.error("Error starting workout:", err);
    }
  };

  const setStartingWorkout = async () => {
    try {
      await invoke("set_starting_workout");
    } catch (err) {
      console.error("Error setting starting workout state:", err);
    }
  };

  const exitWorkout = async () => {
    try {
      await invoke("exit_workout");

      // Optionally, update the state immediately.
    } catch (err) {
      console.error("Error ending workout:", err);
    }
  };

  const handleStopCountdown = async () => {
    console.log("Stopping workout during initial countdown...");
    countdownRef.current?.stopCountdown();
    await exitWorkout();
    navigate("/menu");
  };

  useEffect(() => {
    initialization();
  }, []);

  useEffect(() => {
    console.log(initializationRef.current);
  }, [initializationRef.current]);

  // Remote event listener for state changes from TCP commands
  useEffect(() => {
    const unlistenStateChanged = listen("state-changed", async (event) => {
      console.log("Remote state-changed event:", event.payload);

      console.log("INCIALIZATION", initializationRef.current);
      if (initializationRef.current) {
        return;
      }
      const code = Number(event.payload);
      console.log("here-1");
      if (code === WORKOUT_STATE_RUNNING || code === WORKOUT_STATE_STARTING) {
        if (isRunningRef.current === false) {
          //RESUME
          setIsOpen(false);
          pauseCountdownRef.current.startCountdown(2);
        }
        // Ensure both servos are closed when workout is running or starting
        try {
          await toggleFeederServo(false);
          await toggleServo(false);
        } catch (err) {
          console.error(
            "Failed to ensure servos closed on RUNNING/STARTING state:",
            err,
          );
        }
        // if (wasPaused) {
        //   setNewWorkout(false);
        //   setRefresh((prev) => !prev);
        // }
      } else if (code === WORKOUT_STATE_PAUSE || code === WORKOUT_STATE_BREAK) {
        // Pause or break

        isRunningRef.current = false;
        setIsOpen(true);
      }
    });

    return () => {
      unlistenStateChanged.then((fn) => fn());
    };
  }, []);

  const initializationRefFunc = useRef(null);
  useEffect(() => {
    initializationRefFunc.current = initialization;
  });

  // remote-reset-workout TCP command listener
  useEffect(() => {
    const unlistenReset = listen("remote-reset-workout", () => {
      console.log("Remote reset command received from TCP");
      initializationRefFunc.current?.();
    });

    return () => {
      unlistenReset.then((fn) => fn());
    };
  }, []);

  //BLUETOOTH
  useEffect(() => {
    const unlistenPause = listen("pause", () => {
      console.log("Pause command received from the server");
      isRunningRef.current = !isRunningRef.current;
    });

    return () => {
      unlistenPause.then((fn) => fn());
    };
  }, []);

  // after delay after resume
  const onPauseResume = () => {
    isRunningRef.current = true;
    startWorkout(); //BLUETOOTH
    setNewWorkout(false);
    setRefresh((prev) => !prev);
  };

  //INITIALIZATION OR RESET
  const initialization = async () => {
    console.log("STARTING INITIALIZATION");
    initializationRef.current = true;
    isRunningRef.current = false;
    firstShotFiredRef.current = false;
    countdownRef.current?.stopCountdown();
    pauseCountdownRef.current?.stopCountdown();
    setIsOpen(false);
    setNewWorkout(false);
    setRefresh((prev) => !prev);
    setTime(0);

    // Wait for the motor queue to clear before moving to the first angle.
    // If the motor is still executing previous moves, we wait until it is finished.
    if (motorQueueLengthRef.current > 0) {
      setWaitingForSync(true);
      await new Promise((resolve) => {
        const checkQueue = setInterval(() => {
          if (motorQueueLengthRef.current === 0) {
            clearInterval(checkQueue);
            resolve();
          }
        }, 100);
      });
      setWaitingForSync(false);
    }

    setReset(true); //changes angle and motorSpeed to first value in array
    const firstShotAngle = Number(workoutData.angles?.[0] ?? globalAngle ?? 90);
    setNextAngle(firstShotAngle);
    const currentAngle = Number(globalAngle ?? 90);
    const requiredStartupSeconds = Math.max(
      4,
      Math.ceil(
        Math.abs(firstShotAngle - currentAngle) / MOTOR_DEGREES_PER_SECOND,
      ),
    );

    countdownRef.current.startCountdown(requiredStartupSeconds); // Wait for the motor to reach the first shot position

    // Load one ball during startup countdown: open servo to release, then close to hold
    setTimeout(async () => {
      try {
        await toggleServo(true); // Open servo 1 to load/release ball
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Hold open for 1s
        await toggleServo(false); // Close servo 1 to hold the ball
      } catch (err) {
        console.error("Failed to load ball during startup:", err);
      }
    }, 1000); // Start ball loading after 1s to let motor start moving

    updateStatistics(0, 0); //reset statistics
    setAttemptedShots(0);
    attemptedShotsRef.current = 0;
    madeShotsRef.current = 0;
    resetBasketPoints();

    // Loader preparation: servo2 open, servo1 closed.
    await toggleFeederServo(false);
    await toggleServo(false);

    await setStartingWorkout(); //BLUETOOTH
    const anglesCount = Math.max(0, workoutData.angles.length);
    const repetitionCount = Math.max(0, workoutData.repetition);

    let nextFullTime = 0;
    if (anglesCount > 0 && repetitionCount > 0) {
      if (workoutData.intervals.length > 1) {
        // First shot is immediate, so the workout uses one interval less overall.
        const sumIntervals = workoutData.intervals.reduce(
          (total, current) => total + current,
          0,
        );
        const lastInterval = workoutData.intervals[anglesCount - 1] ?? 0;
        nextFullTime = repetitionCount * sumIntervals - lastInterval;
      } else {
        const interval = workoutData.intervals[0] ?? 0;
        nextFullTime =
          Math.max(repetitionCount * anglesCount - 1, 0) * interval;
      }
    }

    setFullTime(nextFullTime); //calculate fullTime + ONE second safety
    fullTimeRef.current = nextFullTime;
    syncWorkoutTimer();
  };

  useEffect(() => {
    const made = Math.min(basketPoints, attemptedShots);
    updateStatistics(made, attemptedShots);
  }, [basketPoints, attemptedShots]);

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
      const delay = lowSpec ? 1000 : 100;
      const step = lowSpec ? 1 : 0.1;
      interval = setInterval(() => {
        setTime((prev) => prev + step);
      }, delay);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRunningRef.current, lowSpec]);

  //At the end
  const end = async () => {
    try {
      await invoke("feed_ball_to_servo1");
    } catch (err) {
      console.error("Failed to feed ball to servo1 at workout end:", err);
    }
    setTimeout(async () => {
      await exitWorkout(); //BLUETOOTH
      navigate("/result", {
        state: {
          category: workoutData.category,
          name: workoutData.name,
        },
      });
    }, 5000);
  };

  //WHEN COUNTDOWN ENDS
  const CountdownEnd = async () => {
    // Start sequence: open servo1, close servo2 to hold next balls if not already done.
    if (!firstShotFiredRef.current) {
      await toggleServo(true);
      await toggleFeederServo(true);
      releaseBall();
      firstShotFiredRef.current = true;
    }
    setStopButton(true);
    startWorkout(); //BLUETOOTH
    isRunningRef.current = true;
    setNewWorkout(true); //for newWorkout in MotorControl
    setRefresh((prev) => !prev);
    initializationRef.current = false;
    console.log("INITIALIZATION ENDED");
    console.log("initialization.current", initializationRef.current);
  };

  const formatTime = () => {
    let remainingTime = Math.max(0, fullTime - time);
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
          "0",
        )}`;
  };

  const changeMotorAngle = (starting, ending) => {
    const dif = ending - starting;
    rotateStepperMotor(dif);
  };
  const changeMotorSpeed = (ending) => {
    // console.log("updating Stepper motor speed to: ", ending);
  };

  const releaseBall = async () => {
    console.log("A ball was released");
    setAttemptedShots((prev) => prev + 1);
    console.log("Attempted shots:", attemptedShots + 1);
    await runAutoBallCycle();
  };

  return (
    <div className="flex relative flex-col items-center justify-center w-full">
      {waitingForSync && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
          <div className="flex flex-col items-center justify-center space-y-6 p-8 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-2xl backdrop-blur-md max-w-sm text-center">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute w-16 h-16 border-4 border-zinc-700/50 rounded-full"></div>
              <div className="absolute w-16 h-16 border-4 border-t-green-400 border-r-green-400 border-b-transparent border-l-transparent rounded-full animate-spin"></div>
              <div className="absolute w-8 h-8 bg-green-500/20 rounded-full animate-ping"></div>
            </div>
            <div>
              <p className="text-white text-2xl font-bold uppercase tracking-wider">
                Waiting for synchronization
              </p>
              <p className="text-zinc-400 text-sm mt-2 leading-relaxed">
                Please wait while the motor finishes aligning to its last target position...
              </p>
            </div>
          </div>
        </div>
      )}
      <Countdown
        ref={(fn) => (countdownRef.current = fn)}
        onCountdownEnd={CountdownEnd}
        onStop={handleStopCountdown}
        onTick={async (currentCount) => {
          if (currentCount === 2 && !firstShotFiredRef.current) {
            firstShotFiredRef.current = true;
            await toggleServo(true);
            await toggleFeederServo(true);
            releaseBall();
          }
        }}
        lowSpec={lowSpec}
      />
      <Countdown
        ref={(fn) => (pauseCountdownRef.current = fn)}
        onCountdownEnd={onPauseResume}
        lowSpec={lowSpec}
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
            setStartingWorkout();
            pauseCountdownRef.current.startCountdown(2);
          }}
          handleReset={() => {
            setIsOpen(false);
            initialization();
          }}
          handleExit={() => {
            setIsOpen(false);
            isRunningRef.current = false;
            exitWorkout().finally(() => {
              navigate("/menu");
            });
          }}
          isOpen={isOpen}
          setIsOpen={setIsOpen}
        />
      </div>
      <p className="text-4xl font-bold mt-10">{workoutData.name}</p>
      <p className="text-2xl font-semibold mt-2">Skóre: {basketPoints}</p>
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
          
        </div>
        <div className="flex w-full items-end justify-center flex-col">
          <p className="text-6xl font-spaceMono">{formatTime()}</p>
        </div>

        <div className="relative w-[1000px] h-2 mt-2 rounded-md bg-black/10">
          <div
            className="absolute h-2 rounded-md  bg-green-400 duration-500"
            style={{ width: `${fullTime > 0 ? Math.min(1000, ((time + 0.3) / fullTime) * 1000) : 0}px` }} //not using timeProgress because of delay animation for smoother animations
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

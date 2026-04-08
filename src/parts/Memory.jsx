import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
const DataContext = createContext();
import Modal from "./Modal.jsx";
import Calibration from "./Calibration.jsx";
import { useLocation, useNavigate } from "react-router-dom";
import KeyboardOverlay from "../parts/Keyboard";

export function Memory({ children }) {
  const modalRef = useRef();
  const calibrationRef = useRef();
  const keyboardRef = useRef(null);
  const pendingMotorRequestsRef = useRef(new Map());
  const pendingMotorTimeoutsRef = useRef(new Map());
  const navigate = useNavigate();
  const location = useLocation();
  const [statistics, setStatistics] = useState({ taken: 0, made: 0 });
  const [workoutData, setWorkoutData] = useState({
    intervals: [5],
  });
  const [profile, setProfile] = useState({ userId: 0, name: "XYZ" });
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([{ name: "XYZ" }]);
  const [modes, setModes] = useState([{ name: "XYZ" }]);
  const [globalAngle, setGlobalAngle] = useState(90);
  const [globalMotorSpeed, setGlobalMotorSpeed] = useState(0);
  const [calibrationState, setCalibrationState] = useState("false"); //false, running, end_place, true
  const [lastCalibration, setLastCalibration] = useState("0");
  const [globalServoState, setGlobalServoState] = useState(false);
  const [basketPoints, setBasketPoints] = useState(0);
  const [motorQueueLength, setMotorQueueLength] = useState(0);
  const [developerMode, setDeveloperMode] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [manualMemory, setManualMemory] = useState({
    repetition: 10,
    interval: 5,
    distance: 3700,
    angle: 0, //USED ONLY FOR CHANGING ANGLE (NOT FOR CALIBRATION)
  });
  const modesRef = useRef([]);
  const workoutDataRef = useRef(workoutData);
  //at the beginning IT IS NOT VALID

  useEffect(() => {
    loadCurrentData();
    loadRecords();
    loadUsers();
    loadModes();
    initMotorInstance();
    startArduinoBridge();
  }, []);

  useEffect(() => {
    modesRef.current = modes;
  }, [modes]);

  useEffect(() => {
    workoutDataRef.current = workoutData;
  }, [workoutData]);

  useEffect(() => {
    let unlistenRemoteStart = null;
    let unlistenActiveModeChanged = null;
    let unlistenRemoteExit = null;

    const resolveModeById = (modeId) => {
      if (!modeId) {
        return null;
      }
      return modesRef.current.find((mode) => mode.modeId === modeId) || null;
    };

    const bindRemoteListeners = async () => {
      unlistenActiveModeChanged = await listen(
        "active-mode-changed",
        (event) => {
          console.log("active-mode-changed event received:", event);
          const payload = event.payload || {};
          const modeId = Number(payload.mode_id || payload.modeId || 0);
          const selectedMode = resolveModeById(modeId);
          if (selectedMode) {
            setWorkoutData(selectedMode);
          }
        },
      );

      unlistenRemoteStart = await listen("remote-start-workout", (event) => {
        const payload = event.payload || {};
        const modeId = Number(payload.mode_id || payload.modeId || 0);
        const selectedMode = resolveModeById(modeId);

        if (selectedMode) {
          setWorkoutData(selectedMode);
        } else if (
          !workoutDataRef.current?.name &&
          modesRef.current.length > 0
        ) {
          setWorkoutData(modesRef.current[0]);
        }

        if (location.pathname !== "/workout") {
          navigate("/workout");
        }
      });

      unlistenRemoteExit = await listen("remote-exit-workout", () => {
        navigate("/menu");
      });
    };

    bindRemoteListeners();

    return () => {
      if (unlistenRemoteStart) {
        unlistenRemoteStart();
      }
      if (unlistenActiveModeChanged) {
        unlistenActiveModeChanged();
      }
      if (unlistenRemoteExit) {
        unlistenRemoteExit();
      }
    };
  }, [navigate, location.pathname]);

  const initMotorInstance = async () => {
    try {
      await invoke("init_instance");
    } catch (err) {
      console.error("Error in init instance:", err);
    }
  };

  const startArduinoBridge = async () => {
    try {
      await invoke("start_arduino_bridge");
      const initialScore = await invoke("get_basket_score");
      setBasketPoints(Number(initialScore || 0));
    } catch (err) {
      console.error("Error in Arduino bridge init:", err);
    }
  };

  useEffect(() => {
    let unlistenFn = null;

    const bindScoreListener = async () => {
      unlistenFn = await listen("basket-score-updated", (event) => {
        const payload = event.payload || {};
        if (typeof payload.score === "number") {
          setBasketPoints(payload.score);
        } else {
          setBasketPoints((prev) => prev + 1);
        }
      });
    };

    bindScoreListener();

    return () => {
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, []);

  useEffect(() => {
    let unlistenStarted = null;
    let unlistenCompleted = null;
    let unlistenFailed = null;
    let unlistenQueue = null;

    const clearPendingRequest = (requestId) => {
      const timeoutId = pendingMotorTimeoutsRef.current.get(requestId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      pendingMotorTimeoutsRef.current.delete(requestId);
      pendingMotorRequestsRef.current.delete(requestId);
    };

    const bindMotorListeners = async () => {
      unlistenStarted = await listen("motor_move_started", () => {});

      unlistenCompleted = await listen("motor_move_completed", (event) => {
        const payload = event.payload || {};
        const requestId = Number(payload.requestId || payload.request_id || 0);

        if (
          payload.message ===
            "Aborted: Limit switch already pressed at start." ||
          payload.message?.includes("Stopped early due to limit switch")
        ) {
          setCalibrationState("false");
          openCalibration();
        }

        const resolver = pendingMotorRequestsRef.current.get(requestId);
        if (resolver?.resolve) {
          resolver.resolve(payload);
          clearPendingRequest(requestId);
        }
      });

      unlistenFailed = await listen("motor_move_failed", (event) => {
        const payload = event.payload || {};
        const requestId = Number(payload.requestId || payload.request_id || 0);
        const resolver = pendingMotorRequestsRef.current.get(requestId);
        if (resolver?.reject) {
          resolver.reject(new Error(payload.error || "Motor operation failed"));
          clearPendingRequest(requestId);
        }
      });

      unlistenQueue = await listen("motor_queue_length", (event) => {
        const payload = event.payload || {};
        setMotorQueueLength(Number(payload.queueLength || 0));
      });
    };

    bindMotorListeners();

    return () => {
      if (unlistenStarted) {
        unlistenStarted();
      }
      if (unlistenCompleted) {
        unlistenCompleted();
      }
      if (unlistenFailed) {
        unlistenFailed();
      }
      if (unlistenQueue) {
        unlistenQueue();
      }

      pendingMotorTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      pendingMotorTimeoutsRef.current.clear();
      pendingMotorRequestsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (users[0].name !== "XYZ") {
      const userData = users.find((user) => user.userId === profile.userId);
      updateProfile(userData);
    }
  }, [users]);

  const loadModes = async () => {
    const modesListRust = await invoke("load_modes", {});
    const modesList = modesListRust.map((mode) => ({
      modeId: Number(mode.mode_id),
      name: mode.name,
      image: mode.image,
      category: Number(mode.category),
      predefined: Boolean(mode.predefined),
      repetition: Number(mode.repetition),
      angles: JSON.parse(mode.angles),
      distances: JSON.parse(mode.distances),
      intervals: JSON.parse(mode.intervals),
    }));
    setModes(modesList);
  };

  const loadUsers = async () => {
    try {
      const userListRust = await invoke("load_users", {}); // Call the Rust command expecting an array of users
      const userList = userListRust.map((user) => ({
        userId: user.user_id,
        name: user.name,
        number: user.number,
        createdAt: user.created_at,
      }));

      setUsers(userList); // Assuming setUsers is set up to handle an array of user objects
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadCurrentData = async () => {
    let userDataRust = (await invoke("load_current_data"))[0]; //because it returns an object in an array

    //Load user data
    const userData = {
      userId: userDataRust.user_id,
      name: userDataRust.name,
      number: userDataRust.number,
    };
    if (userData) {
      updateProfile(userData);
    }

    //examines if last calibration is older than 7 days

    const isOld = () => {
      const lastCalibration = new Date(userDataRust.last_calibration);
      const now = Date.now();
      const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
      return now - lastCalibration.getTime() > oneWeekInMs;
    };

    //Calibration only REQUIRED if angle is 666 or if it is older than 7 days
    const needsCalibration = userDataRust.angle === 666 || isOld();
    //ALWAYS TRUE WE DO NOT KNOW IF SOMEONE DID NOT MOVE IT
    if (false) {
      openCalibration();
    } else {
      //NEVER HAPPENS NOW
      // setGlobalAngle(userDataRust.angle);
      // setCalibrationState("true");
      // toggleServo(true);
      // updateLastCalibration(userDataRust.last_calibration);
    }
  };

  const updateLastCalibration = (rawTime) => {
    const date = new Date(rawTime);
    const localTime = date.toLocaleString("cs-CZ", {
      timeZone: "Europe/Prague",
      hour12: false,
    });

    setLastCalibration(localTime);
  };

  const loadRecords = async () => {
    const rustRecords = await invoke("load_records");
    let loadedRecords = convertKeysToCamelCase(rustRecords);
    setRecords(loadedRecords);
  };

  const updateStatistics = (made, taken) => {
    setStatistics({ made: made, taken: taken });
  };

  const updateProfile = (userData) => {
    setProfile(userData);
  };

  const shoot = (success) => {
    success
      ? setStatistics((prev) => ({
          ...prev,
          made: prev.made + 1,
          taken: prev.taken + 1,
        }))
      : setStatistics((prev) => ({ ...prev, taken: prev.taken + 1 }));
  };

  async function addRecord(name, category, made, taken) {
    console.log("addRecord", name, category, made, taken);
    try {
      await invoke("add_record", {
        data: {
          name,
          category,
          made,
          taken,
          user_id: profile.userId,
        },
      });
      console.log("Record added successfully");
    } catch (error) {
      console.error("Failed to add record:", error);
    }
    await loadRecords();
  }

  function convertKeysToCamelCase(arr) {
    const toCamelCase = (str) =>
      str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

    return arr.map((obj) => {
      const newObj = {};
      Object.keys(obj).forEach((key) => {
        const camelKey = toCamelCase(key);
        newObj[camelKey] = obj[key];
      });
      return newObj;
    });
  }

  const createMode = async (data) => {
    console.log("data", data);
    const dataForRust = {
      mode_id: 11, //random - just for not letting it blank - it is not used (for the struct)
      name: data.name,
      image: data.image,
      category: Number(data.category),
      predefined: data.predefined,
      repetition: Number(data.repetition),
      angles: JSON.stringify(data.angles),
      distances: JSON.stringify(data.distances),
      intervals: JSON.stringify(data.intervals),
    };
    console.log("dataForRust", dataForRust);
    try {
      await invoke("add_mode", { data: dataForRust });
    } catch (error) {
      console.error("Failed to add mode:", error);
    }
    modalRef.current.openModal({
      headline: "Mode byl vytvořen",
      question: "Nyní se můžete vrátit do menu",
      buttons: { ok: true },
      okHandle: () => {
        navigate("/menu");
      },
      areaHandle: () => {
        navigate("/menu");
      },
    });
    loadModes();
  };

  const updateMode = async (data) => {
    console.log("data Mode ", data.modeId);
    const dataForRust = {
      mode_id: data.modeId, //important
      name: data.name,
      image: data.image,
      category: Number(data.category),
      predefined: data.predefined,
      repetition: Number(data.repetition),
      angles: JSON.stringify(data.angles),
      distances: JSON.stringify(data.distances),
      intervals: JSON.stringify(data.intervals),
    };
    try {
      await invoke("update_mode", { data: dataForRust });
    } catch (error) {
      console.error("Failed to update mode:", error);
    }
    modalRef.current.openModal({
      headline: "Mode byl upraven",
      question: "Nyní se můžete vrátit do menu",
      buttons: { ok: true },
      okHandle: () => {
        navigate("/menu");
      },
      areaHandle: () => {
        navigate("/menu");
      },
    });
    loadModes();
  };

  const deleteMode = async (modeId) => {
    try {
      await invoke("delete_mode", { modeId: modeId });
    } catch (error) {
      console.error("Failed to delete mode:", error);
    }
    loadModes();
  };

  const openModal = (properties) => {
    console.log("properties ", properties);
    modalRef.current.openModal({
      ...properties,
    });
  };

  const showKeyboard = (e, stateFunction) => {
    //state function is function for setting new useState value (individual for every input)
    keyboardRef.current.showKeyboard(e, stateFunction);
  };

  const slowdownMotor = () => {
    console.log("slowing down");
  };

  const waitForMotorRequest = (requestId, timeoutMs = 120000) => {
    return new Promise((resolve, reject) => {
      if (!requestId) {
        reject(new Error("Invalid motor request id"));
        return;
      }

      pendingMotorRequestsRef.current.set(requestId, { resolve, reject });
      const timeoutId = setTimeout(() => {
        pendingMotorRequestsRef.current.delete(requestId);
        pendingMotorTimeoutsRef.current.delete(requestId);
        reject(new Error("Motor operation timed out"));
      }, timeoutMs);

      pendingMotorTimeoutsRef.current.set(requestId, timeoutId);
    });
  };

  const rotateStepperMotor = async (
    degrees,
    safety = true,
    options = { waitForCompletion: false },
  ) => {
    try {
      const queued = await invoke("rotate_stepper_motor", {
        times: Math.round((6400 / 360) * degrees * 3),
        safety,
      });

      if (!options.waitForCompletion) {
        return queued;
      }

      const requestId = Number(queued?.requestId || queued?.request_id || 0);
      const completed = await waitForMotorRequest(requestId);
      return completed?.message || null;
    } catch (error) {
      console.error("Failed to update stepper motor value:", error);
      return null;
    }
  };

  const calibrate = () => {
    setCalibrationState("running");
    setRefresh(false);
    setTimeout(() => {
      setRefresh(true);
    }, 1000);
  };

  useEffect(() => {
    if (refresh) {
      //set global servo to true
      toggleServo(true);
      setGlobalServoState(true);
      performCalibration();
    }
  }, [refresh]);

  const performCalibration = async () => {
    try {
      const queued = await invoke("calibrate_stepper_motor");
      const requestId = Number(queued?.requestId || queued?.request_id || 0);
      const result = await waitForMotorRequest(requestId);
      const state = result?.message;

      if (
        state === "end_place" ||
        state === "end_place_left" ||
        state === "end_place_right"
      ) {
        setCalibrationState("end_place");
        setTimeout(async () => {
          const centerMoveDegrees = state === "end_place_right" ? -90 : 90;
          const defaultPosition = await rotateStepperMotor(
            centerMoveDegrees,
            false,
            {
              waitForCompletion: true,
            },
          );
          console.log("defaultPosition", defaultPosition);

          if (defaultPosition && !defaultPosition.startsWith("Aborted:")) {
            setCalibrationState("true");
            saveLastCalibration();
          }
          setGlobalAngle(90);
        }, 1000);
      }
    } catch (error) {
      setCalibrationState("false");
      console.error("Failed to calibrate stepper motor:", error);
    }
  };

  const checkLimitSwitch = async () => {
    try {
      await invoke("check_limit_switch");
    } catch (error) {
      console.error("Failed to check limit switch:", error);
    }
  };

  const unlockDeveloperMode = () => {
    openModal({
      buttons: {
        confirm: true,
        cancel: true,
      },

      headline: "Developer mode",
      question: "Pro odemknutí vývojářského modu zadejte heslo",

      input: true,
      numberOfInputs: 1,
      inputData: { password: "" },
      inputPlaceholders: ["password"],
      placeholders: ["Heslo"],
      areaHandle: () => {},
      crossEnabled: false,
      cancelHandle: () => {
        navigate("/");
      },
      confirmHandle: (data) => {
        console.log("data", data);
        if (data.password === "jkl") {
          setDeveloperMode(true);
        } else {
          navigate("/");
        }
      },
    });
  };

  const singOutDeveloperMode = () => {
    setDeveloperMode(false);
    navigate("/");
  };

  const toggleServo = async (newState) => {
    setGlobalServoState(newState);

    try {
      await invoke("move_servo", { angle: newState ? 0 : 180 });
    } catch (error) {
      console.error("Failed to toggle servo:", error);
    }
  };

  const toggleFeederServo = async (stopBall) => {
    try {
      await invoke("move_feeder_servo", { stopBall });
    } catch (error) {
      console.error("Failed to toggle feeder servo:", error);
    }
  };

  const feederDispenseToServo1 = async () => {
    try {
      await invoke("feed_ball_to_servo1");
    } catch (error) {
      console.error("Failed to feed ball from servo2 to servo1:", error);
    }
  };

  const runAutoBallCycle = async () => {
    try {
      // 1) Open servo1 to release the current ball.
      await toggleServo(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 2) Close servo1 so it can receive and hold the next ball.
      await toggleServo(false);
      await new Promise((resolve) => setTimeout(resolve, 120));

      // 3) Open servo2 briefly to move one ball to servo1, then close it.
      await feederDispenseToServo1();
    } catch (error) {
      console.error("Failed to run automatic ball cycle:", error);
    }
  };

  const resetBasketPoints = async () => {
    try {
      await invoke("reset_basket_score");
      setBasketPoints(0);
    } catch (error) {
      console.error("Failed to reset basket points:", error);
    }
  };

  const addBasketPoints = async (delta = 1) => {
    try {
      const updatedScore = await invoke("add_basket_points", { delta });
      setBasketPoints(Number(updatedScore || 0));
      return updatedScore;
    } catch (error) {
      console.error("Failed to add basket points:", error);
      return null;
    }
  };

  const sendArduinoRawCommand = async (command) => {
    try {
      return await invoke("send_arduino_raw_command", { command });
    } catch (error) {
      console.error("Failed to send raw Arduino command:", error);
      return null;
    }
  };

  const saveAngle = async (angle) => {
    try {
      await invoke("save_angle", { angle: angle });
    } catch (error) {
      console.error("Failed to set angle:", error);
    }
  };

  const openCalibration = () => {
    calibrationRef.current.openModal();
  };

  const saveLastCalibration = async () => {
    let date = new Date().toISOString();
    updateLastCalibration(date);
    try {
      await invoke("save_last_calibration", {
        date: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to set last calibration:", error);
    }
    loadCurrentData();
  };

  const contextData = {
    statistics,
    updateStatistics,
    shoot,
    profile,
    updateProfile,
    records,
    addRecord,
    loadRecords,
    users,
    loadUsers,
    modes,
    loadModes,
    createMode,
    deleteMode,
    updateMode,
    workoutData,
    setWorkoutData,
    globalAngle,
    setGlobalAngle,
    globalMotorSpeed,
    setGlobalMotorSpeed,
    openModal,
    showKeyboard,
    slowdownMotor,
    rotateStepperMotor,
    calibrate,
    checkLimitSwitch,
    calibrationState,
    setCalibrationState,
    developerMode,
    unlockDeveloperMode,
    globalServoState,
    toggleServo,
    toggleFeederServo,
    feederDispenseToServo1,
    runAutoBallCycle,
    basketPoints,
    motorQueueLength,
    resetBasketPoints,
    addBasketPoints,
    sendArduinoRawCommand,
    manualMemory,
    setManualMemory,
    singOutDeveloperMode,
    saveAngle,
    openCalibration,
    lastCalibration,
  };

  return (
    <DataContext.Provider value={contextData}>
      <Modal ref={modalRef} />
      <Calibration ref={calibrationRef} />
      <KeyboardOverlay ref={keyboardRef} />

      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  return useContext(DataContext);
};

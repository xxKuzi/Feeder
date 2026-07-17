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

const INITIAL_DEV_PASSWORD = import.meta.env.VITE_DEVELOPER_MODE_PASSWORD;
const INITIAL_IS_LOCKED = import.meta.env.VITE_APP_LOCKED === "true";
const ALWAYS_CALIBRATE = import.meta.env.VITE_ALWAYS_CALIBRATE !== undefined
  ? import.meta.env.VITE_ALWAYS_CALIBRATE === "true"
  : true;

export function Memory({ children }) {
  const modalRef = useRef();
  const calibrationRef = useRef();
  const keyboardRef = useRef(null);
  const pendingMotorRequestsRef = useRef(new Map());
  const pendingMotorTimeoutsRef = useRef(new Map());
  const navigate = useNavigate();
  const location = useLocation();

  const [dynamicDevPassword, setDynamicDevPassword] =
    useState(INITIAL_DEV_PASSWORD);
  const [isAppLocked, setIsAppLocked] = useState(INITIAL_IS_LOCKED);
  const [alwaysCalibrate, setAlwaysCalibrate] = useState(ALWAYS_CALIBRATE);
  const [statistics, setStatistics] = useState({ taken: 0, made: 0 });
  const [workoutData, setWorkoutData] = useState({
    modeId: 0,
    name: "Default",
    angles: [90],
    distances: [3700],
    intervals: [5],
    repetition: 10,
    category: 0,
    image: "",
    predefined: false,
  });
  const [profile, setProfile] = useState({ userId: 0, name: "XYZ" });
  const [records, setRecords] = useState([]);
  const [users, setUsers] = useState([{ name: "XYZ" }]);
  const [modes, setModes] = useState([{ name: "XYZ" }]);
  const [globalAngle, setGlobalAngle] = useState(90);
  const [globalMotorSpeed, setGlobalMotorSpeed] = useState(0);
  const [lowSpec, setLowSpec] = useState(
    import.meta.env.VITE_LOW_SPEC === "true" || import.meta.env.LOW_SPEC === "true"
  );
  const [calibrationState, setCalibrationState] = useState(false); // false (boolean), "running", "end_place", true (boolean)
  const [lastCalibration, setLastCalibration] = useState("0");
  const [globalServoState, setGlobalServoState] = useState(false);
  const [basketPoints, setBasketPoints] = useState(0);
  const [motorQueueLength, setMotorQueueLength] = useState(0);
  const [developerMode, setDeveloperMode] = useState(false);
  const [refresh, setRefresh] = useState(false);
  const [manualMemory, setManualMemory] = useState({
    repetition: 10,
    interval: 5,
    distance: 3700,
    angle: 0, //USED ONLY FOR CHANGING ANGLE (NOT FOR CALIBRATION)
  });
  const modesRef = useRef([]);
  const workoutDataRef = useRef(workoutData);
  const lastSentAngleRef = useRef(null);
  const throttleTimeoutRef = useRef(null);
  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const calibrationStateRef = useRef(calibrationState);
  useEffect(() => {
    calibrationStateRef.current = calibrationState;
  }, [calibrationState]);
  //at the beginning IT IS NOT VALID

  useEffect(() => {
    const init = async () => {
      await loadEnvSettings();
      await loadCurrentData();
      loadRecords();
      loadUsers();
      loadModes();
      initMotorInstance();
      startArduinoBridge();
      saveCalibrationState(false);
    };
    init();
  }, []);

  useEffect(() => {
    saveCalibrationState(calibrationState);
  }, [calibrationState]);

  useEffect(() => {
    if (isAppLocked) {
      calibrationRef.current?.closeModal();
    }
  }, [isAppLocked]);

  useEffect(() => {
    modesRef.current = modes;
  }, [modes]);

  useEffect(() => {
    workoutDataRef.current = workoutData;
  }, [workoutData]);

  const globalAngleRef = useRef(globalAngle);
  useEffect(() => {
    globalAngleRef.current = globalAngle;
  }, [globalAngle]);

  useEffect(() => {
    const angle = Number(globalAngle);
    if (lastSentAngleRef.current === angle) return;

    if (throttleTimeoutRef.current) {
      // Already waiting to send/throttled
      return;
    }

    const send = () => {
      const currentVal = Number(globalAngleRef.current);
      lastSentAngleRef.current = currentVal;
      invoke("tcp_send_event", {
        event: "global_angle_changed",
        payload: { angle: currentVal },
      }).catch(() => {
        // Ignore telemetry failures when TCP clients are disconnected.
      });

      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;
        // If the angle changed again while we were throttled, send the latest one
        if (lastSentAngleRef.current !== Number(globalAngleRef.current)) {
          send();
        }
      }, 200);
    };

    send();
  }, [globalAngle]);

  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
        throttleTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let unlistenRemoteStart = null;
    let unlistenActiveModeChanged = null;
    let unlistenActiveUserChanged = null;
    let unlistenRemoteExit = null;
    let unlistenRemoteManualMove = null;
    let unlistenRemoteStartCalibration = null;

    const resolveModeById = (modeId) => {
      if (modeId === undefined || modeId === null) {
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
          const modeId = Number(payload.mode_id ?? payload.modeId ?? 0);
          const selectedMode = resolveModeById(modeId);
          if (selectedMode) {
            setWorkoutData(selectedMode);
          }
        },
      );

      unlistenActiveUserChanged = await listen(
        "active-user-changed",
        (event) => {
          console.log("active-user-changed event received:", event);
          const payload = event.payload || {};
          const userId = Number(payload.user_id ?? payload.userId ?? 0);
          const selectedUser = usersRef.current.find((u) => u.userId === userId);
          if (selectedUser) {
            updateProfile(selectedUser);
          } else if (payload.name) {
            updateProfile({
              userId,
              name: payload.name,
              number: Number(payload.number ?? 0),
            });
          }

          if (
            calibrationStateRef.current !== "true" &&
            calibrationStateRef.current !== "running" &&
            calibrationStateRef.current !== "end_place"
          ) {
            openCalibration();
          }
        },
      );

      unlistenRemoteStart = await listen("remote-start-workout", (event) => {
        const payload = event.payload || {};
        const remoteModeData = payload.mode_data || payload.modeData || null;

        if (remoteModeData) {
          setWorkoutData({
            modeId: Number(remoteModeData.modeId ?? 0),
            name: String(remoteModeData.name ?? "Pocket Manual Sequence"),
            category: Number(remoteModeData.category ?? 1),
            predefined: Boolean(remoteModeData.predefined ?? false),
            repetition: Number(remoteModeData.repetition ?? 1),
            angles: Array.isArray(remoteModeData.angles)
              ? remoteModeData.angles.map(Number)
              : [90],
            distances: Array.isArray(remoteModeData.distances)
              ? remoteModeData.distances.map(Number)
              : [3700],
            intervals: Array.isArray(remoteModeData.intervals)
              ? remoteModeData.intervals.map(Number)
              : [2],
            image: String(remoteModeData.image ?? ""),
          });

          if (location.pathname !== "/workout") {
            navigate("/workout");
          }
          return;
        }

        const modeId = Number(payload.mode_id ?? payload.modeId ?? 0);
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

      unlistenRemoteManualMove = await listen(
        "remote-manual-move-position",
        (event) => {
          const payload = event.payload || {};
          const targetAngle = Number(payload.target_angle);
          if (Number.isFinite(targetAngle)) {
            setGlobalAngle(Math.max(0, Math.min(180, targetAngle)));
            return;
          }

          const steps = Number(payload.steps || 0);
          if (!Number.isFinite(steps) || steps === 0) {
            return;
          }

          const degreesPerStep = 360 / (6400 * 3);
          setGlobalAngle((previous) => {
            const next = previous + steps * degreesPerStep;
            return Math.max(0, Math.min(180, next));
          });
        },
      );

      unlistenRemoteStartCalibration = await listen(
        "remote-start-calibration",
        () => {
          if (
            calibrationStateRef.current === "running" ||
            calibrationStateRef.current === "end_place"
          ) {
            console.warn(
              "Calibration is already running. Ignoring remote start request."
            );
            return;
          }
          if (location.pathname === "/workout") {
            navigate("/menu");
          }
          openCalibration();
          calibrate();
        },
      );
    };

    bindRemoteListeners();

    return () => {
      if (unlistenRemoteStart) {
        unlistenRemoteStart();
      }
      if (unlistenActiveModeChanged) {
        unlistenActiveModeChanged();
      }
      if (unlistenActiveUserChanged) {
        unlistenActiveUserChanged();
      }
      if (unlistenRemoteExit) {
        unlistenRemoteExit();
      }
      if (unlistenRemoteManualMove) {
        unlistenRemoteManualMove();
      }
      if (unlistenRemoteStartCalibration) {
        unlistenRemoteStartCalibration();
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
          // Exit workout if calibration is triggered during a workout

          //if (location.pathname === "/workout") {
          invoke("exit_workout").catch((error) => {
            // Ignore failures
            console.error(error);
          });
          navigate("/menu");
          //}

          setCalibrationState("false");
          if (!isAppLocked) {
            openCalibration();
          }
        }

        const resolver = pendingMotorRequestsRef.current.get(requestId);
        if (resolver?.resolve) {
          resolver.resolve(payload);
          clearPendingRequest(requestId);
        } else if (
          payload.message === "end_place" ||
          payload.message === "end_place_left" ||
          payload.message === "end_place_right"
        ) {
          // Mobile triggered calibration or direct backend calibration
          setCalibrationState("end_place");
          setTimeout(async () => {
            const centerMoveDegrees = payload.message === "end_place_right" ? -90 : 90;
            const defaultPosition = await rotateStepperMotor(
              centerMoveDegrees,
              false,
              {
                waitForCompletion: true,
              },
            );
            if (defaultPosition && !defaultPosition.startsWith("Aborted:")) {
              setCalibrationState("true");
              saveLastCalibration();
              
              // Automatically close calibration window for remote calibration after 2 seconds
              setTimeout(() => {
                calibrationRef.current?.closeModal();
              }, 2000);
            }
            setGlobalAngle(90);
          }, 1000);
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

    let unlistenLocked, unlistenDevChanged;
    const bindRemoteDevListeners = async () => {
      unlistenLocked = await listen("remote-feeder-locked", (event) => {
        setIsAppLocked(event.payload.locked);
        if (event.payload.locked) {
          navigate("/");
          setDeveloperMode(false);
        }
      });
      unlistenDevChanged = await listen("feeder-dev-password-changed", () => {
        loadEnvSettings();
      });
    };

    bindMotorListeners();
    bindRemoteDevListeners();

    return () => {
      if (unlistenLocked) unlistenLocked();
      if (unlistenDevChanged) unlistenDevChanged();
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
    if (users && users.length > 0 && users[0].name !== "XYZ") {
      const userData = users.find((user) => user.userId === profile?.userId);
      if (userData) updateProfile(userData);
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

  const loadEnvSettings = async () => {
    try {
      const env = await invoke("get_feeder_env");
      if (env) {
        if (env.VITE_DEVELOPER_MODE_PASSWORD) {
          setDynamicDevPassword(env.VITE_DEVELOPER_MODE_PASSWORD);
        }
        if (env.VITE_APP_LOCKED) {
          setIsAppLocked(env.VITE_APP_LOCKED === "true");
        }
        if (env.VITE_ALWAYS_CALIBRATE) {
          setAlwaysCalibrate(env.VITE_ALWAYS_CALIBRATE === "true");
        }
        if (env.VITE_LOW_SPEC || env.LOW_SPEC) {
          setLowSpec(env.VITE_LOW_SPEC === "true" || env.LOW_SPEC === "true");
        }
      }
    } catch (err) {
      console.error("Failed to load env settings:", err);
    }
  };

  const loadCurrentData = async () => {
    const loaded = await invoke("load_current_data");
    const userDataRust =
      Array.isArray(loaded) && loaded.length > 0 ? loaded[0] : null; //because it returns an object in an array

    //Load user data if available
    if (userDataRust) {
      const userData = {
        userId: userDataRust.user_id,
        name: userDataRust.name,
        number: userDataRust.number,
      };
      updateProfile(userData);
    }

    //examines if last calibration is older than 7 days

    const isOld = () => {
      const lastCalibration = new Date(userDataRust.last_calibration);
      const now = Date.now();
      const oneWeekInMs = 7 * 24 * 60 * 60 * 1000;
      return now - lastCalibration.getTime() > oneWeekInMs;
    };

    
    

    
    

    // We only force ALWAYS_CALIBRATE if the session calibration has not run yet
    const forceCalibrate =
      alwaysCalibrate &&
      calibrationState !== "true" &&
      calibrationState !== "running" &&
      calibrationState !== "end_place";

    if (forceCalibrate) {
      setCalibrationState("false");
      saveCalibrationState(false);
      invoke("tcp_send_event", {
        event: "needs_calibration",
        payload: { needsCalibration: true },
      }).catch(() => {});

      // openCalibration is now deferred until after user selection
      if (forceCalibrate && !isAppLocked) {
        // deferred
      }
    } else {
      setCalibrationState("true");
      saveCalibrationState(true);
      invoke("tcp_send_event", {
        event: "needs_calibration",
        payload: { needsCalibration: false },
      }).catch(() => {});
      
      // Restore states if calibrated
      setGlobalAngle(userDataRust.angle);
      toggleServo(true);      
      updateLastCalibration(userDataRust.last_calibration);
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
          user_id: profile?.userId ?? null,
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
    if (
      calibrationStateRef.current === "running" ||
      calibrationStateRef.current === "end_place"
    ) {
      console.warn("Calibration is already running. Ignoring start request.");
      return;
    }
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
        if (dynamicDevPassword && data.password === dynamicDevPassword) {
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

  const toggleServo = async (stopBall) => {
    setGlobalServoState(stopBall);

    try {
      await invoke("move_servo", { stopBall: stopBall });
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
      setGlobalServoState(false);
      await invoke("run_auto_ball_cycle");
    } catch (error) {
      console.error("Failed to run automatic ball cycle:", error);
    } finally {
      setGlobalServoState(true);
    }
  };

  const ReleaseAndLoadNext = async () => {
    try {
      setGlobalServoState(false);
      await invoke("release_ball_and_load_next");
    } catch (error) {
      console.error("Failed to release and load next ball:", error);
    } finally {
      setGlobalServoState(true);
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
      await saveAngle(90);
    } catch (error) {
      console.error("Failed to set last calibration:", error);
    }
    
  };

  const saveCalibrationState = async (state) => {
    console.log("saving calibration state");
    try {
      // The Rust command expects a boolean. Map the possible JS states
      // to a boolean: only explicit true (boolean or string) means calibrated.
      const boolState = state === true || state === "true";
      await invoke("save_calibration_state", {
        state: boolState,
      });
    } catch (error) {
      console.error("Failed to set calibration state: ", error);
    }
  };

  // Initialize servos to closed state on app load
  useEffect(() => {
    const initializeServos = async () => {
      try {
        await toggleServo(true);
        await toggleFeederServo(true);
      } catch (err) {
        console.error("Failed to initialize servos on app load:", err);
      }
    };

    initializeServos();
  }, []);

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
    ReleaseAndLoadNext,
    basketPoints,
    motorQueueLength,
    resetBasketPoints,
    addBasketPoints,
    sendArduinoRawCommand,
    manualMemory,
    setManualMemory,
    singOutDeveloperMode,
    saveCalibrationState,
    saveAngle,
    openCalibration,
    lastCalibration,
    isAppLocked,
    lowSpec,
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

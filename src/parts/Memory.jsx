import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
} from "react";
import { invoke } from "@tauri-apps/api/core";
const DataContext = createContext();
import Modal from "../components/Modal.jsx";
import { useNavigate } from "react-router-dom";
import KeyboardOverlay from "../parts/Keyboard";

export function Memory({ children }) {
  const modalRef = useRef();
  const keyboardRef = useRef(null);
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState({ taken: 0, made: 0 });
  const [workoutData, setWorkoutData] = useState({
    intervals: [5],
  });
  const [profile, setProfile] = useState({ userId: 0, name: "XYZ" });
  const [records, setRecords] = useState([{}]);
  const [users, setUsers] = useState([{ name: "XYZ" }]);
  const [modes, setModes] = useState([{ name: "XYZ" }]);
  const [globalAngle, setGlobalAngle] = useState(0);
  const [globalMotorSpeed, setGlobalMotorSpeed] = useState(0);
  const [calibrationState, setCalibrationState] = useState("false"); //false, running, true
  const [developerMode, setDeveloperMode] = useState(false);
  const [calibration, setCalibration] = useState(false);
  const [manualMemory, setManualMemory] = useState({
    repetition: 10,
    interval: 5,
    distance: 0,
    angle: 90,
  });

  useEffect(() => {
    loadCurrentData();
    loadRecords();
    loadUsers();
    loadModes();
  }, []);

  useEffect(() => {
    console.log("GLOBAL MEMORY ANGLE: CHANGED: ", globalAngle);
  }, [globalAngle]);

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
    const userData = {
      userId: userDataRust.user_id,
      name: userDataRust.name,
      number: userDataRust.number,
    };
    if (userData) {
      updateProfile(userData);
    }
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

  async function addRecord(made, taken) {
    try {
      await invoke("add_record", {
        data: { made, taken, user_id: profile.userId },
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

  const rotateStepperMotor = async (degrees) => {
    try {
      await invoke("rotate_stepper_motor", {
        times: (6400 / 360) * degrees * 3,
      });
    } catch (error) {
      console.error("Failed to update stepper motor value:", error);
    }
  };

  const calibrate = () => {
    setCalibrationState("running");
    setCalibration((prev) => !prev);
  };

  useEffect(() => {
    performCalibration();
  }, [calibration]);

  const performCalibration = async () => {
    try {
      const state = await invoke("calibrate_stepper_motor");
      console.log("state", state);
      if (state === "true") {
        setGlobalAngle(0);
        console.log("successfully calibrated");

        setTimeout(() => {
          setCalibrationState("true");
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

  const toggleServo = async () => {};

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
    toggleServo,
    manualMemory,
    setManualMemory,
  };

  return (
    <DataContext.Provider value={contextData}>
      <Modal ref={modalRef} />
      <KeyboardOverlay ref={keyboardRef}></KeyboardOverlay>

      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  return useContext(DataContext);
};

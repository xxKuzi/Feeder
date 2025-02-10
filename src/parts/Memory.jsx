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

export function Memory({ children }) {
  const modalRef = useRef();
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

  useEffect(() => {
    loadCurrentData();
    loadRecords();
    loadUsers();
    loadModes();
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
      question: "Díky",
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
      console.error("Failed to delete user:", error);
    }
    loadModes();
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
    workoutData,
    setWorkoutData,
    globalAngle,
    setGlobalAngle,
    globalMotorSpeed,
    setGlobalMotorSpeed,
  };

  return (
    <DataContext.Provider value={contextData}>
      <Modal ref={modalRef} />

      {children}
    </DataContext.Provider>
  );
}

export const useData = () => {
  return useContext(DataContext);
};

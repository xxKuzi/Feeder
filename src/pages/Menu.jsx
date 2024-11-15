import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";
import Modal from "../components/Modal.jsx";
import WorkoutKind from "../components/WorkoutKind.jsx";
import { useNavigate } from "react-router-dom";

export default function Menu() {
  const [made, setMade] = useState(0); // State for made
  const [taken, setTaken] = useState(0); // State for taken
  const navigate = useNavigate();

  const { profile, addRecord, updateStatistics } = useData();

  const modalRef = useRef();

  const startWorkout = () => {
    updateStatistics(0, 0);
    navigate("/workout");
  };

  return (
    <div className="flex flex-col items-center justify-center w-screen">
      <p className="headline">Menu</p>
      <button
        onClick={() => {
          navigate("/workout");
        }}
      >
        <button className="button mt-8 button__submit" onClick={startWorkout}>
          Workout
        </button>
      </button>
    </div>
  );
}

// FOR MANUAL ADDING RECORDS
{
  /* 
      <input
        className="input__normal mt-8"
        value={made}
        onChange={(e) => setMade(e.target.value)} // Set made
        placeholder="Made"
        type="number"
      />
      <input
        className="input__normal"
        value={taken}
        onChange={(e) => setTaken(e.target.value)} // Set taken
        placeholder="Taken"
        type="number"
      />
      <button
        className="button bg-purple-400"
        onClick={() => addRecord(Number(made), Number(taken))} // Pass userId as name
      >
        Add Record
      </button> */
}

import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useData } from "../parts/Memory";
import Modal from "../components/Modal.jsx";

export default function Menu() {
  const [made, setMade] = useState(0); // State for made
  const [taken, setTaken] = useState(0); // State for taken

  const { profile, addRecord } = useData();

  const modalRef = useRef();

  return (
    <div className="flex flex-col items-center justify-center w-screen">
      <p className="headline">Menu</p>
      <Link className="button mt-8 button__submit" to="/workout">
        Workout
      </Link>

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
      </button>
      <button
        className="button mt-4 button__positive"
        onClick={() => {
          modalRef.current.openModal({
            button: "Yes, Continue",
            headline: "Confirmation Required",
            question: "Are you absolutely sure you want to proceed?",
            color: "red",
          });
        }}
      >
        Open modal
      </button>
      <Modal ref={modalRef} />
    </div>
  );
}

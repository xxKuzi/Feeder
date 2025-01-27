import React, { useState, useRef } from "react";
import { useData } from "../parts/Memory";
import Modal from "../components/Modal.jsx";
import Modes from "../components/Modes.jsx";
import ModeSettings from "../pages/ModeSettings";
import { useNavigate } from "react-router-dom";

export default function Menu() {
  const navigate = useNavigate();
  const modalRef = useRef();

  const startWorkout = () => {
    navigate("/workout");
  };

  return (
    <div className="flex flex-col py-16 items-center justify-center">
      <Modes />
    </div>
  );
}

import { useState, useRef } from "react";
import {} from "@tauri-apps/api/core";
import "./App.css";
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./parts/Navbar";
import Profiles from "./pages/Profiles";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Workout from "./pages/Workout";
import Statistics from "./pages/Statistics";
import Result from "./pages/Result";
import ModeSettings from "./pages/ModeSettings";
import Testing from "./pages/Testing";

function App() {
  const location = useLocation(); // Get the current route
  return (
    <main className="flex items-center justify-center">
      {/* ADD FIXED CLASS or something like that*/}
      <div
        className={`flex flex-col items-center justify-center w-full ${
          location.pathname !== "/workout" ? "ml-[135px]" : ""
        }`}
      >
        {location.pathname !== "/workout" && <Navbar />}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/result" element={<Result />} />
          <Route path="/mode-settings" element={<ModeSettings />} />
          <Route path="/testing" element={<Testing />} />
        </Routes>
      </div>
    </main>
  );
}

export default App;

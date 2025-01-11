import { useState } from "react";
import {} from "@tauri-apps/api/core";
import "./App.css";
import { Routes, Route } from "react-router-dom";
import Navbar from "./parts/Navbar";
import Profiles from "./pages/Profiles";
import Home from "./pages/Home";
import Menu from "./pages/Menu";
import Workout from "./pages/Workout";
import Statistics from "./pages/Statistics";
import Result from "./pages/Result";
import ModeSettings from "./pages/ModeSettings";

function App() {
  return (
    <main className="flex items-center justify-center">
      <Navbar />
      {/* ADD FIXED CLASS or something like that*/}
      <div className="flex ml-[135px] flex-col items-center justify-center">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/result" element={<Result />} />
          <Route path="/mode-settings" element={<ModeSettings />} />
        </Routes>
      </div>
    </main>
  );
}

export default App;

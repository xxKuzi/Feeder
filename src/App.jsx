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

function App() {
  return (
    <main className="flex items-center justify-between">
      <Navbar className="" /> {/* ADD FIXED CLASS or something like that*/}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/result" element={<Result />} />
      </Routes>
    </main>
  );
}

export default App;

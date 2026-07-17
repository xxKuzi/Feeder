import { useState, useRef, useContext, useEffect } from "react";
import {} from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
import Manual from "./pages/Manual";
import { useData } from "./parts/Memory";

function App() {
  const location = useLocation(); // Get the current route
  const { isAppLocked } = useData();
  const [sessionUserSelected, setSessionUserSelected] = useState(false);

  useEffect(() => {
    let unlisten = null;
    const bindListener = async () => {
      unlisten = await listen("active-user-changed", () => {
        setSessionUserSelected(true);
      });
    };
    bindListener();
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  if (isAppLocked) {
    return (
      <main className="flex h-screen w-screen items-center justify-center bg-gray-900 text-white">
        <div className="text-center p-8 border border-gray-700 rounded-2xl bg-gray-800 shadow-2xl">
          <svg className="w-20 h-20 mx-auto text-blue-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
          </svg>
          <h1 className="text-3xl font-bold mb-2">System Locked</h1>
          <p className="text-gray-400">Please unlock via the remote control app.</p>
        </div>
      </main>
    );
  }

  if (!sessionUserSelected) {
    return (
      <main className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 justify-center items-center">
        <Profiles isStartup={true} onSelect={() => setSessionUserSelected(true)} />
      </main>
    );
  }

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      {location.pathname !== "/workout" && <Navbar />}
      <div
        className={`flex h-full min-h-0 w-full flex-col overflow-y-auto ${
          location.pathname !== "/workout" ? "pl-[135px]" : ""
        }`}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/statistics" element={<Statistics />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/result" element={<Result />} />
          <Route path="/mode-settings" element={<ModeSettings />} />
          <Route path="/manual" element={<Manual />} />
          <Route path="/testing" element={<Testing />} />
        </Routes>
      </div>
    </main>
  );
}

export default App;

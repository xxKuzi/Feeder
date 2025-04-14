import React, { useState } from "react";
import Section from "../components/Section";
import { FaPowerOff } from "react-icons/fa6";
import { invoke } from "@tauri-apps/api/core";
import CalibrationMenu from "@/components/CalibrationMenu";
import { useData } from "../parts/Memory";

export default function Home() {
  const { globalAngle, saveAngle } = useData();
  const [shutdown, setShutdown] = useState(false);
  return (
    <div className="relative flex flex-col items-center h-screen justify-center">
      <button
        onClick={() => {
          setShutdown(true);
          saveAngle(globalAngle);
          setTimeout(() => {
            invoke("exit_app");
          }, 1000);
        }}
        className="absolute right-4 top-4"
      >
        <div className="flex mt-6 justify-center items-center">
          <p
            className={`mr-2 text-xl ${
              shutdown ? "w-0 h-0 text-transparent" : ""
            }`}
          >
            Vypnout
          </p>{" "}
          <FaPowerOff
            size={20}
            className={`duration-1000 ${
              shutdown ? "w-16 h-16 text-red-600" : ""
            }`}
          />
        </div>
      </button>
      <p className="headline">Home</p>

      <div className="flex items-center justify-center gap-16">
        <Section
          data={{
            name: "Statistiky",
            img: "statistics.jpg",
            link: "/statistics",
          }}
        />
        <Section
          data={{ name: "Menu", img: "basketball.jpg", link: "/menu" }}
        />
        <Section
          data={{
            name: "Manulní ovládání",
            img: "clock.jpg",
            link: "/manual",
            color: "white",
          }}
        />
      </div>
    </div>
  );
}

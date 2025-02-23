import React from "react";
import Section from "../components/Section";
import { FaPowerOff } from "react-icons/fa6";
import { invoke } from "@tauri-apps/api/core";

export default function Home() {
  return (
    <div className="flex flex-col items-center h-screen justify-center">
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
            name: "Naposledy použito",
            img: "clock.jpg",
            link: "/menu",
            color: "white",
          }}
        />
      </div>
      <button
        onClick={() => {
          invoke("exit_app");
        }}
      >
        <div className="flex mt-6 justify-center items-center">
          <p className="mr-2 text-xl">Vypnout</p> <FaPowerOff size={20} />
        </div>
      </button>
    </div>
  );
}

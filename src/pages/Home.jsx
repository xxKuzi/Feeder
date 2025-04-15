import React, { useState } from "react";
import Section from "../components/Section";
import { FaPowerOff } from "react-icons/fa6";
import { invoke } from "@tauri-apps/api/core";
import CalibrationMenu from "@/components/CalibrationMenu";
import { useData } from "../parts/Memory";
import HomeSuccessBox from "@/components/HomeSuccessBox";

export default function Home() {
  const { globalAngle, saveAngle, records, profile } = useData();
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
      <div className="bg-gray-200 h-[2px] w-[900px] mt-12"></div>
      <div className="flex items-center justify-center gap-16 mt-12">
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center flex-col justify-center border-2 h-[84px] hover:border-gray-300 duration-300 border-sky-400 px-4 py-2 rounded-lg">
              <p className="">Aktuálně přihlášený uživatel:</p>
              <p className="text-3xl">
                {profile.name} #{profile.number}
              </p>
            </div>
            <div className="flex items-center flex-col hover:border-gray-300 justify-center border-2 duration-300 border-sky-400 px-4 py-2 rounded-lg">
              <p>Pozice krokového motoru</p>
              <p className="text-4xl ml-3">{globalAngle}°</p>
            </div>
          </div>
          <CalibrationMenu />
        </div>
        <HomeSuccessBox headline={"7 dní"} records={records} days={7} />
      </div>
    </div>
  );
}

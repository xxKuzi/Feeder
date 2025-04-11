import React from "react";
import Section from "../components/Section";
import { FaPowerOff } from "react-icons/fa6";

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

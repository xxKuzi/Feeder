import React from "react";
import Section from "../components/Section";
import KeyboardSite from "@/parts/Keyboard";
import MotorTest from "../components/MotorTest.jsx";

export default function Home() {
  return (
    <div className="flex flex-col  items-center justify-center">
      <p className="headline">Home</p>
      <KeyboardSite />
      <MotorTest />
      <div className="flex items-center justify-center gap-16">
        <p>Hello</p>

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
    </div>
  );
}

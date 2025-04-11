import React, { useEffect, useState, useRef } from "react";
import { useData } from "../parts/Memory";
import { useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { RxCross2 } from "react-icons/rx";
import { IoOptions } from "react-icons/io5";

export default function Modes() {
  const {
    modes,
    setWorkoutData,
    loadModes,
    openModal,
    calibrate,
    calibrationState,
  } = useData();
  const [categories, setCategories] = useState([0, 1]);
  const navigate = useNavigate();
  const modalRef = useRef();

  useEffect(() => {
    findAllCategories();
  }, [modes]);

  useEffect(() => {
    console.log(calibrationState);
  }, [calibrationState]);

  const startWorkout = (data) => {
    setWorkoutData(data);
    navigate("/workout");
  };

  const findAllCategories = () => {
    let tempCategories = [];
    modes.forEach((mode) => {
      if (!tempCategories.includes(mode.category)) {
        tempCategories.push(mode.category);
      }
    });
    setCategories(tempCategories);
  };

  const deleteMode = async (modeId) => {
    try {
      await invoke("delete_mode", { modeId: modeId });
    } catch (error) {
      console.error("Failed to delete user:", error);
    }
    loadModes();
  };

  const createMode = async (data) => {
    const bool = (() => {
      switch (data.predefined) {
        case "1":
        case "true":
          return true; // Return true for "1" or "true"
        default:
          return false; // Return false for other values
      }
    })();

    const dataForRust = {
      mode_id: 11, //random - just for not letting it blank - it is not used
      name: data.name,
      image: data.image,
      category: Number(data.category),
      predefined: bool,
      repetition: Number(data.repetition),
      angles: JSON.stringify(data.angles),
      distances: JSON.stringify(data.distances),
      intervals: JSON.stringify(data.intervals),
    };
    console.log("dataForRust", dataForRust);
    try {
      await invoke("add_mode", { data: dataForRust });
    } catch (error) {
      console.error("Failed to add mode:", error);
    }

    loadModes();
  };

  const Category = ({ headline, category }) => {
    //category -  index of that category
    const elements = modes
      .filter((mode) => mode.category === category) // Filter relevant modes
      .map((mode) => {
        return (
          <WorkoutKind key={mode.modeId} data={mode} /> // Ensure each element has a unique key
        );
      });

    return (
      <div className="flex bg-gray-100 flex-col mt-8 items-start justify-center border-2 border-blue-300 w-[75vw] rounded-lg px-6 py-4">
        <p className="text-3xl font-semibold">{headline}</p>
        <div className="mt-4 gap-6 flex justify-left items-left flex-wrap w-full">
          {elements}
        </div>
      </div>
    );
  };

  const WorkoutKind = ({ data }) => {
    const {
      modeId,
      name,
      image,
      category,
      predefined,
      repetition,
      intervals,
      angles,
      distances,
    } = data;

    const calculateOverallTime = () => {
      let time = 0;
      if (intervals.length === 1) {
        time = repetition * intervals[0] * angles.length;
      } else if (intervals.length > 1) {
        time = repetition * intervals.reduce((acc, num) => acc + num, 0);
      }
      return time;
    };
    return (
      <div className="flex flex-col bg-white items-center relative justify-center border-2 rounded-lg wx-[30%] px-8 py-4">
        <p className="text-3xl">
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </p>
        {/* <img src={image} /> */}
        <div className="mt-4">
          <p>Délka cvičení: {calculateOverallTime()}s</p>
          <p>
            Interval střelby:{" "}
            {intervals.length === 1
              ? intervals[0]
              : intervals.map((interval) => interval + "s, ")}
            s
          </p>
          <p>Úhly střelby: {angles.map((angle) => angle + "° ")}</p>
          <p>
            Délka výstřelu:{" "}
            {distances.map((distance) => distance / 1000 + "m, ")}
          </p>

          <p>Počet kol: {repetition}x</p>
        </div>
        <button
          className="button mt-4 button__positive"
          onClick={() => startWorkout(data)}
        >
          Hrát
        </button>
        <div className="flex items-center justify-center absolute top-0 right-0">
          <button
            className={`flex w-[30px] h-[30px] items-center justify-center ${
              data.predefined === true ? "mr-1" : "" //for design
            }`}
            onClick={() =>
              //go to page mode settings
              navigate("/mode-settings", { state: { data: data } })
            }
          >
            <IoOptions size={25} className="" />
          </button>
          {data.predefined === false && (
            <button
              className="flex items-center justify-center"
              onClick={() =>
                openModal({
                  headline: "Odstranění módu",
                  question: "Opravdu chcete tento mode odstranit?",
                  buttons: { confirm: true, cancel: true },
                  confirmHandle: () => {
                    deleteMode(data.modeId);
                  },
                })
              }
            >
              <RxCross2 size={30} className="text-red-600" />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <div className="w-full flex justify-center relative">
        <p className="headline">Menu</p>
        <div className="flex items-center justify-center absolute right-0">
          <button
            onClick={() => calibrate()}
            className={`button mr-4 text-white duration-300 ${
              calibrationState === "true"
                ? "bg-blue-500"
                : calibrationState === "end_place"
                ? "bg-yellow-300"
                : calibrationState === "running"
                ? "bg-green-400"
                : "bg-black"
            }`}
          >
            {calibrationState === "true"
              ? "Kalibrováno✅"
              : calibrationState === "end_place"
              ? "Konec nalezen"
              : calibrationState === "running"
              ? "Kalibrování➡️"
              : "Vyžaduje kalibraci❗"}
          </button>
          <Link to="/mode-settings">
            <button className="button button__positive">Přidat mode</button>
          </Link>
        </div>
      </div>

      {/* <Category headline={"Unordered"} category={0} /> */}
      {/* Category 4 - Manual */}
      <Category headline={"Střely za 2 body"} category={1} />
      <Category headline={"Střely za 3 body"} category={2} />
      <Category headline={"Trestné hody"} category={3} />
    </div>
  );
}

import React, { useEffect, useState, useRef } from "react";
import { useData } from "../parts/Memory";
import { useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { RxCross2 } from "react-icons/rx";

export default function Modes() {
  const { modes, setWorkoutData, loadModes, openModal } = useData();
  const [categories, setCategories] = useState([0, 1]);
  const navigate = useNavigate();
  const modalRef = useRef();

  useEffect(() => {
    findAllCategories();
  }, [modes]);

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
    return (
      <div className="flex flex-col bg-white items-center relative justify-center border-2 rounded-lg w-[30%] px-6 py-4">
        <p className="text-3xl">
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </p>
        {/* <img src={image} /> */}
        <div className="mt-4">
          <p>
            délka cvičení:{" "}
            {repetition * intervals.reduce((acc, num) => acc + num, 0)}s
          </p>
          <p>úhly střelby: {angles.map((angle) => angle + "° ")}</p>
          <p>
            délka výstřelu:{" "}
            {distances.map((distance) => distance / 1000 + "m, ")}
          </p>
          <p>
            interval střelby{" "}
            {intervals.length === 1
              ? intervals[0]
              : intervals.map((interval) => interval + "s, ")}
          </p>
          <p>počet kol: {repetition}x</p>
        </div>
        <button
          className="button mt-4 button__positive"
          onClick={() => startWorkout(data)}
        >
          Hrát
        </button>
        {data.predefined === false && (
          <button
            className="flex items-center justify-center absolute top-0 right-0"
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
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <div className="w-full flex justify-between">
        <div className="w-[136px]" />
        <p className="headline">Menu</p>
        <Link to="/mode-settings">
          <button className="button button__positive">Přidat mode</button>
        </Link>
      </div>

      {/* <Category headline={"Unordered"} category={0} /> */}
      <Category headline={"Střely za 2 body"} category={1} />
      <Category headline={"Střely za 3 body"} category={2} />
      <Category headline={"Trestné hody"} category={3} />
    </div>
  );
}

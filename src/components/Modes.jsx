import React, { useEffect, useState, useRef } from "react";
import { useData } from "../parts/Memory";
import { useSearchParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";

export default function Modes() {
  const { modes, setWorkoutData, loadModes } = useData();
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
      mode_id: 1, //random - just for not letting it blank - it is not used
      name: data.name,
      category: Number(data.category),
      time: Number(data.time),
      motor_speed: Number(data.motorSpeed),
      angles: String(data.angles),
      interval: Number(data.interval),
      predefined: bool,
    };
    try {
      await invoke("add_mode", { data: dataForRust });
    } catch (error) {
      console.error("Failed to add user:", error);
    }

    loadModes();
  };

  const Category = ({ headline, category }) => {
    const elements = modes
      .filter((mode) => mode.category === category) // Filter relevant modes
      .map((mode) => {
        return (
          <WorkoutKind key={mode.modeId} data={mode} /> // Ensure each element has a unique key
        );
        // <p>{mode.name}</p>
      });

    return (
      <div className="flex flex-col mt-8 items-start justify-center border-2 border-blue-300 w-[75vw] rounded-lg px-6 py-4">
        <p className="text-3xl">{headline}</p>
        <p>Category number: {category}</p>
        <div className="mt-4 gap-6 flex justify-left items-left flex-wrap w-full">
          {elements}
        </div>
      </div>
    );
  };

  const WorkoutKind = ({ data }) => {
    const { name, image, time, angles, interval, predefined } = data;
    return (
      <div className="flex flex-col items-center relative justify-center border-2 rounded-lg w-[30%] px-6 py-4">
        <p className="text-3xl">{name}</p>
        <img src={image} />
        <p>délka cvičení: {time}</p>
        <p>úhly střelby: {angles}</p>
        <p>interval střelby {interval}</p>
        <button
          className="button mt-4 button__positive"
          onClick={() => startWorkout(data)}
        >
          Hrát
        </button>
        {data.predefined === false && (
          <button
            className="rounded-full absolute top-0 right-0 bg-red-500 px-2"
            onClick={() =>
              modalRef.current.openModal({
                headline: "Odstranění módu",
                question: "Opravdu chcete tento mode odstranit?",
                buttons: { confirm: true, cancel: true },
                confirmHandle: () => {
                  deleteMode(data.modeId);
                },
              })
            }
          >
            x
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <div className="w-full flex justify-end">
        <button
          className="button button__positive"
          onClick={() => {
            modalRef.current.openModal({
              buttons: {
                confirm: true,
                cancel: true,
              },

              headline: "Přidat nový mode",
              question: "Zadejte údaje pro nový mode",

              input: true,
              numberOfInputs: 7,

              inputData: [],
              inputPlaceholders: [
                "name",
                "category",
                "time",
                "motorSpeed",
                "angles",
                "interval",
                "predefined",
              ],
              confirmHandle: (newData) => {
                createMode(newData);
              },
            });
          }}
        >
          Přidat mode
        </button>
      </div>

      <Category headline={"Unordered"} category={0} />
      <Category headline={"2Point Workouts"} category={1} />
      <Category headline={"3Point Workouts"} category={2} />
      <Modal ref={modalRef} />
    </div>
  );
}

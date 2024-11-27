import React, { useEffect, useState } from "react";
import { useData } from "../parts/Memory";
import { useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

export default function Modes() {
  const { modes, setWorkoutData } = useData();
  const [categories, setCategories] = useState([0, 1]);
  const navigate = useNavigate();

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

  const Category = ({ headline, category }) => {
    console.log("MODES ", modes);
    const elements = modes
      .filter((mode) => mode.category === category) // Filter relevant modes
      .map((mode) => {
        console.log("MODE ", mode);
        return (
          <WorkoutKind key={mode.modeId} data={mode} /> // Ensure each element has a unique key
        );
        // <p>{mode.name}</p>
      });

    return (
      <div className="flex flex-col mt-8 items-start justify-center border-2 border-blue-300 w-[75vw] rounded-lg px-6 py-4">
        <p className="text-3xl">{headline}</p>
        <p>Category number: {category}</p>
        <div className="mt-4">{elements}</div>
      </div>
    );
  };

  const WorkoutKind = ({ data }) => {
    const { name, image, time, angles, interval } = data;
    return (
      <div className="flex flex-col items-center relative justify-center border-2 rounded-lg px-6 py-4">
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
        <button className="rounded-full absolute top-0 right-0 bg-red-500 px-2">
          x
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 gap-4">
      <Category headline={"Unordered"} category={0} />
      <Category headline={"2Point Workouts"} category={1} />
      <Category headline={"3Point Workouts"} category={2} />
    </div>
  );
}

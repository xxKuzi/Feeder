import React, { useEffect, useRef } from "react";
import { useData } from "../parts/Memory";
import { useLocation } from "react-router-dom";

export default function Result() {
  const { records, slowdownMotor, statistics, addRecord } = useData();
  const location = useLocation();
  const { made, taken } = statistics;
  const { category } = location.state || { category: 0 };
  const hasSaved = useRef(false);

  const accuracy = taken > 0 ? made / taken : 0;

  useEffect(() => {
    if (hasSaved.current) return;
    hasSaved.current = true;
    console.log("Category: ", category);
    const save = async () => {
      await addRecord(made, taken);
    };

    save();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="border-2 mt-2 flex flex-col justify-center items-center rounded-xl w-[80vw] h-[80vh]">
        <p className="headline">Results</p>
        <div className="flex items-center justify-center mt-8 gap-[100px]">
          <div className="flex flex-col items-center justify-center">
            <p className="text-9xl font-bold">{made}</p>
            <p className="text-2xl">trefeno</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p
              style={{
                color: `rgb(${Math.round((1 - accuracy) * 255)},${Math.round(
                  accuracy * 255
                )},0)`,
              }}
              className="text-9xl font-bold"
            >
              {Math.floor((made / taken) * 100)}%
            </p>
            <p className="text-2xl">úspěšnost</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-9xl font-bold">{taken}</p>
            <p className="text-2xl">vysřeleno</p>
          </div>
        </div>
      </div>
    </div>
  );
}

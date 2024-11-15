import React, { act, useEffect } from "react";
import { useData } from "../parts/Memory";

export default function Result() {
  const { records, updateStatistics, statistics } = useData();
  useEffect(() => {
    console.log("statisticss", statistics);
    updateStatistics(0, 0);
  }, []);
  const actualRecord = records[records.length - 1];
  const accuracy =
    actualRecord.taken > 0 ? actualRecord.made / actualRecord.taken : 0;
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="border-2 mt-2 flex flex-col justify-center items-center rounded-xl w-[80vw] h-[80vh]">
        <p className="headline">Results</p>
        <div className="flex items-center justify-center mt-8 gap-[100px]">
          <div className="flex flex-col items-center justify-center">
            <p className="text-9xl font-bold">{actualRecord.made}</p>
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
              {Math.floor((actualRecord.made / actualRecord.taken) * 100)}%
            </p>
            <p className="text-2xl">úspěšnost</p>
          </div>
          <div className="flex flex-col items-center justify-center">
            <p className="text-9xl font-bold">{actualRecord.taken}</p>
            <p className="text-2xl">vysřeleno</p>
          </div>
        </div>
      </div>
    </div>
  );
}

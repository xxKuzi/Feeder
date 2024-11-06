import React from "react";
import { useData } from "../parts/Memory";

export default function End() {
  const { records } = useData();
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="border-2 mt-2 flex flex-col justify-center items-center rounded-xl w-[80vw] h-[80vh]">
        <p className="headline">Results</p>
        <p>made: {records[records.length - 1].made}</p>
        <p>taken: {records[records.length - 1].taken}</p>
      </div>
    </div>
  );
}

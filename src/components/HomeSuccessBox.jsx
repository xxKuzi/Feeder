import React, { useEffect, useState } from "react";

const SuccessBox = ({ records, days, headline }) => {
  const [recentRecords, setRecentRecords] = useState([]);
  const [boxData, setBoxData] = useState([]); //data passed to the box (visual part)

  useEffect(() => {
    if (!records || records.length === 0) return; // early return if records not ready

    const filtered = findRecentRecords(days);
    setRecentRecords(filtered);

    const totalMade = filtered.reduce((sum, rec) => sum + rec.made, 0);
    const totalTaken = filtered.reduce((sum, rec) => sum + rec.taken, 0);
    console.log("totalMade", totalMade);

    const rate =
      totalTaken === 0 ? 0 : Math.round((totalMade / totalTaken) * 100);

    setBoxData({
      made: totalMade,
      taken: totalTaken,
      successRate: rate,
    });
  }, [records, days]);

  const getCurrentTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const findRecentRecords = (days) => {
    const now = new Date();
    const timeAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return records.filter((record) => {
      const recordDate = new Date(record.createdAt.replace(" ", "T"));
      return recordDate >= timeAgo;
    });
  };
  return (
    <div>
      {records && (
        <div className="flex flex-col items-center justify-center border-2 rounded-lg px-4 py-2 h-[192px] border-sky-400 hover:border-gray-300 duration-300">
          <p className="text-bold text-2xl">Úspěšnost</p>
          <p className="text-xl mt-4">{headline}</p>

          <div className="relative">
            <p className="text-5xl mt-2 font-bold">
              {boxData.successRate || 0 + "%"}
            </p>
            {boxData.successRate && (
              <p className="-right-5 bottom-0 text-xl absolute text-gray-600">
                %
              </p>
            )}
          </div>

          <div className="flex text-2xl mt-2 items-center justify-between w-[200px]">
            <p>{boxData.made}</p>

            <p>{boxData.taken}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuccessBox;

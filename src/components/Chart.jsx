import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const Chart = ({ records }) => {
  const [data, setData] = useState([]);

  const getLastSixMonthsData = () => {
    if (!records || records.length === 0) return;

    const now = new Date();
    const monthlyData = [];

    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);

      const monthRecords = records.filter((record) => {
        const recordDate = new Date(record.createdAt.replace(" ", "T"));
        return recordDate >= start && recordDate < end;
      });

      const made = monthRecords.reduce((sum, rec) => sum + rec.made, 0);
      const taken = monthRecords.reduce((sum, rec) => sum + rec.taken, 0);
      const successRate = taken === 0 ? 0 : Math.round((made / taken) * 100);

      const monthName = start.toLocaleString("default", { month: "long" });

      function getCzechMonthName(monthName) {
        switch (monthName) {
          case "January":
            return "Leden";
          case "February":
            return "Únor";
          case "March":
            return "Březen";
          case "April":
            return "Duben";
          case "May":
            return "Květen";
          case "June":
            return "Červen";
          case "July":
            return "Červenec";
          case "August":
            return "Srpen";
          case "September":
            return "Září";
          case "October":
            return "Říjen";
          case "November":
            return "Listopad";
          case "December":
            return "Prosinec";
          default:
            return monthName;
        }
      }

      monthlyData.unshift({
        name: getCzechMonthName(monthName),
        made,
        taken,
        successRate,
      });
    }

    setData(monthlyData);
  };

  useEffect(() => {
    getLastSixMonthsData();
  }, [records]);

  return (
    <ResponsiveContainer width="100%" height={300} className="mt-16">
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="made" fill="#4ade80" name="Proměněno" />
        <Bar dataKey="taken" fill="#60a5fa" name="Vystřeleno" />
        <Bar dataKey="successRate" fill="#fbbf24" name="Úspěšnost %" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;

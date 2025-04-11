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

      const monthName = start.toLocaleString("default", { month: "short" });

      monthlyData.unshift({
        name: monthName,
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
        <Bar dataKey="made" fill="#4ade80" name="Made" />
        <Bar dataKey="taken" fill="#60a5fa" name="Taken" />
        <Bar dataKey="successRate" fill="#fbbf24" name="Success %" />
      </BarChart>
    </ResponsiveContainer>
  );
};

export default Chart;

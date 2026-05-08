import React, { useEffect, useState } from "react";
import Table from "../components/ui/page";
import StatisticSection from "@/components/StatisticSection";
import { useData } from "../parts/Memory";
import SuccessBox from "@/components/SuccessBox";
import Chart from "@/components/Chart";

export default function Statistics() {
  const { records } = useData();

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-start gap-8 px-6 py-10">
      <p className="headline mt-4">Statistiky</p>
      <p className="text-2xl w-full max-w-5xl">Dlouhodobá úspěšnost střelby:</p>
      <div className="flex w-full max-w-5xl items-center justify-center gap-8">
        <SuccessBox headline={"Dnes"} records={records} days={1} />
        <SuccessBox headline={"30 dní"} records={records} days={30} />
        <SuccessBox headline={"6 měsíců"} records={records} days={182} />
      </div>
      <div className="w-full max-w-5xl">
        <Chart records={records} />
      </div>
      <Table />
    </div>
  );
}

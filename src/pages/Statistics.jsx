import React, { useEffect, useState } from "react";
import Table from "../components/ui/page";
import StatisticSection from "@/components/StatisticSection";
import { useData } from "../parts/Memory";
import SuccessBox from "@/components/SuccessBox";

export default function Statistics() {
  const { records } = useData();

  return (
    <div className="flex flex-col items-center min-h-screen justify-center">
      <p className="headline mt-16">Statistiky</p>
      <p className="text-2xl w-full mt-6">Dlouhodobá úspěšnost střelby:</p>
      <div className="flex items-center justify-center gap-8">
        <SuccessBox headline={"Dnes"} records={records} days={1} />
        <SuccessBox headline={"30 dní"} records={records} days={30} />
        <SuccessBox headline={"6 měsíců"} records={records} days={182} />
      </div>
      <Table />
    </div>
  );
}

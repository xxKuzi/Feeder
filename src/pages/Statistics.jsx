import React, { useEffect, useState } from "react";
import Table from "../components/ui/page";

export default function Statistics() {
  return (
    <div className="flex flex-col items-center min-h-screen justify-center">
      <p className="headline mt-16">Statistics</p>
      <Table />
    </div>
  );
}

import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import { IoHomeSharp } from "react-icons/io5";
import { CiDumbbell } from "react-icons/ci";
import { IoNewspaperOutline } from "react-icons/io5";
import { useData } from "./Memory";
import Clock from "../components/Clock";

export default function Navbar() {
  const { profile } = useData();
  return (
    <div className="flex flex-col items-center justify-center bg-gray-200">
      <div className="text-md justify-between h-screen flex py-2 px-2 flex-col">
        <div className="h-32">
          <div className="flex gap-2 items-center justify-start">
            <CgProfile size={25} />
            <p className="text-xl">#{profile.number}</p>
          </div>
          <p className="text-2xl font-semibold max-w-[115px] text-wrap">
            {profile.name}
          </p>
        </div>

        <div className="flex flex-col gap-4 justify-center">
          <Link
            to="/profiles"
            className="flex gap-1 flex-col items-center justify-center button button__positive"
          >
            <CgProfile size={40} />
            Profiles
          </Link>
          <Link
            to="/"
            className="flex gap-1 flex-col items-center justify-center button button__positive"
          >
            <IoHomeSharp size={40} />
            Home
          </Link>
          <Link
            to="/menu"
            className="flex gap-1 flex-col items-center justify-center button button__positive"
          >
            <CiDumbbell size={50} />
            Menu
          </Link>
          <Link
            to="/statistics"
            className="flex gap-1 flex-col items-center justify-center button button__positive"
          >
            <IoNewspaperOutline size={40} />
            Statistics
          </Link>
        </div>
        <div className="h-32 flex-col flex justify-end items-center text-center">
          <Clock />
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { CgProfile } from "react-icons/cg";
import { IoHomeOutline } from "react-icons/io5";

import { CiDumbbell } from "react-icons/ci";
import { IoNewspaperOutline } from "react-icons/io5";
import { useData } from "./Memory";
import Clock from "../components/Clock";

// Map of icons
const iconsMap = {
  CgProfile,
  IoHomeOutline,
  CiDumbbell,
  IoNewspaperOutline,
};

// Navbar links array
const navLinks = [
  { path: "/profiles", icon: "CgProfile", label: "Profily", size: 40 },
  { path: "/", icon: "IoHomeOutline", label: "Home", size: 40 },
  { path: "/menu", icon: "CiDumbbell", label: "Menu", size: 50 },
  {
    path: "/statistics",
    icon: "IoNewspaperOutline",
    label: "Statistiky",
    size: 40,
  },
];

export default function Navbar() {
  const { profile } = useData();
  const [page, setPage] = useState();
  const location = useLocation();

  useEffect(() => {
    setPage(location.pathname);
  });

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 fixed top-0 left-0 w-[135px]">
      <div className="text-md justify-between h-screen flex py-2 px-2 flex-col">
        {/* Profile Section */}
        <div className="h-32">
          <div className="flex gap-2 items-center justify-start">
            <CgProfile size={25} />
            <p className="text-xl">#{profile.number}</p>
          </div>
          <p className="text-2xl font-semibold max-w-[115px] text-wrap">
            {profile.name}
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-col gap-4 justify-center">
          {navLinks.map(({ path, icon, label, size }) => {
            const IconComponent = iconsMap[icon]; // Dynamically get the icon component
            return (
              <Link
                key={path}
                to={path}
                className={`flex gap-1 flex-col border-2 items-center hover:border-white hover:bg-white duration-300 justify-center button ${
                  page === path ? "border-blue-400" : ""
                }`}
              >
                <IconComponent color="2463eb" size={size} />
                {label}
              </Link>
            );
          })}
        </div>
        <Link to="/testing" className="text-center underline text-blue-500">
          testování
        </Link>

        {/* Clock Section */}
        <div className="h-32 flex-col flex justify-end items-center text-center">
          <Clock />
        </div>
      </div>
    </div>
  );
}
//color blue 2463eb

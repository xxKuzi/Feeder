import React from "react";
import { Link } from "react-router-dom";

export default function Section(props) {
  const { name, img, link, color } = props.data;

  return (
    <div>
      <Link
        to={link}
        style={{
          backgroundImage: `url(${img})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "cover",
          color: color === "white" ? "white" : "black",
        }}
        className="border-2 rounded-xl w-[320px] h-[300px] flex flex-col items-center justify-center mt-16"
      >
        <p className="text-2xl font-semibold">{name}</p>
      </Link>
    </div>
  );
}

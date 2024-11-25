/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        orange1: "rgb(241, 119, 32)",
        yellow1: "rgb(255, 166, 48)",
        white1: "rgb(235, 235, 235)",
        blue1: "rgb(0, 167, 225)",
        darkBlue1: "rgb(4, 116, 186)",
      },
    },
  },
  plugins: [],
};

import { NavLink } from "react-router-dom";
import { IoHomeOutline, IoNewspaperOutline } from "react-icons/io5";
import { CiDumbbell } from "react-icons/ci";
import { GrManual } from "react-icons/gr";

const tabs = [
  { to: "home", label: "Home", icon: IoHomeOutline },
  { to: "manual", label: "Manual Mode", icon: GrManual },
  { to: "control", label: "Workout", icon: CiDumbbell },
  { to: "stats", label: "Stats", icon: IoNewspaperOutline },
];

export default function PocketNav({ basePath = "/user", role = "guest" }) {
  return (
    <nav
      className="fixed bottom-2 left-2 right-2 z-40 rounded-xl border border-slate-300 bg-slate-100/95 p-2 shadow-lg backdrop-blur md:static md:left-auto md:right-auto md:top-0 md:h-screen md:w-[136px] md:rounded-none md:border-0 md:border-r md:border-slate-300 md:bg-slate-100 md:p-3 md:shadow-none"
      aria-label="Feeder Pocket tabs"
    >
      <div className="hidden md:block md:pb-3">
        <p className="text-lg font-bold leading-none">Feeder</p>
        <p className="mt-1 text-xs capitalize text-slate-500">{role} monitor</p>
      </div>

      <div className="grid grid-cols-4 gap-2 md:flex md:flex-col">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${basePath}/${to}`}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition md:min-h-12 md:flex-row md:justify-start md:gap-2 md:text-sm ${
                isActive
                  ? "border-blue-300 bg-white text-blue-700"
                  : "border-transparent text-slate-700 hover:border-blue-100 hover:bg-white"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

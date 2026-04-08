import { NavLink } from "react-router-dom";
import { IoNewspaperOutline } from "react-icons/io5";
import { CiDumbbell } from "react-icons/ci";
import { GrManual } from "react-icons/gr";
import { useI18n } from "../../i18n/I18nProvider";

const tabs = [
  { to: "modes", key: "modesTab", icon: GrManual },
  { to: "control", key: "controlTab", icon: CiDumbbell, accent: true },
  { to: "stats", key: "stats", icon: IoNewspaperOutline },
];

export default function PocketNav({ basePath = "/user", role = "guest" }) {
  const { t } = useI18n();
  const roleLabel = t(
    role === "developer"
      ? "roleDeveloper"
      : role === "user"
        ? "roleUser"
        : "roleGuest",
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border border-slate-300 bg-slate-100/95 p-2 shadow-lg backdrop-blur md:static md:left-auto md:right-auto md:top-0 md:h-screen md:w-[136px] md:rounded-none md:border-0 md:border-r md:border-slate-300 md:bg-slate-100 md:p-3 md:shadow-none"
      aria-label={t("tabsAria")}
    >
      <div className="hidden md:block md:pb-3">
        <p className="text-lg font-bold leading-none">Feeder</p>
        <p className="mt-1 text-xs capitalize text-slate-500">
          {t("monitorLabel", { role: roleLabel })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 md:flex md:flex-col">
        {tabs.map(({ to, key, icon: Icon, accent }) => (
          <NavLink
            key={to}
            to={`${basePath}/${to}`}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition md:min-h-12 md:flex-row md:justify-start md:gap-2 md:text-sm ${
                isActive
                  ? "border-blue-700 bg-blue-600 text-white shadow-lg shadow-blue-200"
                  : accent
                    ? "border-blue-300 bg-blue-50 text-blue-800 hover:border-blue-400 hover:bg-blue-100"
                    : "border-transparent text-slate-700 hover:border-blue-100 hover:bg-white"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span>{t(key)}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

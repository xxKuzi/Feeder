import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMonitor } from "../../monitor/MonitorContext";
import PocketNav from "./PocketNav";
import { IoMenu } from "react-icons/io5";
import { CgProfile } from "react-icons/cg";

export default function PocketShell({ basePath = "/user", variant = "user" }) {
  const { connected, isAuthenticated, role, handleSignOut, commandInfo } =
    useMonitor();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!connected || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const signOut = async () => {
    await handleSignOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-3 md:grid-cols-[136px_minmax(0,1fr)]">
      <PocketNav basePath={basePath} role={role} />

      <div className="min-h-screen px-3 pb-28 pt-3 md:px-4 md:pb-6 md:pt-5">
        <header className="relative z-30 mb-3 flex items-center justify-between md:hidden">
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Open mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <IoMenu size={24} />
          </button>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-2">
            <CgProfile size={24} />
            <span
              className={`text-xs font-bold ${connected ? "text-green-700" : "text-red-600"}`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>

          {mobileMenuOpen && (
            <div className="absolute left-0 top-14 grid min-w-[210px] gap-2 rounded-lg border border-slate-300 bg-white p-3 shadow-xl">
              <p className="m-0 text-sm capitalize text-slate-600">Mode: {role}</p>
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
                onClick={signOut}
              >
                Log Out
              </button>
            </div>
          )}
        </header>

        <header className="mb-4 hidden items-start justify-between gap-4 md:flex">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">Feeder</p>
            <h1 className="m-0 text-3xl font-bold tracking-tight">
              {variant === "dev" ? "Developer Monitor" : "User Monitor"}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {variant === "dev"
                ? "Diagnostics, profile management and live telemetry."
                : "Workout overview and control in Feeder desktop style."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <span
              className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-bold ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
            >
              {connected ? "Bridge online" : "Bridge offline"}
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full bg-blue-100 px-3 text-sm font-bold capitalize text-blue-700">
              {role}
            </span>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
              onClick={signOut}
            >
              Sign Out
            </button>
          </div>
        </header>

        {commandInfo && (
          <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            {commandInfo}
          </p>
        )}

        <Outlet />
      </div>
    </div>
  );
}

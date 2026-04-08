import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMonitor } from "../../monitor/MonitorContext";
import PocketNav from "./PocketNav";
import { IoMenu } from "react-icons/io5";
import { CgProfile } from "react-icons/cg";
import { useI18n } from "../../i18n/I18nProvider";

export default function PocketShell({ basePath = "/user", variant = "user" }) {
  const { t, language, setLanguage } = useI18n();
  const { connected, isAuthenticated, role, handleSignOut, commandInfo } =
    useMonitor();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const signOut = async () => {
    await handleSignOut();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!connected || !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const roleLabel = t(
    role === "developer"
      ? "roleDeveloper"
      : role === "user"
        ? "roleUser"
        : "roleGuest",
  );

  return (
    <div className="mx-auto grid min-h-screen w-full max-w-[1400px] grid-cols-1 gap-3 md:grid-cols-[136px_minmax(0,1fr)]">
      <PocketNav basePath={basePath} role={role} />

      <div className="pt-3 md:px-4 md:pb-6 md:pt-5">
        <header className="relative z-30 mb-3 flex items-center px-2 justify-between md:hidden">
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 bg-white"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={t("openMobileMenu")}
            aria-expanded={mobileMenuOpen}
          >
            <IoMenu size={24} />
          </button>

          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-2">
            <CgProfile size={24} />
            <span
              className={`text-xs font-bold ${connected ? "text-green-700" : "text-red-600"}`}
            >
              {connected ? t("connected") : t("notConnected")}
            </span>
          </div>

          {mobileMenuOpen && (
            <div className="absolute left-0 top-14 grid min-w-[210px] gap-2 rounded-lg border border-slate-300 bg-white p-3 shadow-xl">
              <p className="m-0 text-sm capitalize text-slate-600">
                {t("mode")}: {roleLabel}
              </p>
              <p className="m-0 text-sm text-slate-600">{t("language")}</p>
              <div className="flex gap-2">
                <button
                  className={`rounded-lg border px-3 py-1 text-sm font-semibold ${language === "cs" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700"}`}
                  onClick={() => setLanguage("cs")}
                >
                  {t("czech")}
                </button>
                <button
                  className={`rounded-lg border px-3 py-1 text-sm font-semibold ${language === "en" ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-700"}`}
                  onClick={() => setLanguage("en")}
                >
                  {t("english")}
                </button>
              </div>
              <button
                className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
                onClick={signOut}
              >
                {t("logOut")}
              </button>
            </div>
          )}
        </header>

        <header className="mb-4 hidden items-start justify-between gap-4 md:flex">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-500">
              Feeder
            </p>
            <h1 className="m-0 text-3xl font-bold tracking-tight">
              {variant === "dev" ? t("developerMonitor") : t("userMonitor")}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {variant === "dev" ? t("devSubline") : t("userSubline")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
            <span
              className={`inline-flex min-h-9 items-center rounded-full px-3 text-sm font-bold ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
            >
              {connected ? t("bridgeOnline") : t("bridgeOffline")}
            </span>
            <span className="inline-flex min-h-9 items-center rounded-full bg-blue-100 px-3 text-sm font-bold capitalize text-blue-700">
              {roleLabel}
            </span>
            <div className="flex items-center gap-2 rounded-lg border border-slate-300 px-2 py-1">
              <span className="text-xs font-semibold text-slate-600">
                {t("language")}
              </span>
              <button
                className={`rounded px-2 py-1 text-xs font-semibold ${language === "cs" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                onClick={() => setLanguage("cs")}
              >
                CZ
              </button>
              <button
                className={`rounded px-2 py-1 text-xs font-semibold ${language === "en" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 font-semibold text-white"
              onClick={signOut}
            >
              {t("signOut")}
            </button>
          </div>
        </header>

        {/* {commandInfo && (
          <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900">
            {commandInfo}
          </p>
        )} */}

        <Outlet />
      </div>
    </div>
  );
}

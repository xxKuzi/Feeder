import { useMonitor } from "../monitor/MonitorContext";

export default function LoginPage() {
  const {
    connected,
    password,
    setPassword,
    authError,
    handleAuth,
  } = useMonitor();

  return (
    <div className="relative grid min-h-screen place-items-center p-4">
      <div className="absolute inset-4 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100" />
      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
          Feeder Pocket
        </div>
        <h1 className="m-0 text-3xl font-bold tracking-tight">Welcome back</h1>

        <div
          className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-bold ${connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}
        >
          {connected ? "Bridge connected" : "Bridge disconnected"}
        </div>
        <p className="mb-5 mt-3 text-sm text-slate-500">
          {connected
            ? "Sign in with your user or developer password."
            : "Start Feeder and the bridge first, then come back here."}
        </p>

        <label className="mb-2 block font-semibold" htmlFor="pocket-password">
          Password
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="pocket-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            disabled={!connected}
            className="min-w-[220px] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
          <button
            onClick={handleAuth}
            disabled={!connected}
            className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Unlock
          </button>
        </div>

        {authError && <p className="mt-3 text-sm font-bold text-red-600">{authError}</p>}
      </section>
    </div>
  );
}

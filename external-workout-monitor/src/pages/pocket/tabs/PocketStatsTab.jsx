import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { Card, EventList } from "./shared";

export function PocketStatsTab() {
  const { t } = useI18n();
  const {
    snapshot,
    isDeveloper,
    handleExport,
    loadProfiles,
    loadModes,
    profiles,
    newProfile,
    setNewProfile,
    renamePayload,
    setRenamePayload,
    addProfile,
    renameProfile,
    deleteProfile,
    passwordPayload,
    setPasswordPayload,
    changePassword,
    modeList,
    modeEdit,
    setModeEdit,
    saveMode,
  } = useMonitor();
  const messages = Number(snapshot?.messagesSeen || 0);

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("statistics")}
          </p>
          <h2 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
            {isDeveloper ? t("liveLogsAndStats") : t("yourWorkoutStats")}
          </h2>
        </div>
        <p className="text-sm text-slate-500">{t("devLogHint")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card
          title={t("basketScore")}
          value={snapshot?.basketScore ?? 0}
          note={t("currentLiveScore")}
          tone="gold"
        />
        <Card
          title={t("messages")}
          value={messages}
          note={isDeveloper ? t("includesTelemetry") : t("hiddenLogs")}
          tone="blue"
        />
        <Card
          title={t("state")}
          value={snapshot?.workoutState || t("unknown")}
          note={t("roleLine", { role: snapshot?.role || t("roleGuest") })}
          tone="green"
        />
      </div>

      {isDeveloper ? (
        <div className="grid gap-3">
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={handleExport}
            >
              {t("downloadAllData")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadProfiles}
            >
              {t("refreshProfiles")}
            </button>
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
              onClick={loadModes}
            >
              {t("refreshModes")}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("profiles")}
              </h3>
              <div className="grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder={t("name")}
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile((prev) => ({ ...prev, name: e.target.value }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("number")}
                  value={newProfile.number}
                  onChange={(e) =>
                    setNewProfile((prev) => ({
                      ...prev,
                      number: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                  onClick={addProfile}
                >
                  {t("addProfile")}
                </button>
              </div>

              <div className="mt-3 grid gap-3">
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("userId")}
                  value={renamePayload.user_id}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      user_id: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder={t("newName")}
                  value={renamePayload.new_name}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      new_name: e.target.value,
                    }))
                  }
                />
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="number"
                  placeholder={t("newNumber")}
                  value={renamePayload.new_number}
                  onChange={(e) =>
                    setRenamePayload((prev) => ({
                      ...prev,
                      new_number: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
                  onClick={renameProfile}
                >
                  {t("updateProfile")}
                </button>
              </div>

              <div className="mt-3 grid gap-2">
                {profiles.map((profile) => (
                  <div
                    key={profile.user_id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-300 p-2 text-sm"
                  >
                    <span>
                      #{profile.user_id} {profile.name} ({profile.number ?? 0})
                    </span>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold"
                      onClick={() => deleteProfile(profile.user_id)}
                    >
                      {t("delete")}
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("modes")}
              </h3>
              <div className="mt-3 grid gap-2">
                {modeList.map((mode) => {
                  const id = mode.modeId ?? mode.mode_id;
                  const local = modeEdit[id] || {};
                  return (
                    <div
                      key={id}
                      className="grid items-stretch gap-2 rounded-lg border border-slate-300 p-2 text-sm"
                    >
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2"
                        value={local.name ?? mode.name}
                        onChange={(e) =>
                          setModeEdit((prev) => ({
                            ...prev,
                            [id]: { ...(prev[id] || {}), name: e.target.value },
                          }))
                        }
                      />
                      <div className="flex flex-wrap gap-2">
                        <input
                          className="rounded-lg border border-slate-300 px-3 py-2"
                          type="number"
                          value={local.repetition ?? mode.repetition}
                          onChange={(e) =>
                            setModeEdit((prev) => ({
                              ...prev,
                              [id]: {
                                ...(prev[id] || {}),
                                repetition: Number(e.target.value),
                              },
                            }))
                          }
                        />
                        <button
                          className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white"
                          onClick={() => saveMode(mode)}
                        >
                          {t("save")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="m-0 mt-1 text-xl font-bold leading-tight text-slate-900">
                {t("passwordManagement")}
              </h3>
              <div className="grid gap-3">
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  value={passwordPayload.role}
                  onChange={(e) =>
                    setPasswordPayload((prev) => ({
                      ...prev,
                      role: e.target.value,
                    }))
                  }
                >
                  <option value="user">{t("userPassword")}</option>
                  <option value="developer">{t("developerPassword")}</option>
                </select>
                <input
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  type="password"
                  placeholder={t("newPassword")}
                  value={passwordPayload.new_password}
                  onChange={(e) =>
                    setPasswordPayload((prev) => ({
                      ...prev,
                      new_password: e.target.value,
                    }))
                  }
                />
                <button
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
                  onClick={changePassword}
                >
                  {t("changePassword")}
                </button>
              </div>
            </section>
          </div>

          <div className="min-h-[260px]">
            <EventList />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t("noUserLogs")}</p>
      )}
    </section>
  );
}

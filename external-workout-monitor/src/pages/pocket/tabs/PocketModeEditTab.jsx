import { useNavigate, useParams } from "react-router-dom";
import { useMonitor } from "../../../monitor/MonitorContext";
import { useI18n } from "../../../i18n/I18nProvider";
import { getModeId } from "./shared";

export function PocketModeEditTab({ basePath = "/user" }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { modeId } = useParams();
  const { modeList, modeEdit, setModeEdit, saveMode, loadModes } = useMonitor();

  const numericModeId = Number(modeId || 0);
  const mode = modeList.find((entry) => getModeId(entry) === numericModeId);
  const draft = modeEdit[numericModeId] || {};

  const updateDraft = (patch) => {
    setModeEdit((prev) => ({
      ...prev,
      [numericModeId]: {
        ...(prev[numericModeId] || {}),
        ...patch,
      },
    }));
  };

  const handleSave = async () => {
    if (!mode) return;
    await saveMode(mode);
    navigate(`${basePath}/control`, { replace: true });
  };

  if (!mode) {
    return (
      <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("editMode")}
            </p>
            <h2 className="m-0 mt-1 text-2xl font-bold text-slate-900">
              {t("modeNotFound")}
            </h2>
          </div>
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold"
            onClick={() => navigate(`${basePath}/control`)}
          >
            {t("backToModes")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            {t("editMode")}
          </p>
          <h2 className="m-0 mt-1 text-2xl font-bold leading-tight text-slate-900">
            #{getModeId(mode)} · {mode.name}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{t("editModeHint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold"
            onClick={() => navigate(`${basePath}/control`)}
          >
            {t("backToModes")}
          </button>
          <button
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 font-semibold"
            onClick={loadModes}
          >
            {t("refreshModes")}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            {t("modeName")}
            <input
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
              value={draft.name ?? mode.name}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              {t("modeRepetition")}
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
                type="number"
                min={1}
                value={draft.repetition ?? mode.repetition ?? 1}
                onChange={(e) =>
                  updateDraft({ repetition: Number(e.target.value || 1) })
                }
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              {t("modeCategory")}
              <input
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal"
                type="number"
                value={draft.category ?? mode.category ?? 0}
                onChange={(e) =>
                  updateDraft({ category: Number(e.target.value || 0) })
                }
              />
            </label>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(draft.predefined ?? mode.predefined)}
              onChange={(e) => updateDraft({ predefined: e.target.checked })}
            />
            {t("modePredefined")}
          </label>
        </div>

        <aside className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              {t("modeSummary")}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {t("modeIntervalsLabel", {
                count: Array.isArray(mode.intervals)
                  ? mode.intervals.length
                  : 0,
              })}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            {Array.isArray(mode.intervals) && mode.intervals.length > 0
              ? mode.intervals.map((interval, index) => (
                  <div
                    key={`${modeId}-${index}`}
                    className="flex justify-between gap-3 py-1"
                  >
                    <span>{t("intervalLabel", { index: index + 1 })}</span>
                    <strong>{Number(interval || 0)}s</strong>
                  </div>
                ))
              : t("noIntervalsDefined")}
          </div>
        </aside>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-xl border border-blue-700 bg-blue-600 px-5 py-3 font-semibold text-white shadow-sm"
          onClick={handleSave}
        >
          {t("saveMode")}
        </button>
      </div>
    </section>
  );
}

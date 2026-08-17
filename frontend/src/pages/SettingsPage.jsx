import { useCallback, useEffect, useState } from "react";
import { InformationCircleIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import { fetchThresholdSettings, updateThresholdSettings } from "../api/thresholds";
import { useAuth } from "../context/AuthContext";
import { notify } from "../utils/toast";

const emptyPeriod = {
  startYear: "",
  startMonth: "",
  endYear: "",
  endMonth: "",
  reason: "",
};

const inputClass = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm";

export default function SettingsPage() {
  const { auth } = useAuth();
  const token = auth?.accessToken;
  const [settings, setSettings] = useState(null);
  const [excludedPeriods, setExcludedPeriods] = useState([]);
  const [methodologyNotes, setMethodologyNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await fetchThresholdSettings(token);
    setSettings(data.settings);
    setExcludedPeriods(data.settings?.excludedPeriods || []);
    setMethodologyNotes(data.settings?.methodologyNotes || "");
  }, [token]);

  useEffect(() => {
    if (!token) return;
    loadSettings().catch((error) => notify.error(error.message));
  }, [loadSettings, token]);

  const updatePeriod = (index, field, value) => {
    setExcludedPeriods((current) => current.map((period, itemIndex) => (
      itemIndex === index ? { ...period, [field]: value } : period
    )));
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    try {
      setBusy(true);
      const payload = {
        methodologyNotes,
        excludedPeriods: excludedPeriods.map((period) => ({
          ...period,
          startYear: Number(period.startYear),
          startMonth: Number(period.startMonth),
          endYear: Number(period.endYear),
          endMonth: Number(period.endMonth),
        })),
      };
      const data = await updateThresholdSettings(token, payload);
      setSettings(data.settings);
      setExcludedPeriods(data.settings.excludedPeriods || []);
      notify.success("Surveillance settings updated");
    } catch (error) {
      notify.error(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="mt-1 text-gray-600">Administrative settings used by automatic surveillance analysis.</p>
      </div>

      <form onSubmit={saveSettings} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="mt-0.5 h-6 w-6 shrink-0 text-blue-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Alert and epidemic thresholds</h2>
            <p className="mt-1 text-sm text-gray-600">
              The system calculates these automatically whenever the dashboard loads. Users do not run evaluations manually.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Baseline</p>
            <p className="mt-1 font-semibold text-blue-950">5 eligible years</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Alert threshold</p>
            <p className="mt-1 font-semibold text-amber-950">Mean + 1 standard deviation</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-red-700">Epidemic threshold</p>
            <p className="mt-1 font-semibold text-red-950">Mean + 2 standard deviations</p>
          </div>
        </div>

        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          Weekly datasets compare the latest epidemiological week with the same week in five eligible prior years. Legacy monthly datasets remain monthly and are labeled accordingly.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-gray-900">Excluded baseline periods</h3>
            <p className="mt-1 text-sm text-gray-600">Exclude documented pandemic or outbreak periods so they do not distort the baseline.</p>
          </div>
          <button
            type="button"
            onClick={() => setExcludedPeriods((current) => [...current, { ...emptyPeriod }])}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            <PlusIcon className="h-4 w-4" /> Add excluded period
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {excludedPeriods.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center text-sm text-gray-500">No periods are currently excluded.</p>
          )}
          {excludedPeriods.map((period, index) => (
            <div key={`${index}-${period.startYear}-${period.startMonth}`} className="grid grid-cols-2 gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
              <label className="text-xs font-medium text-gray-700">Start year<input required type="number" min="1900" max="2200" className={inputClass} value={period.startYear} onChange={(event) => updatePeriod(index, "startYear", event.target.value)} /></label>
              <label className="text-xs font-medium text-gray-700">Start month<input required type="number" min="1" max="12" className={inputClass} value={period.startMonth} onChange={(event) => updatePeriod(index, "startMonth", event.target.value)} /></label>
              <label className="text-xs font-medium text-gray-700">End year<input required type="number" min="1900" max="2200" className={inputClass} value={period.endYear} onChange={(event) => updatePeriod(index, "endYear", event.target.value)} /></label>
              <label className="text-xs font-medium text-gray-700">End month<input required type="number" min="1" max="12" className={inputClass} value={period.endMonth} onChange={(event) => updatePeriod(index, "endMonth", event.target.value)} /></label>
              <label className="col-span-2 text-xs font-medium text-gray-700 md:col-span-1">Reason<input required maxLength="300" className={inputClass} value={period.reason} onChange={(event) => updatePeriod(index, "reason", event.target.value)} /></label>
              <button type="button" aria-label="Remove excluded period" onClick={() => setExcludedPeriods((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="self-end rounded-lg p-2.5 text-red-600 hover:bg-red-50">
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>

        <label className="mt-5 block text-sm font-medium text-gray-700">
          Methodology notes
          <textarea maxLength="2000" className={`${inputClass} min-h-24`} value={methodologyNotes} onChange={(event) => setMethodologyNotes(event.target.value)} />
        </label>

        <div className="mt-5 flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500">{settings?.updatedAt ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}` : "Using fixed system defaults"}</p>
          <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}

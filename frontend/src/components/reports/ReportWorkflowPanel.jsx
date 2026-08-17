import { useEffect, useState } from "react";
import { formatStatusLabel } from "../../utils/formatStatusLabel";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

function Field({ label, children }) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";

export default function ReportWorkflowPanel({ report, token, onUpdated }) {
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [auditItems, setAuditItems] = useState([]);
  const [auditError, setAuditError] = useState("");
  const [investigation, setInvestigation] = useState({
    investigationDate: new Date().toISOString().slice(0, 10),
    locationVisited: report.location?.name || "",
    findings: "",
    symptoms: Array.isArray(report.symptoms) ? report.symptoms.join(", ") : "",
    foodExposureInformation: report.foodSource || "",
    remarks: "",
  });
  const [suspectedRemarks, setSuspectedRemarks] = useState("");
  const [ruleOutReason, setRuleOutReason] = useState("");
  const [validation, setValidation] = useState({
    result: "confirmed",
    condition: "",
    laboratoryEvidence: "",
    supportingFindings: "",
    remarks: "",
  });

  const submit = async (action, path, body) => {
    try {
      setBusyAction(action);
      setError("");
      setMessage("");
      const response = await fetch(`${API_BASE}/api/reports/${report._id}/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to update this report.");
      setMessage(data.message || "Report updated.");
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to update this report.");
    } finally {
      setBusyAction("");
    }
  };

  const status = report.currentStatus || "reported";
  const canInvestigate = status === "reported";
  const canMarkSuspected =
    status === "reported" && report.investigationStatus === "completed";
  const canValidate = status === "suspected";
  const validationLabel =
    ["ruled_out", "not_suspected"].includes(status)
      ? "not_applicable"
      : report.validationStatus || "not_started";

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/api/reports/${report._id}/audit?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message || "Unable to load audit trail.");
        if (active) setAuditItems(Array.isArray(data.items) ? data.items : []);
      })
      .catch((requestError) => {
        if (active) setAuditError(requestError.message || "Unable to load audit trail.");
      });
    return () => {
      active = false;
    };
  }, [report._id, report.currentStatus, token]);

  return (
    <div className="mt-5 space-y-4 border-t border-gray-200 pt-5">
      <div>
        <h4 className="font-semibold text-gray-900">Case workflow</h4>
        <p className="mt-1 text-sm text-gray-600">
          After investigation, mark the report as Suspected or Rule it Out. Suspected cases then proceed to validation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Investigation: {formatStatusLabel(report.investigationStatus || "not_started")}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Validation: {formatStatusLabel(validationLabel)}</span>
        </div>
      </div>

      {report.investigationStatus === "completed" && report.investigation && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <h5 className="font-semibold text-gray-900">Investigation record</h5>
          <dl className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <div><dt className="font-medium">Date</dt><dd>{report.investigation.investigationDate ? new Date(report.investigation.investigationDate).toLocaleDateString() : "—"}</dd></div>
            <div><dt className="font-medium">Location visited</dt><dd>{report.investigation.locationVisited || "—"}</dd></div>
            <div className="md:col-span-2"><dt className="font-medium">Findings</dt><dd>{report.investigation.findings || "—"}</dd></div>
            <div><dt className="font-medium">Food/exposure</dt><dd>{report.investigation.foodExposureInformation || "—"}</dd></div>
            <div><dt className="font-medium">Remarks</dt><dd>{report.investigation.remarks || "—"}</dd></div>
          </dl>
        </div>
      )}

      {report.validation?.validatedAt && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 text-sm text-gray-700">
          <h5 className="font-semibold text-gray-900">Validation record</h5>
          <p className="mt-1">Recorded {new Date(report.validation.validatedAt).toLocaleString()} by {report.validation.validatedBy?.username || "authorized personnel"}.</p>
          <p className="mt-1"><span className="font-medium">Supporting findings:</span> {report.validation.supportingFindings || "—"}</p>
          <p className="mt-1"><span className="font-medium">Laboratory evidence:</span> {report.validation.laboratoryEvidence || "—"}</p>
          <p className="mt-1"><span className="font-medium">Remarks:</span> {report.validation.remarks || "—"}</p>
        </div>
      )}

      {(auditItems.length > 0 || auditError) && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <h5 className="text-sm font-semibold text-blue-950">Report audit trail</h5>
          {auditError ? (
            <p className="mt-2 text-xs text-red-700">{auditError}</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {auditItems.map((item) => (
                <li key={item._id} className="flex gap-2 text-xs text-gray-700">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  <span>
                    <strong>{formatStatusLabel(item.action)}</strong> by {item.actorId?.username || "authorized user"}
                    <span className="block text-[11px] text-gray-500">
                      {formatStatusLabel(item.previousStatus)} → {formatStatusLabel(item.newStatus)} · {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      {canInvestigate && (
        <form
          className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit("investigation", "investigation", {
              ...investigation,
              symptoms: investigation.symptoms.split(",").map((item) => item.trim()).filter(Boolean),
            });
          }}
        >
          <h5 className="font-semibold text-gray-900">1. Record investigation</h5>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Investigation date">
              <input required type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} value={investigation.investigationDate} onChange={(e) => setInvestigation((v) => ({ ...v, investigationDate: e.target.value }))} />
            </Field>
            <Field label="Location visited">
              <input required className={inputClass} value={investigation.locationVisited} onChange={(e) => setInvestigation((v) => ({ ...v, locationVisited: e.target.value }))} />
            </Field>
          </div>
          <Field label="Investigation findings">
            <textarea required rows={3} className={inputClass} value={investigation.findings} onChange={(e) => setInvestigation((v) => ({ ...v, findings: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Relevant symptoms (comma-separated)">
              <input className={inputClass} value={investigation.symptoms} onChange={(e) => setInvestigation((v) => ({ ...v, symptoms: e.target.value }))} />
            </Field>
            <Field label="Food/exposure information">
              <input className={inputClass} value={investigation.foodExposureInformation} onChange={(e) => setInvestigation((v) => ({ ...v, foodExposureInformation: e.target.value }))} />
            </Field>
          </div>
          <Field label="Additional remarks">
            <textarea rows={2} className={inputClass} value={investigation.remarks} onChange={(e) => setInvestigation((v) => ({ ...v, remarks: e.target.value }))} />
          </Field>
          <button disabled={Boolean(busyAction)} className="min-h-11 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {busyAction === "investigation" ? "Saving…" : report.investigationStatus === "completed" ? "Update investigation" : "Save completed investigation"}
          </button>
        </form>
      )}

      {canMarkSuspected && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h5 className="font-semibold text-gray-900">2. Record the investigation decision</h5>
          <Field label="Decision remarks">
            <textarea rows={2} className={inputClass} value={suspectedRemarks} onChange={(e) => setSuspectedRemarks(e.target.value)} />
          </Field>
          <Field label="Reason for ruling out">
            <select className={inputClass} value={ruleOutReason} onChange={(e) => setRuleOutReason(e.target.value)}>
              <option value="">Select a reason</option>
              <option value="fake_report">Fake report</option>
              <option value="not_foodborne_related">Not foodborne-related</option>
              <option value="duplicate_report">Duplicate report</option>
              <option value="insufficient_evidence">Insufficient evidence</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={Boolean(busyAction)}
              onClick={() => submit("suspected", "mark-suspected", { remarks: suspectedRemarks })}
              className="min-h-11 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {busyAction === "suspected" ? "Saving…" : "Mark as Suspected"}
            </button>
            <button
              type="button"
              disabled={
                Boolean(busyAction) ||
                !ruleOutReason ||
                (ruleOutReason === "other" && !suspectedRemarks.trim())
              }
              onClick={() => submit("ruled-out", "rule-out", { reason: ruleOutReason, remarks: suspectedRemarks })}
              className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {busyAction === "ruled-out" ? "Saving…" : "Rule Out Report"}
            </button>
          </div>
        </div>
      )}

      {canValidate && (
        <form className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4" onSubmit={(event) => { event.preventDefault(); submit("validation", "validation", validation); }}>
          <h5 className="font-semibold text-gray-900">3. Record validation outcome</h5>
          <Field label="Validation result">
            <select className={inputClass} value={validation.result} onChange={(e) => setValidation((v) => ({ ...v, result: e.target.value }))}>
              <option value="confirmed">Confirmed</option>
              <option value="not_validated">Not Validated</option>
            </select>
          </Field>
          <Field label="Supporting findings">
            <textarea required rows={3} className={inputClass} value={validation.supportingFindings} onChange={(e) => setValidation((v) => ({ ...v, supportingFindings: e.target.value }))} />
          </Field>
          {validation.result === "confirmed" && (
            <>
              <Field label="Confirmed condition or pathogen">
                <input required className={inputClass} value={validation.condition} onChange={(e) => setValidation((v) => ({ ...v, condition: e.target.value }))} placeholder="Example: Salmonellosis" />
              </Field>
              <Field label="Laboratory evidence (if applicable)">
                <textarea rows={2} className={inputClass} value={validation.laboratoryEvidence} onChange={(e) => setValidation((v) => ({ ...v, laboratoryEvidence: e.target.value }))} placeholder="Record the laboratory test/result reference when available." />
              </Field>
            </>
          )}
          <Field label="Remarks">
            <textarea rows={2} className={inputClass} value={validation.remarks} onChange={(e) => setValidation((v) => ({ ...v, remarks: e.target.value }))} />
          </Field>
          <button disabled={Boolean(busyAction)} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 ms-auto">
            {busyAction === "validation" ? "Saving…" : "Submit validation"}
          </button>
        </form>
      )}
    </div>
  );
}

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatStatusLabel } from "../../utils/formatStatusLabel";
import {
  DISEASE_CASE_RULES,
  SURVEILLANCE_DISEASES,
} from "../../constants/surveillanceMethodology.js";

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
  const [investigation, setInvestigation] = useState({
    investigationDate: report.investigation?.investigationDate
      ? new Date(report.investigation.investigationDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10),
    locationVisited: report.investigation?.locationVisited || report.location?.name || "",
    findings: report.investigation?.findings || "",
    suspectedDisease: report.disease || report.investigation?.suspectedDisease || "",
    symptoms: Array.isArray(report.investigation?.symptoms)
      ? report.investigation.symptoms.join(", ")
      : Array.isArray(report.symptoms) ? report.symptoms.join(", ") : "",
    foodExposureInformation: report.investigation?.foodExposureInformation || report.foodSource || "",
    remarks: report.investigation?.remarks || "",
  });
  const [suspectedRemarks, setSuspectedRemarks] = useState("");
  const [ruleOutReason, setRuleOutReason] = useState("");
  const [validation, setValidation] = useState({
    result: "confirmed",
    condition: "",
    evidenceType: "",
    evidenceDetails: "",
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

  const postAction = async (path, body) => {
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
    return data;
  };

  const submitInvestigationDecision = async (decision) => {
    if (decision === "ruled-out" && !ruleOutReason) {
      setError("Select a reason for ruling out the report.");
      return;
    }
    if (decision === "ruled-out" && ruleOutReason === "other" && !suspectedRemarks.trim()) {
      setError("Add decision remarks when the rule-out reason is Other.");
      return;
    }

    try {
      setBusyAction(decision);
      setError("");
      setMessage("");

      if (report.investigationStatus !== "completed") {
        await postAction("investigation", {
          ...investigation,
          symptoms: investigation.symptoms.split(",").map((item) => item.trim()).filter(Boolean),
        });
      }

      const result = decision === "suspected"
        ? await postAction("mark-suspected", { remarks: suspectedRemarks })
        : await postAction("rule-out", { reason: ruleOutReason, remarks: suspectedRemarks });
      setMessage(result.message || "Investigation decision recorded.");
      await onUpdated?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to record the investigation decision.");
      await onUpdated?.();
    } finally {
      setBusyAction("");
    }
  };

  const status = report.currentStatus || "reported";
  const canInvestigate = status === "reported" && report.investigationStatus !== "completed";
  const canMarkSuspected =
    status === "reported" && report.investigationStatus === "completed";
  const canValidate = ["suspected", "probable"].includes(status);
  const investigatedDisease = report.disease || report.investigation?.suspectedDisease || "";
  const probableEvidence = DISEASE_CASE_RULES[investigatedDisease]?.probableEvidence || [];
  const validationLabel =
    ["ruled_out", "not_suspected"].includes(status)
      ? "not_applicable"
      : report.validationStatus || "not_started";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
        <h4 className="font-semibold text-blue-950">Case workflow</h4>
        <p className="mt-1 text-sm text-blue-900/75">
          Marking a Reported case as Suspected concludes its investigation. A Suspected case may become Probable where the disease criteria allow it; Probable cases still require confirmation.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">Investigation: {formatStatusLabel(report.investigationStatus || "not_started")}</span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Confirmation: {formatStatusLabel(validationLabel)}</span>
        </div>
      </div>

      {report.investigationStatus === "completed" && report.investigation && (
        <details open className="group overflow-hidden rounded-xl border border-amber-200 bg-white text-sm text-gray-700">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between bg-amber-50 px-4 py-3 font-semibold text-amber-950 marker:content-none hover:bg-amber-100/70">
            Investigation record
            <ChevronDown className="h-4 w-4 text-amber-700 transition group-open:rotate-180" />
          </summary>
          <dl className="grid grid-cols-1 gap-3 border-t border-amber-100 px-4 py-4 md:grid-cols-2">
            <div><dt className="font-medium">Date</dt><dd>{report.investigation.investigationDate ? new Date(report.investigation.investigationDate).toLocaleDateString() : "—"}</dd></div>
            <div><dt className="font-medium">Location visited</dt><dd>{report.investigation.locationVisited || "—"}</dd></div>
            <div><dt className="font-medium">Suspected disease</dt><dd>{report.investigation.suspectedDisease || report.disease || "—"}</dd></div>
            <div className="md:col-span-2"><dt className="font-medium">Findings</dt><dd>{report.investigation.findings || "—"}</dd></div>
            <div><dt className="font-medium">Food/exposure</dt><dd>{report.investigation.foodExposureInformation || "—"}</dd></div>
            <div><dt className="font-medium">Remarks</dt><dd>{report.investigation.remarks || "—"}</dd></div>
          </dl>
        </details>
      )}

      {report.validation?.validatedAt && (
        <details open className="group overflow-hidden rounded-xl border border-emerald-200 bg-white text-sm text-gray-700">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 marker:content-none hover:bg-emerald-100/70">
            Confirmation record
            <ChevronDown className="h-4 w-4 text-emerald-700 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-1 border-t border-emerald-100 px-4 py-4">
            <p>Recorded {new Date(report.validation.validatedAt).toLocaleString()} by {report.validation.validatedBy?.username || "authorized personnel"}.</p>
            <p><span className="font-medium">Result:</span> {formatStatusLabel(report.validation.result)}</p>
            <p><span className="font-medium">Supporting findings:</span> {report.validation.supportingFindings || "—"}</p>
            <p><span className="font-medium">Laboratory evidence:</span> {report.validation.laboratoryEvidence || "—"}</p>
            <p><span className="font-medium">Remarks:</span> {report.validation.remarks || "—"}</p>
          </div>
        </details>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div>}

      {canInvestigate && (
        <form
          className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const decision = event.nativeEvent.submitter?.value;
            if (decision) submitInvestigationDecision(decision);
          }}
        >
          <div>
            <h5 className="font-semibold text-gray-900">Investigate and classify report</h5>
            <p className="mt-1 text-sm text-gray-600">Record the visit findings, then conclude the investigation by marking the report as Suspected or ruling it out.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Investigation date">
              <input required type="date" max={new Date().toISOString().slice(0, 10)} className={inputClass} value={investigation.investigationDate} onChange={(e) => setInvestigation((v) => ({ ...v, investigationDate: e.target.value }))} />
            </Field>
            <Field label="Location visited">
              <input required className={inputClass} value={investigation.locationVisited} onChange={(e) => setInvestigation((v) => ({ ...v, locationVisited: e.target.value }))} />
            </Field>
          </div>
          <Field label="Suspected surveillance disease">
            <select required className={inputClass} value={investigation.suspectedDisease} onChange={(e) => setInvestigation((v) => ({ ...v, suspectedDisease: e.target.value }))}>
              <option value="">Select a disease</option>
              {SURVEILLANCE_DISEASES.map((disease) => <option key={disease} value={disease}>{disease}</option>)}
            </select>
          </Field>
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
          <div className="grid gap-3 border-t border-blue-100 pt-3 md:grid-cols-2">
            <Field label="Decision remarks">
              <textarea rows={2} className={inputClass} value={suspectedRemarks} onChange={(e) => setSuspectedRemarks(e.target.value)} />
            </Field>
            <Field label="Reason for ruling out">
              <select className={inputClass} value={ruleOutReason} onChange={(e) => setRuleOutReason(e.target.value)}>
                <option value="">Select only when ruling out</option>
                <option value="fake_report">Fake report</option>
                <option value="not_foodborne_related">Not foodborne-related</option>
                <option value="duplicate_report">Duplicate report</option>
                <option value="insufficient_evidence">Insufficient evidence</option>
                <option value="other">Other</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" name="decision" value="suspected" disabled={Boolean(busyAction)} className="min-h-11 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
              {busyAction === "suspected" ? "Saving investigation…" : "Mark as Suspected"}
            </button>
            <button type="submit" name="decision" value="ruled-out" disabled={Boolean(busyAction)} className="min-h-11 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              {busyAction === "ruled-out" ? "Saving investigation…" : "Rule Out Report"}
            </button>
          </div>
        </form>
      )}

      {canMarkSuspected && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <h5 className="font-semibold text-gray-900">Complete the investigation decision</h5>
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
          <h5 className="font-semibold text-gray-900">
            {status === "probable" ? "Complete probable-case confirmation" : "Classify suspected case"}
          </h5>
          <p className="text-sm text-gray-600">Investigated disease: <strong>{investigatedDisease}</strong></p>
          <Field label="Classification result">
            <select className={inputClass} value={validation.result} onChange={(e) => setValidation((v) => ({ ...v, result: e.target.value, evidenceType: "" }))}>
              {status === "suspected" && probableEvidence.length > 0 && <option value="probable">Probable</option>}
              <option value="confirmed">Confirmed</option>
              <option value="not_validated">Not Confirmed</option>
            </select>
          </Field>
          <Field label="Supporting findings">
            <textarea required rows={3} className={inputClass} value={validation.supportingFindings} onChange={(e) => setValidation((v) => ({ ...v, supportingFindings: e.target.value }))} />
          </Field>
          {validation.result === "probable" && (
            <>
              <Field label="Required probable-case evidence">
                <select required className={inputClass} value={validation.evidenceType} onChange={(e) => setValidation((v) => ({ ...v, evidenceType: e.target.value }))}>
                  <option value="">Select evidence</option>
                  {probableEvidence.map((evidence) => <option key={evidence.value} value={evidence.value}>{evidence.label}</option>)}
                </select>
              </Field>
              <Field label="Evidence details">
                <textarea required rows={2} className={inputClass} value={validation.evidenceDetails} onChange={(e) => setValidation((v) => ({ ...v, evidenceDetails: e.target.value }))} />
              </Field>
            </>
          )}
          {validation.result === "confirmed" && (
            <>
              <Field label="Laboratory evidence (if applicable)">
                <textarea rows={2} className={inputClass} value={validation.laboratoryEvidence} onChange={(e) => setValidation((v) => ({ ...v, laboratoryEvidence: e.target.value }))} placeholder="Record the laboratory test/result reference when available." />
              </Field>
            </>
          )}
          <Field label="Remarks">
            <textarea rows={2} className={inputClass} value={validation.remarks} onChange={(e) => setValidation((v) => ({ ...v, remarks: e.target.value }))} />
          </Field>
          <button disabled={Boolean(busyAction)} className="min-h-11 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 ms-auto">
            {busyAction === "validation"
              ? "Saving…"
              : validation.result === "confirmed"
                ? "Mark as Confirmed"
                : validation.result === "probable"
                  ? "Mark as Probable"
                  : "Mark as Not Confirmed"}
          </button>
        </form>
      )}
    </div>
  );
}

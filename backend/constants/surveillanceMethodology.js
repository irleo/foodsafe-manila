export const SURVEILLANCE_DISEASES = Object.freeze([
  "Typhoid and Paratyphoid",
  "Rotavirus",
  "Cholera",
  "Acute Bloody Diarrhea",
]);

const DISEASE_ALIASES = new Map([
  ["typhoid and paratyphoid", "Typhoid and Paratyphoid"],
  ["typhoid/paratyphoid", "Typhoid and Paratyphoid"],
  ["typhoid", "Typhoid and Paratyphoid"],
  ["paratyphoid", "Typhoid and Paratyphoid"],
  ["rotavirus", "Rotavirus"],
  ["rotavirus infection", "Rotavirus"],
  ["cholera", "Cholera"],
  ["acute bloody diarrhea", "Acute Bloody Diarrhea"],
  ["acute bloody diarrhoea", "Acute Bloody Diarrhea"],
  ["abd", "Acute Bloody Diarrhea"],
]);

export const CASE_DEFINITION_RULES = Object.freeze({
  "Typhoid and Paratyphoid": Object.freeze({
    includedStatuses: Object.freeze(["suspected", "probable", "confirmed"]),
    probableEvidenceTypes: Object.freeze([
      "typhoid_rdt_positive",
      "epidemiological_link_to_confirmed_outbreak_case",
    ]),
  }),
  Rotavirus: Object.freeze({
    includedStatuses: Object.freeze(["suspected", "confirmed"]),
    probableEvidenceTypes: Object.freeze([]),
  }),
  Cholera: Object.freeze({
    includedStatuses: Object.freeze(["suspected", "probable", "confirmed"]),
    probableEvidenceTypes: Object.freeze(["cholera_rdt_positive"]),
  }),
  "Acute Bloody Diarrhea": Object.freeze({
    includedStatuses: Object.freeze(["suspected", "confirmed"]),
    probableEvidenceTypes: Object.freeze([]),
  }),
});

export const PROBABLE_EVIDENCE_LABELS = Object.freeze({
  typhoid_rdt_positive: "Positive typhoid rapid diagnostic test",
  epidemiological_link_to_confirmed_outbreak_case:
    "Epidemiological link to a confirmed outbreak case",
  cholera_rdt_positive: "Positive cholera rapid diagnostic test",
});

export function normalizeSurveillanceDisease(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!normalized) return null;
  return DISEASE_ALIASES.get(normalized.toLowerCase()) || null;
}

export function caseDefinitionForDisease(value) {
  const disease = normalizeSurveillanceDisease(value);
  return disease ? CASE_DEFINITION_RULES[disease] : null;
}

export function includedStatusesForDisease(value) {
  return caseDefinitionForDisease(value)?.includedStatuses || [];
}

export function probableEvidenceTypesForDisease(value) {
  return caseDefinitionForDisease(value)?.probableEvidenceTypes || [];
}

export function isClassificationEligibleForDisease(disease, classification) {
  const status = String(classification || "").trim().toLowerCase();
  return includedStatusesForDisease(disease).includes(status);
}

export function validateProbableClassification(disease, evidenceType) {
  const canonicalDisease = normalizeSurveillanceDisease(disease);
  if (!canonicalDisease) {
    return { ok: false, message: "Select a supported surveillance disease first." };
  }
  const allowedEvidence = probableEvidenceTypesForDisease(canonicalDisease);
  if (!allowedEvidence.length) {
    return {
      ok: false,
      message: `Probable classification is not defined for ${canonicalDisease}.`,
    };
  }
  const normalizedEvidence = String(evidenceType || "").trim().toLowerCase();
  if (!allowedEvidence.includes(normalizedEvidence)) {
    return {
      ok: false,
      message: `Select valid probable-case evidence for ${canonicalDisease}.`,
    };
  }
  return { ok: true, disease: canonicalDisease, evidenceType: normalizedEvidence };
}


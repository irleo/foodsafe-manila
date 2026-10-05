// @ts-check
import { readFileSync } from "node:fs";

/** @typedef {'privacy' | 'terms' | 'reporting' | 'location'} PolicyType */
/** @typedef {{type: PolicyType, title: string, version: string, requiredVersion: string, status: 'pending_review' | 'testing' | 'published', text: string}} Policy */
/** @typedef {{accepted: boolean, version: string}} PolicyChoice */
/** @typedef {{terms?: PolicyChoice, privacy?: PolicyChoice}} PolicyChoices */

const version = "2026-10-05.testing.2";

/** @type {Record<PolicyType, Policy>} */
export const mobilePolicies = {
  privacy: {
    type: "privacy", title: "Privacy Policy", version, requiredVersion: version,
    status: "testing",
    text: readFileSync(new URL("./private-testing-privacy.md", import.meta.url), "utf8"),
  },
  terms: {
    type: "terms", title: "Terms of Use", version, requiredVersion: version,
    status: "testing",
    text: readFileSync(new URL("./private-testing-terms.md", import.meta.url), "utf8"),
  },
  reporting: {
    type: "reporting", title: "Before You Report", version: "2026-10-05.testing.3", requiredVersion: "2026-10-05.testing.3",
    status: "testing",
    text: readFileSync(new URL("./private-testing-reporting.md", import.meta.url), "utf8"),
  },
  location: {
    type: "location", title: "Before Using Location", version, requiredVersion: version,
    status: "testing",
    text: "Using location reads precise device coordinates to identify your district/barangay and provide nearby information during private testing. Reports send precise coordinates to the backend. Address lookup may use platform geocoding services; map tiles are requested from OpenStreetMap.\n\nLocation is optional for browsing public information. Continuing to device permission is separate from acknowledging the Privacy Policy or accepting Terms. You can decline, or disable location in the app's Privacy and Terms area. This stops future location reads, but does not delete coordinates in existing test reports. Contact the test organizer about those records.",
  },
};

// Private testing uses a separate opt-in for simulated reports and precise location.
/** @type {{lawfulBasis: string, consentRequired: boolean | null, consentText: string}} */
export const reportingProcessing = {
  lawfulBasis: "consent",
  consentRequired: true,
  consentText: "I consent to the use of my simulated test report, account reference, and precise location for this private testing activity. I can skip reporting and contact the test organizer to withdraw this consent.",
};

/** @param {Policy} policy */
export function policyAvailable(policy) {
  return policy.status === "testing" || policy.status === "published";
}

export function publicMobilePolicies() {
  return { policies: Object.values(mobilePolicies), reportingProcessing };
}

/** @param {unknown} choices @param {Record<PolicyType, Policy>} [registry] */
export function validatePolicyChoices(choices, registry = mobilePolicies) {
  const value = choices && typeof choices === "object" ? /** @type {PolicyChoices} */ (choices) : {};
  for (const type of /** @type {const} */ (["terms", "privacy"])) {
    const choice = value[type];
    if (!choice || choice.accepted !== true || choice.version !== registry[type].version) {
      return { status: 400, code: "POLICY_ACCEPTANCE_REQUIRED", message: "Accept the current Terms and acknowledge the Privacy Policy." };
    }
  }
  if ([registry.terms, registry.privacy].some((policy) => !policyAvailable(policy))) {
    return { status: 503, code: "POLICIES_PENDING_REVIEW", message: "Account policies are awaiting approval. Account creation and policy acceptance are unavailable." };
  }
  return null;
}

/** @param {unknown} snapshot @param {Record<PolicyType, Policy>} [registry] */
export function hasRequiredPolicies(snapshot, registry = mobilePolicies) {
  const value = /** @type {{terms?: {version?: string}, privacy?: {version?: string}} | null} */ (snapshot);
  return policyAvailable(registry.terms) && policyAvailable(registry.privacy)
    && [registry.terms.requiredVersion, registry.terms.version].includes(value?.terms?.version || "")
    && [registry.privacy.requiredVersion, registry.privacy.version].includes(value?.privacy?.version || "");
}

/**
 * @param {unknown} choices
 * @param {Record<PolicyType, Policy>} [registry]
 * @param {{lawfulBasis: string, consentRequired: boolean | null, consentText: string}} [processing]
 */
export function validateReportingChoices(choices, registry = mobilePolicies, processing = reportingProcessing) {
  const value = /** @type {{version?: string, acknowledged?: boolean, locationVersion?: string, locationAcknowledged?: boolean, healthConsent?: boolean} | null} */ (choices);
  if (!policyAvailable(registry.reporting) || !policyAvailable(registry.location)
      || processing.lawfulBasis === "pending_review" || typeof processing.consentRequired !== "boolean"
      || (processing.consentRequired && !processing.consentText.trim())) {
    return { status: 503, code: "REPORTING_POLICY_PENDING_REVIEW", message: "Reporting disclosures are awaiting approval. Please do not submit health information." };
  }
  if (value?.acknowledged !== true || value.version !== registry.reporting.version
      || value.locationAcknowledged !== true || value.locationVersion !== registry.location.version
      || (processing.consentRequired && value.healthConsent !== true)) {
    return { status: 400, code: "REPORT_DISCLOSURE_REQUIRED", message: "Review the current reporting and location disclosures before submitting." };
  }
  return null;
}

/**
 * @param {unknown} snapshot
 * @param {Record<PolicyType, Policy>} [registry]
 * @param {{lawfulBasis: string, consentRequired: boolean | null, consentText: string}} [processing]
 */
export function hasRequiredReportingAcceptance(snapshot, registry = mobilePolicies, processing = reportingProcessing) {
  const value = /** @type {{version?: string, locationVersion?: string, acceptedAt?: Date, lawfulBasis?: string, healthConsent?: boolean} | null} */ (snapshot);
  return value?.acceptedAt instanceof Date && Number.isFinite(value.acceptedAt.getTime())
    && value.lawfulBasis === processing.lawfulBasis
    && validateReportingChoices({ ...value, acknowledged: true, locationAcknowledged: true }, registry, processing) === null;
}

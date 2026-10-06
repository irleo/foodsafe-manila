import MobileUser from "../models/MobileUser.js";
import { hasRequiredPolicies, hasRequiredReportingAcceptance, publicMobilePolicies, validatePolicyChoices, validateReportingChoices } from "../policies/mobilePolicies.js";
import { acknowledgeMobilePolicies, acknowledgeReportingPolicies } from "../services/mobilePolicyService.js";
import { sanitizeMobileUser } from "../utils/citizenAuth.js";
import { logRequestError } from "../utils/serverLogger.js";

export const getMobilePolicies = (_req, res) => res.json(publicMobilePolicies());

export const getMobilePolicyStatus = async (req, res) => {
  try {
    const user = await MobileUser.findById(req.user.id).select("policyAcceptance reportingAcceptance").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ acceptance: user.policyAcceptance || null, requiresAcknowledgement: !hasRequiredPolicies(user.policyAcceptance), reportingAcceptance: user.reportingAcceptance || null, requiresReportingAcknowledgement: !hasRequiredReportingAcceptance(user.reportingAcceptance) });
  } catch (error) {
    logRequestError(error, req, "POLICY_STATUS_ERROR");
    return res.status(500).json({ message: "Policy status could not be loaded." });
  }
};

export const acceptMobilePolicies = async (req, res) => {
  const failure = validatePolicyChoices(req.body?.policyAcceptance);
  if (failure) return res.status(failure.status).json(failure);
  try {
    const user = await acknowledgeMobilePolicies(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json(sanitizeMobileUser(user));
  } catch (error) {
    logRequestError(error, req, "POLICY_ACCEPTANCE_ERROR");
    return res.status(500).json({ message: "Policy acknowledgement could not be saved." });
  }
};

export const requireCurrentMobilePolicies = async (req, res, next) => {
  try {
    const user = await MobileUser.findById(req.user.id).select("policyAcceptance reportingAcceptance").lean();
    if (!hasRequiredPolicies(user?.policyAcceptance)) {
      return res.status(409).json({ code: "POLICY_REACCEPTANCE_REQUIRED", message: "Review and acknowledge the current account policies before continuing." });
    }
    req.mobilePolicyAcceptance = user.policyAcceptance;
    req.mobileReportingAcceptance = user.reportingAcceptance;
    next();
  } catch (error) {
    logRequestError(error, req, "POLICY_REQUIREMENT_ERROR");
    return res.status(503).json({ code: "POLICY_CHECK_UNAVAILABLE", message: "Policy requirements could not be checked." });
  }
};

export const acceptReportingPolicies = async (req, res) => {
  const failure = validateReportingChoices(req.body?.reportDisclosure);
  if (failure) return res.status(failure.status).json(failure);
  try {
    const user = await acknowledgeReportingPolicies(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ reportingAcceptance: user.reportingAcceptance });
  } catch (error) {
    logRequestError(error, req, "REPORTING_ACCEPTANCE_ERROR");
    return res.status(500).json({ message: "Reporting consent could not be saved." });
  }
};

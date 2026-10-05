import MobileUser from "../models/MobileUser.js";
import { hasRequiredPolicies, publicMobilePolicies, validatePolicyChoices } from "../policies/mobilePolicies.js";
import { acknowledgeMobilePolicies } from "../services/mobilePolicyService.js";
import { sanitizeMobileUser } from "../utils/citizenAuth.js";
import { logRequestError } from "../utils/serverLogger.js";

export const getMobilePolicies = (_req, res) => res.json(publicMobilePolicies());

export const getMobilePolicyStatus = async (req, res) => {
  try {
    const user = await MobileUser.findById(req.user.id).select("policyAcceptance").lean();
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ acceptance: user.policyAcceptance || null, requiresAcknowledgement: !hasRequiredPolicies(user.policyAcceptance) });
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
    const user = await MobileUser.findById(req.user.id).select("policyAcceptance").lean();
    if (!hasRequiredPolicies(user?.policyAcceptance)) {
      return res.status(409).json({ code: "POLICY_REACCEPTANCE_REQUIRED", message: "Review and acknowledge the current account policies before continuing." });
    }
    req.mobilePolicyAcceptance = user.policyAcceptance;
    next();
  } catch (error) {
    logRequestError(error, req, "POLICY_REQUIREMENT_ERROR");
    return res.status(503).json({ message: "Policy requirements could not be checked." });
  }
};

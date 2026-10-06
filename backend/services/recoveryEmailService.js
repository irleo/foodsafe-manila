// @ts-check
import MobileUser from "../models/MobileUser.js";
import MobileEmailOtp from "../models/MobileEmailOtp.js";
import { normalizePhone } from "../utils/citizenAuth.js";
import { EMAIL_RECOVERY_ACCOUNT_INDEX } from "../utils/recoveryEmail.js";

/** @returns {Promise<boolean>} */
export async function emailRecoveryIndexReady() {
  try {
    const indexes = await MobileEmailOtp.collection.indexes();
    return indexes.some((index) => index.name === EMAIL_RECOVERY_ACCOUNT_INDEX
      && index.unique === true && index.key.userId === 1 && index.key.purpose === 1
      && Object.keys(index.key).length === 2
      && index.partialFilterExpression?.flowIdHash?.$type === "string");
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code === 26) return false;
    throw error;
  }
}

/** @param {string} phone */
export async function findRecoveryAccount(phone) {
  // Lookup alone never authorizes a reset; the recovery OTP proves ownership.
  return MobileUser.findOne({ phoneNumber: normalizePhone(phone) })
    .select("_id phoneNumber email tokenVersion emailVersion").lean();
}

/** @param {{userId: string, originalEmail: string, emailVersion: number, passwordHash: string, username: string, email: string}} input */
export async function updateRecoveryEmail({ userId, originalEmail, emailVersion, passwordHash, username, email }) {
  return MobileUser.findOneAndUpdate({ _id: userId, email: originalEmail, emailVersion, password: passwordHash },
    { $set: { username, email, emailVerified: false }, $inc: { emailVersion: 1 }, $unset: { emailVerifiedAt: "" } },
    { new: true, runValidators: true });
}

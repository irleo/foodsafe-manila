// @ts-check
import MobileUser from "../models/MobileUser.js";
import { normalizeRecoveryEmail, RECOVERY_EMAIL_INDEX } from "../utils/recoveryEmail.js";

/** @returns {Promise<boolean>} */
export async function recoveryEmailIndexReady() {
  try {
    const indexes = await MobileUser.collection.indexes();
    return indexes.some((index) => index.name === RECOVERY_EMAIL_INDEX
      && index.unique === true && index.key.email === 1
      && Object.keys(index.key).length === 1
      && index.partialFilterExpression?.email?.$type === "string"
      && index.partialFilterExpression?.email?.$gt === "");
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code === 26) return false;
    throw error;
  }
}

export async function requireRecoveryEmailIndex() {
  if (!await recoveryEmailIndexReady()) {
    throw Object.assign(new Error("Recovery email setup is not complete. Use phone recovery for now."),
      { status: 503, code: "RECOVERY_EMAIL_SETUP_REQUIRED" });
  }
}

/** @param {string} email @param {string | import('mongoose').Types.ObjectId} [excludeUserId] */
export async function recoveryEmailTaken(email, excludeUserId) {
  return Boolean(await MobileUser.exists({
    email: normalizeRecoveryEmail(email),
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  }));
}

/** @param {string} email */
export async function findRecoveryAccount(email) {
  // Lookup alone never authorizes a reset; the recovery OTP proves ownership.
  return MobileUser.findOne({ email: normalizeRecoveryEmail(email) })
    .select("_id email tokenVersion emailVersion").lean();
}

/** @param {{userId: string, originalEmail: string, emailVersion: number, passwordHash: string, username: string, email: string}} input */
export async function updateRecoveryEmail({ userId, originalEmail, emailVersion, passwordHash, username, email }) {
  return MobileUser.findOneAndUpdate({ _id: userId, email: originalEmail, emailVersion, password: passwordHash },
    { $set: { username, email, emailVerified: false }, $inc: { emailVersion: 1 }, $unset: { emailVerifiedAt: "" } },
    { new: true, runValidators: true });
}

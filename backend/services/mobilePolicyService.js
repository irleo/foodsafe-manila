import mongoose from "mongoose";
import MobileUser from "../models/MobileUser.js";
import PolicyAcceptance from "../models/PolicyAcceptance.js";
import { mobilePolicies } from "../policies/mobilePolicies.js";

/** @typedef {{version: string, acceptedAt: Date}} PolicyReceipt */
/** @typedef {{terms: PolicyReceipt, privacy: PolicyReceipt}} AccountPolicySnapshot */
/** @typedef {{username: string, phoneNumber: string, password: string, email?: string}} MobileAccountFields */

/** @param {Date} [acceptedAt] @returns {AccountPolicySnapshot} */
export function policySnapshot(acceptedAt = new Date()) {
  return {
    terms: { version: mobilePolicies.terms.version, acceptedAt },
    privacy: { version: mobilePolicies.privacy.version, acceptedAt },
  };
}

/** @param {mongoose.Types.ObjectId} userId @param {AccountPolicySnapshot} snapshot @param {mongoose.ClientSession} session */
async function saveReceipts(userId, snapshot, session) {
  await PolicyAcceptance.bulkWrite(Object.entries(snapshot).map(([type, record]) => ({
    updateOne: {
      filter: { userId, policyType: type, policyVersion: record.version },
      update: { $setOnInsert: { acceptedAt: record.acceptedAt, action: type === "terms" ? "accepted" : "acknowledged" } },
      upsert: true,
    },
  })), { session });
}

// User creation and acceptance evidence must commit together; requires a replica set.
/** @param {MobileAccountFields} fields */
export async function createMobileUserWithPolicies(fields) {
  return mongoose.connection.transaction(async (session) => {
    const snapshot = policySnapshot();
    const [user] = await MobileUser.create([{ ...fields, policyAcceptance: snapshot }], { session });
    await saveReceipts(user._id, snapshot, session);
    return user;
  });
}

/** @param {string} userId */
export async function acknowledgeMobilePolicies(userId) {
  return mongoose.connection.transaction(async (session) => {
    const snapshot = policySnapshot();
    const user = await MobileUser.findByIdAndUpdate(userId,
      { $set: { policyAcceptance: snapshot } }, { new: true, session, runValidators: true });
    if (!user) return null;
    await saveReceipts(user._id, snapshot, session);
    return user;
  });
}

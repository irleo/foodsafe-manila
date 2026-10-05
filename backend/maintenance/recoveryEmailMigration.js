// @ts-check
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { isValidRecoveryEmail, normalizeRecoveryEmail, RECOVERY_EMAIL_INDEX } from "../utils/recoveryEmail.js";

/** @typedef {{_id: import('mongoose').Types.ObjectId, email?: unknown, emailVerified?: boolean, emailVerifiedAt?: Date, emailVersion?: number}} LegacyAccount */
export const normalizedEmailExpression = {
  $toLower: { $trim: { input: { $cond: [{ $eq: [{ $type: "$email" }, "string"] }, "$email", ""] } } },
};

/** @param {LegacyAccount} account */
export function normalizedAccountUpdate(account) {
  const email = isValidRecoveryEmail(account.email) ? normalizeRecoveryEmail(account.email) : "";
  const verified = Boolean(email && email === account.email
    && account.emailVerified === true && account.emailVerifiedAt instanceof Date);
  const unchanged = email === account.email && verified === account.emailVerified
    && Number.isInteger(account.emailVersion) && (!verified ? !account.emailVerifiedAt : true);
  if (unchanged) return null;
  const update = {
    $set: { email, emailVerified: verified, emailVersion: (account.emailVersion || 0) + 1 },
    ...(!verified ? { $unset: { emailVerifiedAt: "" } } : {}),
  };
  return { updateOne: { filter: { _id: account._id, email: account.email ?? null }, update } };
}

/** @param {import('mongoose').mongo.Collection} collection @param {{apply: boolean, createIndex: boolean}} options */
export async function migrateRecoveryEmails(collection, { apply, createIndex }) {
  const summary = { duplicateGroups: 0, conflictedAccounts: 0, accountsNeedingNormalization: 0, applied: apply, indexCreated: false };
  // Group by normalized value without collecting unbounded arrays of account IDs.
  const groups = collection.aggregate([
    { $project: { normalized: normalizedEmailExpression } },
    { $match: { normalized: { $ne: "" } } },
    { $group: { _id: "$normalized", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ], { allowDiskUse: true, batchSize: 100 });
  try {
    for await (const group of groups) {
      summary.duplicateGroups++;
      summary.conflictedAccounts += group.count;
      if (apply) {
        // Never choose a winner or merge accounts. Unlink every conflicting email.
        await collection.updateMany({ $expr: { $eq: [normalizedEmailExpression, group._id] } },
          { $set: { email: "", emailVerified: false }, $unset: { emailVerifiedAt: "" }, $inc: { emailVersion: 1 } });
      }
    }
  } finally {
    await groups.close();
  }
  const cursor = collection.find({}, { projection: { _id: 1, email: 1, emailVerified: 1, emailVerifiedAt: 1, emailVersion: 1 } }).batchSize(200);
  /** @type {ReturnType<typeof normalizedAccountUpdate>[]} */
  let batch = [];
  try {
    for await (const record of cursor) {
      const operation = normalizedAccountUpdate(/** @type {LegacyAccount} */ (record));
      if (!operation) continue;
      summary.accountsNeedingNormalization++;
      if (apply) batch.push(operation);
      if (batch.length === 200) {
        await collection.bulkWrite(/** @type {import('mongoose').mongo.AnyBulkWriteOperation[]} */ (batch), { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await collection.bulkWrite(/** @type {import('mongoose').mongo.AnyBulkWriteOperation[]} */ (batch), { ordered: true });
  } finally {
    await cursor.close();
  }
  if (createIndex) {
    if (!apply && (summary.duplicateGroups || summary.accountsNeedingNormalization)) {
      throw new Error("Resolve duplicates and normalization first with an approved --apply run.");
    }
    await collection.createIndex({ email: 1 }, { unique: true, name: RECOVERY_EMAIL_INDEX,
      partialFilterExpression: { email: { $type: "string", $gt: "" } } });
    summary.indexCreated = true;
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const createIndex = args.includes("--create-index");
  const position = args.indexOf("--confirm-database");
  const database = position >= 0 ? args[position + 1] : undefined;
  if ((apply || createIndex) && !database) throw new Error("Writes require --confirm-database <exact-name> and a maintenance window.");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Provide MONGO_URI or MONGODB_URI explicitly. No environment files are automatically loaded.");
  try {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
    if (database && mongoose.connection.name !== database) throw new Error("Database confirmation does not match the connected database.");
    const collection = mongoose.connection.collection("mobileUsers");
    console.log(JSON.stringify(await migrateRecoveryEmails(collection, { apply, createIndex }), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Recovery email maintenance failed.");
    process.exitCode = 1;
  });
}

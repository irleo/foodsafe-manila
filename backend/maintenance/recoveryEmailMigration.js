// @ts-check
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { isValidRecoveryEmail, normalizeRecoveryEmail, EMAIL_RECOVERY_ACCOUNT_INDEX } from "../utils/recoveryEmail.js";

/** @typedef {{_id: import('mongoose').Types.ObjectId, email?: unknown, emailVerified?: boolean, emailVerifiedAt?: Date, emailVersion?: number}} LegacyAccount */
/** @param {LegacyAccount} account */
export function normalizedAccountUpdate(account) {
  const email = isValidRecoveryEmail(account.email) ? normalizeRecoveryEmail(account.email) : "";
  const verified = Boolean(email && email === account.email && account.emailVerified === true && account.emailVerifiedAt instanceof Date);
  if (email === account.email && verified === account.emailVerified && Number.isSafeInteger(account.emailVersion)
      && account.emailVersion >= 0 && (verified || !account.emailVerifiedAt)) return null;
  return { updateOne: { filter: { _id: account._id, email: account.email ?? null }, update: {
    $set: { email, emailVerified: verified,
      emailVersion: (Number.isSafeInteger(account.emailVersion) && Number(account.emailVersion) >= 0 ? Number(account.emailVersion) : 0) + 1 },
    ...(!verified ? { $unset: { emailVerifiedAt: "" } } : {}),
  } } };
}

/** @param {import('mongoose').mongo.Collection} collection */
async function indexes(collection) {
  try {
    return await collection.indexes();
  } catch (error) {
    if (/** @type {{code?: number}} */ (error).code === 26) return [];
    throw error;
  }
}

/** @param {import('mongoose').mongo.Collection} collection @param {{apply: boolean, otpCollection: import('mongoose').mongo.Collection}} options */
export async function migrateRecoveryEmails(collection, { apply, otpCollection }) {
  const userIndexes = await indexes(collection);
  const otpIndexes = await indexes(otpCollection);
  if (!userIndexes.some((index) => index.unique === true && index.key.phoneNumber === 1 && Object.keys(index.key).length === 1)) {
    throw new Error("The phone-number unique index must exist before this migration.");
  }
  const emailIndexes = userIndexes.filter((index) => index.unique === true && index.key.email === 1 && Object.keys(index.key).length === 1);
  const oldOtpIndexes = otpIndexes.filter((index) => index.unique === true && index.key.email === 1 && index.key.purpose === 1 && Object.keys(index.key).length === 2);
  const existingScope = otpIndexes.find((index) => index.name === EMAIL_RECOVERY_ACCOUNT_INDEX);
  if (existingScope && !(existingScope.unique === true && existingScope.key.userId === 1 && existingScope.key.purpose === 1
      && Object.keys(existingScope.key).length === 2 && existingScope.partialFilterExpression?.flowIdHash?.$type === "string")) {
    throw new Error("The account-scoped OTP index has unexpected options. Review it before applying.");
  }
  const summary = { applied: apply, emailIndexesToDrop: emailIndexes.map((index) => index.name),
    otpIndexesToDrop: oldOtpIndexes.map((index) => index.name), accountsNeedingNormalization: 0,
    otpIndexCreated: false, indexesDropped: 0 };
  if (apply) {
    // Legacy challenges have no flowIdHash and are deliberately excluded and unusable.
    if (!existingScope) {
      await otpCollection.createIndex({ userId: 1, purpose: 1 }, { unique: true, name: EMAIL_RECOVERY_ACCOUNT_INDEX,
        partialFilterExpression: { flowIdHash: { $type: "string" } } });
      summary.otpIndexCreated = true;
    }
    for (const index of oldOtpIndexes) {
      if (!index.name) throw new Error("An OTP index has no name.");
      await otpCollection.dropIndex(index.name);
      summary.indexesDropped++;
    }
    for (const index of emailIndexes) {
      if (!index.name) throw new Error("An email index has no name.");
      await collection.dropIndex(index.name);
      summary.indexesDropped++;
    }
  }
  const cursor = collection.find({}, { projection: { _id: 1, email: 1, emailVerified: 1, emailVerifiedAt: 1, emailVersion: 1 } }).batchSize(200);
  /** @type {import('mongoose').mongo.AnyBulkWriteOperation[]} */
  let batch = [];
  try {
    for await (const record of cursor) {
      const operation = normalizedAccountUpdate(/** @type {LegacyAccount} */ (record));
      if (!operation) continue;
      summary.accountsNeedingNormalization++;
      if (apply) batch.push(operation);
      if (batch.length === 200) {
        await collection.bulkWrite(batch, { ordered: true });
        batch = [];
      }
    }
    if (batch.length) await collection.bulkWrite(batch, { ordered: true });
  } finally {
    await cursor.close();
  }
  return summary;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--create-index")) throw new Error("--create-index is retired: recovery emails are shared, not unique.");
  const apply = args.includes("--apply");
  const position = args.indexOf("--confirm-database");
  const database = position >= 0 ? args[position + 1] : undefined;
  if (apply && !database) throw new Error("Writes require --confirm-database <exact-name> and paused account activity.");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Provide MONGO_URI explicitly. Environment files are not automatically loaded.");
  try {
    await mongoose.connect(uri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10_000 });
    if (database && mongoose.connection.name !== database) throw new Error("Database confirmation does not match the connected database.");
    console.log(JSON.stringify(await migrateRecoveryEmails(mongoose.connection.collection("mobileUsers"), {
      apply, otpCollection: mongoose.connection.collection("mobileEmailOtps"),
    }), null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "Recovery email maintenance failed.";
    console.error(message.replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[database URI hidden]"));
    process.exitCode = 1;
  });
}

import mongoose from "mongoose";

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    const maxPoolSize = positiveInteger(process.env.MONGO_MAX_POOL_SIZE, 10);
    const minPoolSize = Math.min(
      maxPoolSize,
      positiveInteger(process.env.MONGO_MIN_POOL_SIZE, 1),
    );
    const serverSelectionTimeoutMS = positiveInteger(
      process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
      10_000,
    );

    const conn = await mongoose.connect(mongoUri, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log(
      `MongoDB pool configured: min=${minPoolSize}, max=${maxPoolSize}`,
    );
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
}

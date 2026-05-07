import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import reportRoutes from "./routes/reports.js";
import datasetRoutes from "./routes/datasets.js";
import analyticsRouter from "./routes/analytics.js";
import casesRouter from "./routes/cases.js";
import heatmapRouter from "./routes/heatmap.js";
import activityRoutes from "./routes/activity.js";
import notificationRouter from "./routes/notifications.js";
import healthRouter from "./routes/health.js";
import predictionsRouter from "./routes/predictions.js";

import { connectDB } from "./config/db.js";
import { registerPredictionCron } from "./jobs/predictionCron.js";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

dotenv.config();
const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const allowedOrigins =
  allowedOriginsEnv.length > 0
    ? allowedOriginsEnv
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:5100"];

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(
  cors({
    origin: (origin, cb) => {
      console.log("CORS origin:", origin, "Allowed:", allowedOrigins);
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// RATE LIMIT
app.set("trust proxy", 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // general API 
  standardHeaders: true,
  legacyHeaders: false,
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // brute-force protection
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Please try again later.",
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300, // allow refresh to work reliably
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLoginLimiter);
app.use("/api/auth/refresh", refreshLimiter);

app.use(cookieParser()); // Middleware to parse cookies

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/analytics", analyticsRouter);

app.use("/api/cases", casesRouter);
app.use("/api/heatmap", heatmapRouter);
app.use("/api/activity", activityRoutes);
app.use("/api/notifications", notificationRouter);
app.use("/api/health", healthRouter);
app.use("/api/predictions", predictionsRouter);

connectDB();
registerPredictionCron();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

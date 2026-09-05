import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

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
import mobileRouter from "./routes/mobile.js";
import thresholdRouter from "./routes/thresholds.js";

import { connectDB } from "./config/db.js";
import { registerPredictionCron } from "./jobs/predictionCron.js";
import {
  monitorRequestPerformance,
  startProcessMemoryMonitor,
} from "./middleware/performanceMonitoring.js";
import {
  errorHandler,
  notFoundHandler,
  requestContext,
  standardizeErrorResponses,
} from "./middleware/errorHandler.js";
import { ErrorCodes } from "./errors/errorCodes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
app.disable("x-powered-by");

const allowedOriginsEnv = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowedOrigins =
  allowedOriginsEnv.length > 0
    ? allowedOriginsEnv
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5100",
        "http://localhost:3000",
      ];

// Middleware
app.use(requestContext);
app.use(standardizeErrorResponses);
app.use(express.json());
app.use(cookieParser());
app.use(monitorRequestPerformance);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);

      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

// Required if deployed behind one proxy/load balancer
app.set("trust proxy", 1);

// Rate limiters
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many requests. Please try again later.",
  },
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many login attempts. Please try again later.",
  },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    code: ErrorCodes.RATE_LIMITED,
    message: "Too many session refresh requests. Please try again later.",
  },
});

// Limits first
app.use("/api/auth/login", authLoginLimiter);
app.use("/api/auth/refresh", refreshLimiter);
app.use("/api", apiLimiter);

// Health/root route
app.get("/", (req, res) => {
  res.json({
    message: "Food Safe API is running",
  });
});

// API routes
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
app.use("/api/thresholds", thresholdRouter);
app.use("/api", mobileRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();

    registerPredictionCron();
    startProcessMemoryMonitor();

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

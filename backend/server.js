import express from "express";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import reportRoutes from "./routes/reports.js";
import datasetRoutes from "./routes/datasets.js";
import analyticsRouter from "./routes/analytics.js";
import casesRouter from "./routes/cases.js";
import heatmapRouter from "./routes/heatmap.js";

import { connectDB } from "./config/db.js";
import cors from "cors";
import cookieParser from "cookie-parser";

const allowedOrigins = ["http://localhost:5173", "http://localhost:5100"];
dotenv.config();

const PORT = process.env.PORT || 5000;

const app = express();

app.use(express.json()); // Middleware to parse JSON bodies
app.use(
  cors({
    origin: (origin, cb) => {
      // allow tools like Postman/no-origin requests too
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(cookieParser()); // Middleware to parse cookies

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/datasets", datasetRoutes);
app.use("/api/analytics", analyticsRouter);

app.use("/api/cases", casesRouter);
app.use("/api/heatmap", heatmapRouter);

connectDB();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

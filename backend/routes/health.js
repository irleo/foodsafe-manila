import express from "express";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "food-safe-backend",
    timestamp: new Date().toISOString(),
  });
});

export default router;

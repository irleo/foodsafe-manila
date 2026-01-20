import express from "express";
import { verifyRole, verifyToken } from "../middleware/authMiddleware.js";
import {
  getUsers,
  getUserStats,
  updateUserStatus,
  deleteUser,
  getProfile,
} from "../controllers/userController.js";

const router = express.Router();

/**
 * ADMIN ROUTES
 */

// Fetch users
// Supports: ?status=pending|approved|rejected|all
// Supports: ?page=1&limit=6&search=query
router.get("/", verifyToken, verifyRole("admin"), getUsers);

// Stats for dashboard cards
router.get("/stats", verifyToken, verifyRole("admin"), getUserStats);

// Approve / Reject user
// Body: { status: "approved" | "rejected" }
router.patch("/:id/status", verifyToken, verifyRole("admin"), updateUserStatus);

// Delete user (non-admin only)
router.delete("/:id", verifyToken, verifyRole("admin"), deleteUser);

/**
 * USER ROUTES
 */

// Logged-in user's profile
router.get("/me", verifyToken, getProfile);

export default router;

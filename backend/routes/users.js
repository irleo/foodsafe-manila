import express from "express";
import { verifyRole, verifyToken } from "../middleware/authMiddleware.js";
import {
  getUsers,
  getUserStats,
  updateUserStatus,
  deleteUser,
  getProfile,
  updateUserAccess,
} from "../controllers/userController.js";
import { updateMobileProfile } from "../controllers/mobileUserController.js";

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
router.patch("/:id/access", verifyToken, verifyRole("admin"), updateUserAccess);

// Delete user (non-admin only)
router.delete("/:id", verifyToken, verifyRole("admin"), deleteUser);

/**
 * USER ROUTES
 */

// Logged-in user's profile
router.get("/me", verifyToken, getProfile);

// Citizen mobile profile update
router.put("/:id", verifyToken, updateMobileProfile);

export default router;

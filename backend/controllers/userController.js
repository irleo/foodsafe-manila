import User from "../models/WebUser.js";
import { logActivity } from "../utils/logActivity.js";

const ASSIGNABLE_ROLES = new Set(["cesu", "surveillance_team"]);
const GOVERNMENT_EMAIL_PATTERN = /^[^\s@]+@(?:[a-z0-9-]+\.)*gov\.ph$/i;

function withEmailDomainReview(user) {
  const isGovernmentEmail = GOVERNMENT_EMAIL_PATTERN.test(user?.email || "");
  return {
    ...user,
    isGovernmentEmail,
    emailReviewStatus: isGovernmentEmail
      ? "government_domain"
      : "manual_review_required",
  };
}

/**
 * GET /api/users?page=1&limit=6&status=pending&search=juan
 * status: pending | approved | rejected | all (default: all)
 */
export const getUsers = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "6", 10), 1), 50);
    const skip = (page - 1) * limit;

    const status = (req.query.status || "all").trim();
    const search = (req.query.search || "").trim();

    const query = {};

    if (status === "managed") {
      query.status = { $in: ["approved", "suspended"] };
    } else if (status !== "all") {
      query.status = status; // pending/approved/rejected
    }

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { organization: { $regex: search, $options: "i" } },
        { position: { $regex: search, $options: "i" } },
      ];
    }

    const total = await User.countDocuments(query);

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      users: users.map(withEmailDomainReview),
      total,
      totalPages: Math.ceil(total / limit) || 1,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /api/users/stats
 * returns counts for cards
 */
export const getUserStats = async (req, res) => {
  try {
    const [pending, approved, rejected, suspended] = await Promise.all([
      User.countDocuments({ status: "pending" }),
      User.countDocuments({ status: "approved" }),
      User.countDocuments({ status: "rejected" }),
      User.countDocuments({ status: "suspended" }),
    ]);

    res.status(200).json({ pending, approved, rejected, suspended });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PATCH /api/users/:id/status
 * body: { status: "approved" } or { status: "rejected" }
 */
export const updateUserStatus = async (req, res) => {
  try {
    const {
      status,
      role,
      canAccessPatientIdentity = false,
      manualAffiliationConfirmed = false,
    } = req.body;

    if (!["approved", "rejected", "suspended"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const previousStatus = user.status;

    // optional safety: don't let admins be rejected accidentally
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot change the status of system administrators" });
    }

    if (status === "approved") {
      if (!ASSIGNABLE_ROLES.has(role)) {
        return res.status(400).json({ message: "Assign either the Data Manager or Surveillance Officer role before approval." });
      }
      if (
        !GOVERNMENT_EMAIL_PATTERN.test(user.email) &&
        manualAffiliationConfirmed !== true
      ) {
        return res.status(400).json({
          message:
            "Confirm that the applicant's affiliation was manually reviewed before approving a non-.gov.ph email.",
        });
      }
      user.role = role;
      user.canAccessPatientIdentity =
        role === "surveillance_team" && canAccessPatientIdentity === true;
      user.approvedAt = new Date();
      user.approvedBy = req.user?.id;
    } else if (status === "suspended") {
      if (user.status !== "approved") {
        return res.status(409).json({
          message: "Only active users can be suspended.",
        });
      }
    } else {
      user.role = "unassigned";
      user.canAccessPatientIdentity = false;
      user.approvedAt = undefined;
      user.approvedBy = undefined;
    }

    user.status = status;
    await user.save();

    const actionType =
      status === "suspended"
        ? "user_suspended"
        : status === "approved" && previousStatus === "suspended"
          ? "user_reactivated"
          : status === "approved"
            ? "user_approved"
            : "user_rejected";

    await logActivity({
      actor: req.user?.id,
      actionType,
      title:
        status === "approved"
          ? previousStatus === "suspended"
            ? "User reactivated"
            : "User approved"
          : status === "suspended"
            ? "User suspended"
            : "User rejected",
      subtitle: `${user.username} (${user.email}) was ${status}.`,
      metadata: {
        userId: user._id,
        status,
        role: user.role,
        emailReviewStatus: GOVERNMENT_EMAIL_PATTERN.test(user.email)
          ? "government_domain"
          : "manual_review_required",
        manualAffiliationConfirmed:
          !GOVERNMENT_EMAIL_PATTERN.test(user.email) &&
          manualAffiliationConfirmed === true,
      },
    });

    res.status(200).json({
      message: `User ${status} successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
        role: user.role,
        canAccessPatientIdentity: user.canAccessPatientIdentity,
        isGovernmentEmail: GOVERNMENT_EMAIL_PATTERN.test(user.email),
      },
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateUserAccess = async (req, res) => {
  try {
    const {
      role,
      canAccessPatientIdentity = false,
      manualAffiliationConfirmed = false,
    } = req.body;
    if (!ASSIGNABLE_ROLES.has(role)) {
      return res.status(400).json({ message: "Role must be Data Manager or Surveillance Officer." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(403).json({ message: "System Administrator access cannot be changed here." });
    if (user.status !== "approved") return res.status(409).json({ message: "Only active users can have access updated." });
    if (
      !GOVERNMENT_EMAIL_PATTERN.test(user.email) &&
      manualAffiliationConfirmed !== true
    ) {
      return res.status(400).json({
        message:
          "Confirm that the user's affiliation was manually reviewed before changing access for a non-.gov.ph email.",
      });
    }
    user.role = role;
    user.canAccessPatientIdentity =
      role === "surveillance_team" && canAccessPatientIdentity === true;
    await user.save();
    await logActivity({
      actor: req.user?.id,
      actionType: "user_access_updated",
      title: "User access updated",
      subtitle: `${user.username} was assigned to ${role}.`,
      metadata: {
        userId: user._id,
        role,
        canAccessPatientIdentity: user.canAccessPatientIdentity,
        emailReviewStatus: GOVERNMENT_EMAIL_PATTERN.test(user.email)
          ? "government_domain"
          : "manual_review_required",
        manualAffiliationConfirmed:
          !GOVERNMENT_EMAIL_PATTERN.test(user.email) &&
          manualAffiliationConfirmed === true,
      },
    });
    return res.json({
      message: "User access updated.",
      user: {
        id: user._id,
        role: user.role,
        canAccessPatientIdentity: user.canAccessPatientIdentity,
        isGovernmentEmail: GOVERNMENT_EMAIL_PATTERN.test(user.email),
      },
    });
  } catch (error) {
    console.error("Error updating user access:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete system administrators" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.status !== "approved") {
      return res.status(403).json({ message: "Account access is not active" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

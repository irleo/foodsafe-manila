import User from "../models/User.js";

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

    if (status !== "all") {
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
      .limit(limit);

    res.status(200).json({
      users,
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
    const [pending, approved, rejected] = await Promise.all([
      User.countDocuments({ status: "pending" }),
      User.countDocuments({ status: "approved" }),
      User.countDocuments({ status: "rejected" }),
    ]);

    res.status(200).json({ pending, approved, rejected });
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
    const { status } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // optional safety: don't let admins be rejected accidentally
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot change status of admin users" });
    }

    user.status = status;
    await user.save();

    res.status(200).json({
      message: `User ${status} successfully`,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin users" });
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
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};

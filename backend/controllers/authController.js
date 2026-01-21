import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// POST /api/auth/request-access
export const requestAccess = async (req, res) => {
  const { username, email, password, organization, position, reason } =
    req.body;

  if (
    !username ||
    !email ||
    !password ||
    !organization ||
    !position ||
    !reason
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (reason.length > 500) {
    return res
      .status(400)
      .json({ message: "Reason must be 500 characters or less" });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // More accurate + user-friendly conflict handling
      if (existingUser.status === "pending") {
        return res
          .status(409)
          .json({
            message:
              "An access request for this email is already pending approval.",
          });
      }

      if (existingUser.status === "approved") {
        return res
          .status(409)
          .json({
            message:
              "An account with this email already exists. Please sign in.",
          });
      }

      if (existingUser.status === "rejected") {
        // Option A: allow re-apply by updating the existing record (recommended)
        const hashedPassword = await bcrypt.hash(password, 10);

        existingUser.username = username.trim();
        existingUser.password = hashedPassword;
        existingUser.organization = organization.trim();
        existingUser.position = position.trim();
        existingUser.reason = reason.trim();
        existingUser.status = "pending";
        existingUser.approvedAt = undefined;
        existingUser.approvedBy = undefined;

        await existingUser.save();

        return res.status(200).json({
          message: "Access request resubmitted. Awaiting approval.",
          user: {
            id: existingUser._id,
            username: existingUser.username,
            email: existingUser.email,
            role: existingUser.role,
            status: existingUser.status,
          },
        });
      }
    }

    // Create new pending user
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      organization: organization.trim(),
      position: position.trim(),
      reason: reason.trim(),
      // status defaults to "pending"
    });

    await user.save();

    return res.status(201).json({
      message: "Access request submitted. Awaiting approval.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    // If two requests race at the same time, Mongo unique index on email can throw 11000
    if (error?.code === 11000) {
      return res
        .status(409)
        .json({
          message:
            "An account or access request with this email already exists.",
        });
    }
    console.error("Error requesting access:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    // Approval gate
    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          user.status === "pending"
            ? "Your access request is pending approval."
            : "Your access request was rejected. Please contact an administrator.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const accessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error logging in:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/refresh
export const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Block refresh if user becomes rejected later
    if (user.status !== "approved") {
      return res.status(403).json({
        message:
          user.status === "pending"
            ? "Your access request is pending approval."
            : "Your access request was rejected. Please contact an administrator.",
      });
    }

    const newAccessToken = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    return res.status(200).json({
      accessToken: newAccessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error refreshing token:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/auth/logout
export const logout = (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Error logging out:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

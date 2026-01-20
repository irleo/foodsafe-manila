import User from "../models/User.js";
import bcrypt from "bcryptjs";

export const requestAccess = async (req, res) => {
  const { username, email, password, organization, position, reason } = req.body;

  if (!username || !email || !password || !organization || !position || !reason) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      username: username,
      email: email.toLowerCase(),
      password: hashedPassword,
      organization,
      position,
      reason,
      status: "pending",
      role: "user",
    });

    await user.save();

    return res.status(201).json({
      message: "Access request submitted. Awaiting approval.",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Error requesting access:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

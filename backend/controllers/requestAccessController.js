import User from "../models/WebUser.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../utils/passwordValidation.js";

export const requestAccess = async (req, res) => {
  const { username, email, password, organization, position, requestedRole } = req.body;

  if (!username || !email || !password || !organization || !position || !["cesu", "surveillance_team"].includes(requestedRole)) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ message: passwordValidation.message });
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
      requestedRole,
      status: "pending",
      role: "unassigned",
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

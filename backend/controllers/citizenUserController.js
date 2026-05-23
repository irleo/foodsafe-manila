import CitizenUser from "../models/CitizenUser.js";
import { normalizePhone, sanitizeCitizenUser } from "../utils/citizenAuth.js";

// PUT /api/users/:id (citizen profile — mobile app)
export const updateCitizenProfile = async (req, res) => {
  try {
    if (req.user?.accountType !== "citizen") {
      return res.status(403).json({ message: "Access denied" });
    }

    if (String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { username, phone, email } = req.body;
    const user = await CitizenUser.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username) user.username = String(username).trim();

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone !== user.phone_number) {
        const taken = await CitizenUser.exists({
          phone_number: normalizedPhone,
          _id: { $ne: user._id },
        });
        if (taken) {
          return res.status(409).json({ message: "Phone number already in use" });
        }
        user.phone_number = normalizedPhone;
      }
    }

    if (typeof email !== "undefined") {
      user.email = email ? String(email).trim() : "";
    }

    await user.save();
    return res.status(200).json(sanitizeCitizenUser(user));
  } catch (error) {
    console.error("Citizen profile update error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

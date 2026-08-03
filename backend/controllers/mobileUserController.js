import MobileUser from "../models/MobileUser.js";
import { normalizePhone, sanitizeMobileUser } from "../utils/citizenAuth.js";

// PUT /api/users/:id (citizen profile — mobile app)
export const updateMobileProfile = async (req, res) => {
  try {
    if (req.user?.accountType !== "citizen") {
      return res.status(403).json({ message: "Access denied" });
    }

    if (String(req.params.id) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { username, phone, email } = req.body;
    const mobileUser = await MobileUser.findById(req.user.id);

    if (!mobileUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (username) mobileUser.username = String(username).trim();

    if (phone) {
      const normalizedPhone = normalizePhone(phone);
      if (normalizedPhone !== mobileUser.phone_number) {
        const taken = await MobileUser.exists({
          phone_number: normalizedPhone,
          _id: { $ne: mobileUser._id },
        });
        if (taken) {
          return res.status(409).json({ message: "Phone number already in use" });
        }
        mobileUser.phone_number = normalizedPhone;
      }
    }

    if (typeof email !== "undefined") {
      mobileUser.email = email ? String(email).trim() : "";
    }

    await mobileUser.save();
    return res.status(200).json(sanitizeMobileUser(mobileUser));
  } catch (error) {
    console.error("Citizen profile update error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
};

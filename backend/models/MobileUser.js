import mongoose from "mongoose";

const mobileUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, default: "", trim: true },
  },
  {
    timestamps: true,
    collection: "mobileUsers",
  },
);

mobileUserSchema.index(
  { phoneNumber: 1 },
  { unique: true, name: "mobileUsersPhoneNumberUnique" },
);

export default mongoose.model("MobileUser", mobileUserSchema);

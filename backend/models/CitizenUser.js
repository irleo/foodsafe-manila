import mongoose from "mongoose";

const citizenUserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    phone_number: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    email: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export default mongoose.model("CitizenUser", citizenUserSchema);

import jwt from "jsonwebtoken";
import MobileUser from "../models/MobileUser.js";
import WebUser from "../models/WebUser.js";
import { isTokenVersionCurrent } from "../utils/tokenVersion.js";

export const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const UserModel = user.accountType === "citizen" ? MobileUser : WebUser;
    const persistedUser = await UserModel.findById(user.id)
      .select("tokenVersion")
      .lean();

    if (!persistedUser || !isTokenVersionCurrent(user.tokenVersion, persistedUser.tokenVersion)) {
      return res.status(401).json({ message: "Session has been revoked." });
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Invalid or expired session." });
    }
    return next(error);
  }
};


export const verifyRole = (role) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (userRole !== role) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

export const verifyRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};

import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const secret = process.env.ACCESS_TOKEN_SECRET;

  if (!secret) {
    return res.status(500).json({
      message: "Server auth configuration error",
    });
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "No token provided",
    });
  }

  jwt.verify(token, secret, (err, user) => {
    if (err?.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Token expired",
      });
    }

    if (err) {
      return res.status(401).json({
        message: "Invalid token",
      });
    }

    req.user = user;
    next();
  });
};

export const verifyRole = (...roles) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    next();
  };
};
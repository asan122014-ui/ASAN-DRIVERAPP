import jwt from "jsonwebtoken";

/* ================= VERIFY ADMIN ================= */
const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Check token exists
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check admin role
    if (!["superadmin", "reviewer"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    // Attach admin to request
    req.admin = {
      id: decoded.id,
      role: decoded.role
    };

    next();

  } catch (error) {
    console.error("Admin Auth Error:", error.message);

    return res.status(401).json({
      success: false,
      message:
        error.name === "TokenExpiredError"
          ? "Token expired"
          : "Invalid token"
    });
  }
};

export default verifyAdmin;

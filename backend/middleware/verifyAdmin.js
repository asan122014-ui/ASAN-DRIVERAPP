import jwt from "jsonwebtoken";

/* ================= VERIFY ADMIN TOKEN ================= */

const verifyAdmin = (req, res, next) => {

  try {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. Token missing"
      });
    }

    const token = authHeader.split(" ")[1];

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET not defined in environment variables");

      return res.status(500).json({
        success: false,
        message: "Server configuration error"
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    /* Role validation */

    if (!["superadmin", "reviewer"].includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: "Admin access denied"
      });
    }

    /* Attach admin info to request */

    req.admin = {
      id: decoded.id,
      role: decoded.role
    };

    next();

  } catch (error) {

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired"
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid authentication token"
    });

  }

};

export default verifyAdmin;

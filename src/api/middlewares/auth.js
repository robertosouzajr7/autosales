import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vendai-secret-key-2026";

export const authMiddleware = (req, res, next) => {
  console.log(`[AUTH CHECK] ${req.method} ${req.url}`);
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }
};

export const adminMiddleware = (req, res, next) => {
  if (req.userRole !== "SUPERADMIN") {
    return res.status(403).json({ error: "Acesso negado. Requer privilégios de Admin." });
  }
  next();
};

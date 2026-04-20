import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "vendai-secret-key-2026";

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];
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

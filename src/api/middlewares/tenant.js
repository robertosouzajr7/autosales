export const tenantMiddleware = (req, res, next) => {
  const publicPaths = ["/api/auth/", "/api/public/", "/api/webhook/", "/api/ping"];
  if (publicPaths.some(p => req.path.startsWith(p))) return next();
  
  const tenantId = req.headers["x-tenant-id"];
  if (tenantId) {
    req.tenantId = tenantId;
  }
  next();
};

export const debugLogger = (req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
};

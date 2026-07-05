// SEGURANÇA: o tenant é derivado EXCLUSIVAMENTE do JWT no authMiddleware
// (req.tenantId). Nunca resolver tenant a partir de header/query/body em rota
// autenticada — isso permitia acesso cross-tenant (IDOR). Este middleware não
// deriva mais tenant de dados controlados pelo cliente.
export const tenantMiddleware = (req, res, next) => {
  next();
};

export const debugLogger = (req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
};

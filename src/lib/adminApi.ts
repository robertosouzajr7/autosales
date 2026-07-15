/**
 * Cliente HTTP do portal admin. TODA chamada leva o Bearer token —
 * a ausência dele era a causa dos 401 silenciosos que faziam edições
 * "não persistirem".
 */
export async function api<T = any>(
  path: string,
  options: { method?: string; body?: any } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(path, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* corpo vazio */
  }
  return { ok: res.ok, status: res.status, data };
}

export const adminApi = {
  get: <T = any>(path: string) => api<T>(path),
  post: <T = any>(path: string, body?: any) => api<T>(path, { method: "POST", body }),
  put: <T = any>(path: string, body?: any) => api<T>(path, { method: "PUT", body }),
  del: <T = any>(path: string) => api<T>(path, { method: "DELETE" }),
};

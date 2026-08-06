import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { guardarSessao } from "../sessao";
import { ehNativo } from "../plataforma";

/**
 * Entrar — a primeira tela do app do atendente.
 *
 * Mesmo endpoint do login da web (`/api/auth/login`); o que muda é a forma.
 * As medidas vêm do handoff: logo 56px, título 30px, campos de 52px com
 * fundo #F2F2F7 e canto de 14px — a linguagem do iOS, não a do painel.
 */

export function Entrar({ aoEntrar }: { aoEntrar: () => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const entrar = async () => {
    if (!email.trim() || !senha) return setErro("Preencha e-mail e senha.");
    setEntrando(true);
    setErro(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password: senha }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Não foi possível entrar.");
      if (d.requires2FA || d.twoFactorRequired) {
        // O app ainda não tem a tela do código; melhor dizer do que travar
        // numa tela que não avança.
        throw new Error("Esta conta usa verificação em duas etapas. Entre pelo navegador por enquanto.");
      }

      // As mesmas chaves que o login da web grava: o resto do app (as 38
      // telas e o interceptador de fetch) lê daqui, e o app reaproveita tudo.
      localStorage.setItem("token", d.token);
      if (d.user) {
        localStorage.setItem("user", JSON.stringify(d.user));
        if (d.user.id) localStorage.setItem("userId", d.user.id);
        if (d.user.name) localStorage.setItem("userName", d.user.name);
        if (d.user.role) localStorage.setItem("userRole", d.user.role);
      }
      if (d.tenant) {
        if (d.tenant.id) localStorage.setItem("tenantId", d.tenant.id);
        if (d.tenant.name) localStorage.setItem("tenantName", d.tenant.name);
        if (d.tenant.planId) localStorage.setItem("userPlan", d.tenant.planId);
      }
      await guardarSessao();
      aoEntrar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEntrando(false);
    }
  };

  const campo =
    "h-[52px] w-full rounded-[14px] bg-[#F2F2F7] px-4 text-[16px] font-medium text-[#0F172A] outline-none placeholder:font-normal placeholder:text-[rgba(60,60,67,0.4)]";

  return (
    <div className="flex min-h-full flex-col bg-white px-6">
      <div className="flex flex-1 flex-col justify-center gap-8 pb-10">
        <div className="flex flex-col gap-5">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#7C5CFF] shadow-[0_14px_28px_-10px_rgba(37,99,235,0.6)]">
            <svg viewBox="0 0 64 64" width="28" height="28" fill="#fff" aria-hidden>
              <path fillRule="evenodd" clipRule="evenodd" d="M32 6 L58 56 L6 56 Z M32 30 L45.5 56 L18.5 56 Z" />
            </svg>
          </span>
          <div>
            <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.04em] text-[#0F172A]">
              Atendimento
              <br />
              na sua mão
            </h1>
            <p className="mt-2.5 text-[15px] leading-[1.55] text-[rgba(60,60,67,0.6)]">
              Entre com a conta do seu negócio para assumir as conversas de onde a IA parou.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3.5">
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[rgba(60,60,67,0.6)]">E-mail</label>
            <input
              className={campo}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              placeholder="voce@seunegocio.com.br"
            />
          </div>
          <div>
            <label className="mb-2 block text-[13px] font-semibold text-[rgba(60,60,67,0.6)]">Senha</label>
            <div className="flex h-[52px] items-center gap-3 rounded-[14px] bg-[#F2F2F7] px-4">
              <input
                className="flex-1 bg-transparent text-[16px] font-medium text-[#0F172A] outline-none"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                type={verSenha ? "text" : "password"}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                placeholder="••••••••"
              />
              <button
                onClick={() => setVerSenha((v) => !v)}
                className="text-[rgba(60,60,67,0.45)]"
                aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {verSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </div>

        {erro && (
          <p className="-mt-3 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={entrar}
            disabled={entrando}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] text-[17px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(37,99,235,0.8)] active:scale-[0.99] disabled:opacity-70"
          >
            {entrando && <Loader2 className="h-4 w-4 animate-spin" />}
            {entrando ? "Entrando…" : "Entrar"}
          </button>

          {/* O handoff mostra Face ID. O botão só aparece no aparelho — no
              navegador não há o que oferecer — e fica desabilitado até o
              plugin de biometria entrar, para não prometer o que não faz. */}
          {ehNativo() && (
            <button
              disabled
              title="Disponível em breve"
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#F2F2F7] text-[16px] font-semibold text-[rgba(60,60,67,0.4)]"
            >
              <Lock className="h-4 w-4" /> Entrar com Face ID
            </button>
          )}

          <p className="text-center text-[14px] text-[rgba(60,60,67,0.6)]">
            Esqueceu a senha?{" "}
            <a href="/forgot-password" className="font-semibold text-[#2563EB]">
              Recuperar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

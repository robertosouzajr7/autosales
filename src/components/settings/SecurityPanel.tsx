import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  KeyRound, ShieldCheck, QrCode, Copy, Loader2, CheckCircle2, AlertTriangle,
} from "lucide-react";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

interface Me {
  id: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
}

export function SecurityPanel() {
  const { toast } = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  // change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // 2fa state
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupData, setSetupData] = useState<{ qrDataUrl: string; secret: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // disable 2fa
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePwd, setDisablePwd] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disabling, setDisabling] = useState(false);

  const loadMe = async () => {
    try {
      const res = await fetch("/api/users/me", { headers: authHeaders() });
      const d = await res.json();
      setMe(d);
    } catch {}
    setLoading(false);
  };
  useEffect(() => {
    loadMe();
  }, []);

  const resendVerification = async () => {
    if (!me?.email) return;
    await fetch("/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: me.email }),
    });
    toast({ title: "Enviado", description: "Verifique sua caixa de entrada." });
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      return toast({ title: "Senha muito curta", description: "Use ao menos 8 caracteres.", variant: "destructive" });
    }
    if (newPassword !== confirmPassword) {
      return toast({ title: "As senhas não conferem", variant: "destructive" });
    }
    setSavingPwd(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "Senha alterada com sucesso" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Erro", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setSavingPwd(false);
  };

  const start2FASetup = async () => {
    setSetupData(null);
    setBackupCodes(null);
    setTotpCode("");
    setSetupOpen(true);
    try {
      const res = await fetch("/api/users/me/2fa/setup", {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await res.json();
      if (res.ok) setSetupData({ qrDataUrl: d.qrDataUrl, secret: d.secret });
      else toast({ title: "Erro", description: d.error, variant: "destructive" });
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
  };

  const confirm2FA = async () => {
    if (!totpCode) return;
    setEnabling(true);
    try {
      const res = await fetch("/api/users/me/2fa/enable", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ code: totpCode }),
      });
      const d = await res.json();
      if (res.ok) {
        setBackupCodes(d.backupCodes);
        loadMe();
      } else {
        toast({ title: "Código inválido", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setEnabling(false);
  };

  const closeSetup = () => {
    setSetupOpen(false);
    setSetupData(null);
    setBackupCodes(null);
    setTotpCode("");
  };

  const handleDisable2FA = async () => {
    setDisabling(true);
    try {
      const res = await fetch("/api/users/me/2fa/disable", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ password: disablePwd, code: disableCode }),
      });
      const d = await res.json();
      if (res.ok) {
        toast({ title: "2FA desativado" });
        setDisableOpen(false);
        setDisablePwd("");
        setDisableCode("");
        loadMe();
      } else {
        toast({ title: "Erro", description: d.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro de conexão", variant: "destructive" });
    }
    setDisabling(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* E-mail verificado */}
      <Card className="rounded-2xl border-border p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl grid place-items-center ${me?.emailVerified ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
              {me?.emailVerified ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">E-mail {me?.emailVerified ? "confirmado" : "não confirmado"}</p>
              <p className="text-xs text-muted-foreground">{me?.email}</p>
            </div>
          </div>
          {!me?.emailVerified && (
            <Button variant="outline" size="sm" onClick={resendVerification}>
              Reenviar e-mail de verificação
            </Button>
          )}
        </div>
      </Card>

      {/* Alterar senha */}
      <Card className="rounded-2xl border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Senha</h3>
            <p className="text-xs text-muted-foreground">Escolha uma senha forte que você não usa em outros sites.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Senha atual</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nova senha</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleChangePassword} disabled={savingPwd || !currentPassword || !newPassword} className="gap-2">
            {savingPwd && <Loader2 className="w-4 h-4 animate-spin" />}
            Alterar senha
          </Button>
        </div>
      </Card>

      {/* 2FA */}
      <Card className="rounded-2xl border-border p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl grid place-items-center ${me?.twoFactorEnabled ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Verificação em 2 passos (2FA)</h3>
                {me?.twoFactorEnabled && <Badge className="bg-emerald-100 text-emerald-700 border-none text-xs">Ativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">
                Use Google Authenticator, Authy, 1Password ou qualquer app compatível com TOTP.
              </p>
            </div>
          </div>
          {me?.twoFactorEnabled ? (
            <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
              Desativar 2FA
            </Button>
          ) : (
            <Button size="sm" onClick={start2FASetup} className="gap-2">
              <QrCode className="w-4 h-4" /> Ativar 2FA
            </Button>
          )}
        </div>
      </Card>

      {/* MODAL: Setup 2FA */}
      <Dialog open={setupOpen} onOpenChange={(o) => (o ? null : closeSetup())}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>{backupCodes ? "Guarde seus códigos de backup" : "Ativar 2FA"}</DialogTitle>
          </DialogHeader>

          {!backupCodes ? (
            <div className="space-y-4">
              {!setupData ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <ol className="text-sm text-foreground space-y-1 list-decimal list-inside">
                    <li>Abra seu app autenticador.</li>
                    <li>Escaneie o QR abaixo (ou cole o código manual).</li>
                    <li>Digite o código de 6 dígitos que aparecer no app.</li>
                  </ol>
                  <div className="flex justify-center p-4 bg-white rounded-2xl border border-border">
                    <img src={setupData.qrDataUrl} alt="QR Code 2FA" className="w-56 h-56" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Código manual</Label>
                    <div className="flex gap-2">
                      <Input readOnly value={setupData.secret} className="font-mono text-xs" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(setupData.secret);
                          toast({ title: "Copiado" });
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Código do app</Label>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      className="h-12 text-xl tracking-[0.5em] text-center font-bold"
                      placeholder="000000"
                    />
                  </div>
                </>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeSetup}>Cancelar</Button>
                <Button onClick={confirm2FA} disabled={enabling || totpCode.length !== 6} className="gap-2">
                  {enabling && <Loader2 className="w-4 h-4 animate-spin" />}
                  Ativar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                Guarde estes códigos em local seguro. Cada um funciona uma vez pra entrar caso você perca acesso ao autenticador.
              </div>
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {backupCodes.map((c) => (
                  <div key={c} className="p-2 bg-muted rounded-lg text-center tracking-widest">{c}</div>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  navigator.clipboard.writeText(backupCodes.join("\n"));
                  toast({ title: "Códigos copiados" });
                }}
              >
                <Copy className="w-4 h-4" /> Copiar todos
              </Button>
              <DialogFooter>
                <Button onClick={closeSetup} className="w-full">Concluído</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Disable 2FA */}
      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar 2FA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para desativar, confirme sua senha e o código do autenticador.
            </p>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Senha</Label>
              <Input type="password" value={disablePwd} onChange={(e) => setDisablePwd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Código do autenticador</Label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                className="h-12 text-xl tracking-[0.5em] text-center font-bold"
                placeholder="000000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDisable2FA} disabled={disabling || !disablePwd || !disableCode} className="gap-2">
              {disabling && <Loader2 className="w-4 h-4 animate-spin" />}
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

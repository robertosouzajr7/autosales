import { useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Key, Building2, Smartphone } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: "", openAiKey: "", systemPrompt: "" });
  const [qrCode, setQrCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      if (data.id) {
        setFormData({ 
          name: data.name || "", 
          openAiKey: data.openAiKey || "", 
          systemPrompt: data.systemPrompt || "" 
        });
      }
      setLoading(false);
    });

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("gcal") === "success") {
       toast({ title: "Google Calendar Conectado", description: "O SDR agora tem acesso à sua agenda livre." });
       window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get("gcal") === "error") {
       toast({ title: "Erro no Google Calendar", description: "Falha ao conectar sua agenda.", variant: "destructive" });
       window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (!res.ok) throw new Error("Falha");
      toast({ title: "Sucesso!", description: "Configurações da IA foram salvas e atualizadas." });
    } catch(err) {
      toast({ title: "Erro na nuvem", description: "Falha ao comunicar com o servidor.", variant: "destructive" });
    }
    setSaving(false);
  };

  const connectWhatsApp = () => {
    setConnecting(true);
    setQrCode("");
    const eventSource = new EventSource("/api/whatsapp/qr");
    eventSource.onmessage = (event) => {
      const data = event.data;
      if (data === "CONNECTED") {
        setQrCode("CONNECTED");
        setConnecting(false);
        eventSource.close();
        toast({ title: "WhatsApp Conectado", description: "O bot está online no seu número!" });
      } else if (data.includes("ERROR")) {
        setConnecting(false);
        eventSource.close();
        toast({ title: "Erro", description: "Falha ao gerar QR Code SaaS.", variant: "destructive" });
      } else {
        setQrCode(data);
        setConnecting(false);
      }
    };
    eventSource.onerror = () => {
       setConnecting(false);
       eventSource.close();
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6 pb-20">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cérebro do Vend.AI</h1>
          <p className="text-slate-500">Instrua seu Agente SDR sobre como abordar, vender e agendar.</p>
        </div>

        {loading ? (
          <div className="flex animate-pulse space-x-4"><div className="h-40 bg-slate-200 rounded-xl w-full"></div></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-1 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-indigo-500"/> Identidade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da Empresa</Label>
                    <Input id="companyName" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Sua Empresa Mágica" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Key className="w-5 h-5 text-amber-500"/> Credenciais</CardTitle>
                  <CardDescription>Para o SDR funcionar 100%, insira sua API Key do Google Gemini (AI Studio).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="openAiKey">Gemini API Key</Label>
                    <Input id="openAiKey" type="password" value={formData.openAiKey} onChange={e => setFormData({...formData, openAiKey: e.target.value})} placeholder="AIzaSy..." />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-green-500"/> Aparelho WhatsApp</CardTitle>
                  <CardDescription>Escaneie o QR Code para conectar a inteligência da empresa.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex flex-col items-center justify-center p-6">
                  {qrCode === "CONNECTED" ? (
                      <div className="text-sm font-bold text-green-600 bg-green-50 p-2 rounded-md w-full text-center border border-green-200">✔️ WhatsApp Conectado e Operante</div>
                  ) : qrCode ? (
                      <div className="p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <QRCodeSVG value={qrCode} size={200} />
                      </div>
                  ) : (
                      <Button onClick={connectWhatsApp} variant="outline" className="w-full h-12 border-dashed border-2 hover:bg-green-50 hover:text-green-700 hover:border-green-300">
                         {connecting ? "Gerando QR Code..." : "Conectar Aparelho"}
                      </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Google Calendar
                  </CardTitle>
                  <CardDescription>Conceda permissão no SaaS para o SDR checar os buracos na agenda em tempo real e marcar as reuniões.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={() => window.location.href = 'http://localhost:3000/api/google/auth'} variant="outline" className="w-full h-12 border-dashed border-2 hover:bg-blue-50 shadow-sm transition">
                    Sign in with Google
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="md:col-span-2">
              <Card className="h-full border-indigo-100 shadow-sm">
                <CardHeader className="bg-indigo-50/50 border-b border-indigo-50">
                  <CardTitle className="text-lg flex items-center gap-2 text-indigo-900"><Bot className="w-5 h-5 text-indigo-500"/> System Prompt (Treinamento SDR)</CardTitle>
                  <CardDescription>Este é o cérebro da sua IA. Escreva com detalhes como ela deve atender os clientes no WhatsApp, falar de valores e quando tentar marcar uma reunião.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Textarea 
                      id="systemPrompt" 
                      className="h-80 resize-none font-mono text-sm" 
                      value={formData.systemPrompt} 
                      onChange={e => setFormData({...formData, systemPrompt: e.target.value})} 
                      placeholder="Você é um Closer agressivo porém educado. Seu objetivo é descobrir o problema do lead, apresentar nossa consultoria por R$ 5.000 e fechar a call de apresentação. Nunca dê descontos." 
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 w-full md:w-auto">
                      {saving ? "Salvando Treinamento..." : "Salvar Configurações da IA"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Clock, Calendar as CalIcon, CheckCircle2, User, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const timeSlots = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00"
];

export default function PublicBooking() {
  const { tenantId } = useParams();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState(false);
  const [inWaitlist, setInWaitlist] = useState(false);

  const handleBooking = async () => {
    if (!name || !phone || !date || !selectedTime) {
      toast({ title: "Atenção", description: "Preencha todos os campos para agendar.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const dateTime = new Date(date);
      const [hours, minutes] = selectedTime.split(":");
      dateTime.setHours(parseInt(hours), parseInt(minutes), 0);

      const response = await fetch("/api/public/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name,
          phone,
          date: dateTime.toISOString(),
          title: `Agendamento WhatsApp: ${name}`
        })
      });

      if (response.ok) {
        setBooked(true);
        toast({ title: "Sucesso!", description: "Seu agendamento foi confirmado. ✨" });
      } else {
        throw new Error();
      }
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível agendar. Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleWaitlist = async () => {
    if (!name || !phone) {
      toast({ title: "Atenção", description: "Preencha seu nome e WhatsApp para entrar na lista.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, name, phone })
      });

      if (response.ok) {
        setInWaitlist(true);
        toast({ title: "Lista de Espera", description: "Você entrou na fila! Te avisaremos se surgir uma vaga. 🚀" });
      }
    } catch (e) {
      toast({ title: "Erro", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
        <Card className="w-full max-w-md border-emerald-500 bg-slate-900/60 backdrop-blur-xl text-white text-center p-8 animate-in fade-in zoom-in duration-500">
          <CheckCircle2 className="w-20 h-20 text-emerald-400 mx-auto mb-6" />
          <CardTitle className="text-3xl font-bold mb-2">Agendado com Sucesso!</CardTitle>
          <CardDescription className="text-slate-300 mb-6 text-lg">
            Sua reunião foi confirmada para o dia <br />
            <strong>{format(date!, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}</strong>.
          </CardDescription>
          <Button onClick={() => window.close()} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-lg font-bold">
            Pode fechar esta janela
          </Button>
        </Card>
      </div>
    );
  }

  if (inWaitlist) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
        <Card className="w-full max-w-md border-indigo-500 bg-slate-900/60 backdrop-blur-xl text-white text-center p-8 animate-in fade-in zoom-in duration-500">
          <Clock className="w-20 h-20 text-indigo-400 mx-auto mb-6" />
          <CardTitle className="text-3xl font-bold mb-2">Você está na Fila!</CardTitle>
          <CardDescription className="text-slate-300 mb-6 text-lg">
            Registramos seu interesse. Nosso SDR entrará em contato via WhatsApp assim que houver um encaixe disponível. 🚀
          </CardDescription>
          <Button onClick={() => window.close()} className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-lg font-bold">
            Até logo!
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 animate-in slide-in-from-bottom duration-700">
        
        {/* Lado Esquerdo: Info e Form */}
        <Card className="border-slate-800 bg-slate-900/40 backdrop-blur-md text-white border-0 shadow-2xl">
          <CardHeader className="p-8">
            <div className="flex items-center gap-3 mb-4 text-indigo-400">
              <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <CalIcon className="w-6 h-6" />
              </div>
              <span className="font-bold tracking-widest text-xs uppercase">Agentes Virtuais Scheduling</span>
            </div>
            <CardTitle className="text-4xl font-extrabold tracking-tight">Reserve seu Horário</CardTitle>
            <CardDescription className="text-slate-400 text-lg mt-2">
              Selecione o momento ideal para sua demonstração estratégica ou consulta.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300 font-medium ml-1">Seu Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <Input 
                    id="name" 
                    placeholder="João Silva" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-12 bg-slate-800/50 border-slate-700 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white rounded-xl" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-slate-300 font-medium ml-1">WhatsApp</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 w-5 h-5 text-slate-500" />
                  <Input 
                    id="phone" 
                    placeholder="(00) 00000-0000" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10 h-12 bg-slate-800/50 border-slate-700 focus:border-indigo-500/50 focus:ring-indigo-500/20 text-white rounded-xl" 
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
              <Button 
                onClick={handleBooking}
                disabled={loading || !date || !selectedTime}
                className="w-full py-7 bg-indigo-600 hover:bg-indigo-500 text-lg font-bold text-white rounded-2xl shadow-lg shadow-indigo-900/20 transition-all active:scale-95"
              >
                {loading ? "Confirmando..." : "Confirmar Agendamento ✨"}
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleWaitlist}
                disabled={loading}
                className="w-full py-6 border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white rounded-2xl transition-all"
              >
                Não achou seu horário? Me avise de vagas 🔔
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lado Direito: Agenda */}
        <div className="space-y-6">
          <Card className="border-0 bg-white/5 backdrop-blur-3xl shadow-2xl p-6 rounded-3xl">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={ptBR}
              className="mx-auto text-white rounded-2xl"
              classNames={{
                day_selected: "bg-indigo-600 text-white hover:bg-indigo-500 rounded-full",
                day_today: "bg-slate-800 text-indigo-400 font-bold",
              }}
            />
          </Card>

          <Card className="border-0 bg-slate-900/60 backdrop-blur-xl p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-4 text-indigo-400">
              <Clock className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">Horários Disponíveis</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {timeSlots.map((time) => (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`py-3 rounded-xl border text-sm font-bold transition-all ${
                    selectedTime === time 
                    ? "bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-900/40" 
                    : "bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800"
                  }`}
                >
                  {time}
                </button>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

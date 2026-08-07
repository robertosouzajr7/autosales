import { useEffect, useState } from "react";
import { Calendar, Loader2, Mail, MessageSquare, Phone, Tag } from "lucide-react";
import { Folha } from "./Folha";
import { Ficha, verFicha } from "../dados";
import { Avatar } from "./Avatar";

/**
 * A ficha do cliente, sem sair da conversa.
 *
 * O que o atendente precisa saber antes de responder: quem é, desde quando,
 * em que etapa do funil está e — o mais importante — se já tem horário
 * marcado. Oferecer agendamento para quem já agendou é o erro que mais
 * irrita cliente.
 */

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
  });
}

export function FolhaFicha({
  aberta, aoFechar, leadId,
}: {
  aberta: boolean;
  aoFechar: () => void;
  leadId: string;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setCarregando(true);
    setErro(null);
    verFicha(leadId)
      .then(setFicha)
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [aberta, leadId]);

  return (
    <Folha aberta={aberta} aoFechar={aoFechar} titulo="Ficha do cliente" altura="72%">
      {carregando && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
        </div>
      )}

      {erro && (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
      )}

      {ficha && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3.5 rounded-[18px] bg-white p-4">
            <Avatar nome={ficha.name} canal={ficha.channel} tamanho={52} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[18px] font-semibold text-[#0F172A]">{ficha.name}</p>
              <p className="mt-0.5 truncate text-[13.5px] text-[rgba(60,60,67,0.6)]">
                {ficha.handle || ficha.phone || ficha.email || ""}
              </p>
            </div>
          </div>

          {/* O que vem primeiro é o compromisso: é o que muda a resposta. */}
          {ficha.nextAppointment && (
            <div className="rounded-[18px] bg-[rgba(34,160,107,0.1)] p-4">
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[#15803D]">
                <Calendar className="h-3.5 w-3.5" /> Já tem horário marcado
              </p>
              <p className="mt-1.5 text-[16px] font-semibold text-[#0F172A]">
                {quando(ficha.nextAppointment.date)}
              </p>
              <p className="mt-0.5 text-[13.5px] text-[rgba(60,60,67,0.7)]">{ficha.nextAppointment.title}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-[18px] bg-white">
            {[
              { Icone: Phone, rotulo: "Telefone", valor: ficha.phone },
              { Icone: Mail, rotulo: "E-mail", valor: ficha.email },
              {
                Icone: MessageSquare,
                rotulo: "Mensagens trocadas",
                valor: ficha.messageCount ? String(ficha.messageCount) : null,
              },
              {
                Icone: Calendar,
                rotulo: "Cliente desde",
                valor: new Date(ficha.firstContactAt || ficha.createdAt).toLocaleDateString("pt-BR"),
              },
            ]
              .filter((l) => l.valor)
              .map(({ Icone, rotulo, valor }, i) => (
                <div
                  key={rotulo}
                  className="flex min-h-[52px] items-center gap-3 px-4"
                  style={{ borderTop: i ? "0.5px solid rgba(60,60,67,0.1)" : undefined }}
                >
                  <Icone className="h-4 w-4 shrink-0 text-[rgba(60,60,67,0.45)]" />
                  <span className="flex-1 text-[14px] text-[rgba(60,60,67,0.6)]">{rotulo}</span>
                  <span className="truncate text-[15px] font-semibold text-[#0F172A]">{valor}</span>
                </div>
              ))}
          </div>

          {ficha.stage && (
            <div className="flex items-center gap-2.5 rounded-[18px] bg-white px-4 py-3.5">
              <span className="text-[14px] text-[rgba(60,60,67,0.6)]">Etapa no funil</span>
              <span
                className="ml-auto whitespace-nowrap rounded-lg px-2.5 py-1 text-[13px] font-bold"
                style={{
                  background: `${ficha.stage.color || "#2563EB"}1F`,
                  color: ficha.stage.color || "#1D4ED8",
                }}
              >
                {ficha.stage.name}
              </span>
            </div>
          )}

          {ficha.tags?.length > 0 && (
            <div className="rounded-[18px] bg-white px-4 py-3.5">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] text-[rgba(60,60,67,0.6)]">
                <Tag className="h-3.5 w-3.5" /> Marcadores
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ficha.tags.map((t) => (
                  <span
                    key={t.id}
                    className="rounded-lg px-2.5 py-1 text-[12.5px] font-semibold"
                    style={{ background: `${t.color || "#8A8A8E"}22`, color: t.color || "#3C3C43" }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {ficha.notes && (
            <div className="rounded-[18px] bg-white px-4 py-3.5">
              <p className="mb-1.5 text-[13px] text-[rgba(60,60,67,0.6)]">Anotações internas</p>
              <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55] text-[#0F172A]">{ficha.notes}</p>
            </div>
          )}
        </div>
      )}
    </Folha>
  );
}

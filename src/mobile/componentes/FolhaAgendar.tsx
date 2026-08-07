import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Folha } from "./Folha";
import { Horario, listarHorarios, marcarHorario } from "../dados";

/**
 * Marcar horário sem sair da conversa.
 *
 * Os horários vêm da agenda de verdade — a mesma lista que o agente consulta.
 * Antes o atendente abria a agenda em outra tela, conferia e voltava para a
 * conversa de memória, que é como se marca em cima de outro compromisso.
 *
 * Horário que já passou não aparece: oferecê-lo é combinar algo impossível e
 * descobrir só na hora de gravar.
 */

const DIAS = 7;

function proximosDias() {
  return Array.from({ length: DIAS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      diaDaSemana: i === 0 ? "hoje" : i === 1 ? "amanhã" : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      numero: d.getDate(),
    };
  });
}

export function FolhaAgendar({
  aberta, aoFechar, leadId, nomeDoCliente, aoMarcar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  leadId: string;
  nomeDoCliente: string;
  aoMarcar: (quando: string) => void;
}) {
  const dias = proximosDias();
  const [dia, setDia] = useState(dias[0].iso);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [marcando, setMarcando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setDia(dias[0].iso);
    setErro(null);
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    setCarregando(true);
    setErro(null);
    listarHorarios(dia)
      .then((r) => setHorarios(r.itens))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [dia, aberta]);

  const marcar = async (h: Horario) => {
    setMarcando(h.iso);
    setErro(null);
    try {
      await marcarHorario(leadId, h.iso, `Atendimento: ${nomeDoCliente}`);
      aoMarcar(
        new Date(h.iso).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short",
        })
      );
      aoFechar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setMarcando(null);
    }
  };

  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Agendar"
      subtitulo={`Horários livres na agenda para ${nomeDoCliente.split(" ")[0]}`}
      altura="72%"
    >
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {dias.map((d) => {
          const on = dia === d.iso;
          return (
            <button
              key={d.iso}
              onClick={() => setDia(d.iso)}
              className="flex h-[62px] w-[58px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[14px]"
              style={{ background: on ? "#2563EB" : "#fff", color: on ? "#fff" : "#0F172A" }}
            >
              <span className="text-[11.5px] font-semibold opacity-70">{d.diaDaSemana}</span>
              <span className="text-[19px] font-bold leading-none">{d.numero}</span>
            </button>
          );
        })}
      </div>

      {erro && (
        <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
      )}

      {carregando && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
        </div>
      )}

      {!carregando && !horarios.length && !erro && (
        <p className="px-1 pt-4 text-[15px] leading-relaxed text-[rgba(60,60,67,0.5)]">
          Nenhum horário livre neste dia. Tente outro.
        </p>
      )}

      <div className="grid grid-cols-3 gap-2.5">
        {horarios.map((h) => (
          <button
            key={h.iso}
            onClick={() => marcar(h)}
            disabled={!!marcando}
            className="flex min-h-[48px] items-center justify-center gap-1.5 rounded-[14px] bg-white text-[16px] font-semibold text-[#0F172A] disabled:opacity-60"
          >
            {marcando === h.iso ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {h.hora}
          </button>
        ))}
      </div>

      <p className="mt-4 px-1 text-[12.5px] leading-[1.5] text-[rgba(60,60,67,0.5)]">
        O convite vai por e-mail e o lembrete entra na régua automaticamente.
      </p>
    </Folha>
  );
}

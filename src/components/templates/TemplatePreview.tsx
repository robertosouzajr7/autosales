import { FileText, Play, Reply, ExternalLink, Phone, Image as ImageIcon } from "lucide-react";

/**
 * Pré-visualização do template dentro de uma tela de celular.
 *
 * O que a Meta aprova é um conjunto de componentes (cabeçalho, corpo, rodapé,
 * botões) — só que quem escreve o template pensa na mensagem que o cliente vai
 * ver. Esta tela mostra exatamente isso: o balão como ele chega no WhatsApp,
 * com as variáveis já substituídas pelos valores do disparo.
 */

type Botao = { type?: string; text?: string; url?: string; phone?: string };

export interface TemplateLike {
  name?: string;
  content?: string;
  headerType?: string | null;
  headerText?: string | null;
  footerText?: string | null;
  mediaUrl?: string | null;
  /** Vem como array no formulário e como JSON string do banco. */
  buttons?: Botao[] | string | null;
}

interface Props {
  template: TemplateLike;
  /** Valores dos {{n}}. Faltando um, o número aparece destacado. */
  variables?: string[];
  /** Nome usado quando a variável vale {{nome}} — o contato do disparo. */
  contactName?: string;
  /** Nome que aparece no topo da conversa. */
  businessName?: string;
  className?: string;
}

const TOKEN_NOME = /^\{\{\s*(nome|name)\s*\}\}$/i;

function parseButtons(buttons: Props["template"]["buttons"]): Botao[] {
  if (Array.isArray(buttons)) return buttons;
  if (typeof buttons === "string" && buttons.trim()) {
    try {
      const parsed = JSON.parse(buttons);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Negrito, itálico, tachado e monoespaçado do WhatsApp. */
const MARCACAO = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|```[\s\S]+?```)/g;

function formatar(texto: string, prefixo: string) {
  return texto
    .split(MARCACAO)
    .filter((p) => p !== "")
    .map((p, i) => {
      const key = `${prefixo}-${i}`;
      if (/^\*[^*\n]+\*$/.test(p)) return <strong key={key}>{p.slice(1, -1)}</strong>;
      if (/^_[^_\n]+_$/.test(p)) return <em key={key}>{p.slice(1, -1)}</em>;
      if (/^~[^~\n]+~$/.test(p)) return <s key={key}>{p.slice(1, -1)}</s>;
      if (/^```[\s\S]+```$/.test(p)) return <code key={key} className="font-mono">{p.slice(3, -3)}</code>;
      return <span key={key}>{p}</span>;
    });
}

/**
 * Troca os {{n}} pelos valores informados. O que não tem valor vira uma marca
 * amarela: é mais honesto mostrar o buraco do que fingir um texto pronto.
 */
function renderComVariaveis(texto: string, variables: string[], contactName: string, prefixo: string) {
  return String(texto || "")
    .split(/(\{\{\d+\}\})/g)
    .filter((p) => p !== "")
    .map((parte, i) => {
      const m = parte.match(/^\{\{(\d+)\}\}$/);
      if (!m) return <span key={`${prefixo}-t${i}`}>{formatar(parte, `${prefixo}-t${i}`)}</span>;

      const indice = Number(m[1]) - 1;
      const bruto = (variables[indice] ?? "").trim();
      const valor = TOKEN_NOME.test(bruto) || (!bruto && indice === 0) ? contactName : bruto;
      if (!valor) {
        return (
          <span key={`${prefixo}-v${i}`} className="rounded bg-amber-200/70 px-1 text-[13px] font-semibold text-amber-900">
            {parte}
          </span>
        );
      }
      return <span key={`${prefixo}-v${i}`} className="font-medium">{valor}</span>;
    });
}

function IconeBotao({ tipo }: { tipo?: string }) {
  const cls = "w-3.5 h-3.5 mr-1.5 shrink-0";
  if (tipo === "URL") return <ExternalLink className={cls} />;
  if (tipo === "PHONE_NUMBER") return <Phone className={cls} />;
  return <Reply className={cls} />;
}

export function TemplatePreview({
  template,
  variables = [],
  contactName = "Maria",
  businessName = "Sua empresa",
  className = "",
}: Props) {
  const buttons = parseButtons(template.buttons).filter((b) => (b.text || "").trim());
  const headerType = template.headerType || "";
  const temMidia = !!headerType && headerType !== "TEXT";
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const vazio = !template.content?.trim() && !template.headerText?.trim() && !temMidia;

  return (
    <div className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div className="rounded-[2.2rem] bg-slate-900 p-2 shadow-xl ring-1 ring-slate-900/10">
        <div className="relative overflow-hidden rounded-[1.7rem] bg-[#ECE5DD]">
          {/* Notch */}
          <div className="absolute left-1/2 top-1 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />

          {/* Barra da conversa */}
          <div className="flex items-center gap-2 bg-[#075E54] px-3 pb-2 pt-6 text-white">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/25 text-[11px] font-bold">
              {businessName.trim().charAt(0).toUpperCase() || "E"}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold leading-tight">{businessName}</p>
              <p className="text-[9px] leading-tight text-white/70">online</p>
            </div>
          </div>

          {/* Conversa */}
          <div
            className="min-h-[300px] space-y-2 px-3 py-4"
            style={{
              backgroundColor: "#ECE5DD",
              // Textura discreta, só para não ficar um retângulo chapado.
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.035) 1px, transparent 1px), radial-gradient(circle at 70% 70%, rgba(0,0,0,0.035) 1px, transparent 1px)",
              backgroundSize: "28px 28px, 34px 34px",
            }}
          >
            <p className="mx-auto w-fit rounded-md bg-[#FCF4CB] px-2 py-0.5 text-center text-[9px] font-medium text-slate-600 shadow-sm">
              HOJE
            </p>

            {vazio ? (
              <p className="pt-10 text-center text-[11px] font-medium text-slate-500">
                Escreva o corpo da mensagem para ver a prévia.
              </p>
            ) : (
              <div className="relative max-w-[92%] rounded-lg rounded-tl-none bg-white shadow-sm">
                {/* Rabinho do balão */}
                <span className="absolute -left-[7px] top-0 h-0 w-0 border-l-[8px] border-t-[8px] border-l-transparent border-t-white" />

                <div className="p-1.5">
                  {/* Cabeçalho */}
                  {headerType === "IMAGE" &&
                    (template.mediaUrl ? (
                      <img src={template.mediaUrl} alt="" className="mb-1 h-32 w-full rounded-md object-cover" />
                    ) : (
                      <div className="mb-1 flex h-28 w-full items-center justify-center rounded-md bg-slate-200">
                        <ImageIcon className="h-7 w-7 text-slate-400" />
                      </div>
                    ))}
                  {headerType === "VIDEO" && (
                    <div className="mb-1 flex h-28 w-full items-center justify-center rounded-md bg-slate-800">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90">
                        <Play className="ml-0.5 h-4 w-4 text-slate-800" />
                      </div>
                    </div>
                  )}
                  {headerType === "DOCUMENT" && (
                    <div className="mb-1 flex items-center gap-2 rounded-md bg-slate-100 p-2">
                      <FileText className="h-6 w-6 shrink-0 text-red-500" />
                      <span className="truncate text-[11px] font-medium text-slate-600">
                        {template.mediaUrl?.split("/").pop() || "documento.pdf"}
                      </span>
                    </div>
                  )}

                  <div className="px-1 pb-0.5">
                    {headerType === "TEXT" && template.headerText?.trim() && (
                      <p className="mb-1 whitespace-pre-wrap break-words text-[13px] font-bold leading-snug text-slate-900">
                        {renderComVariaveis(template.headerText, variables, contactName, "h")}
                      </p>
                    )}

                    <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-slate-800">
                      {renderComVariaveis(template.content || "", variables, contactName, "b")}
                    </p>

                    {template.footerText?.trim() && (
                      <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-slate-400">
                        {template.footerText}
                      </p>
                    )}

                    <p className="mt-0.5 text-right text-[9px] text-slate-400">{hora}</p>
                  </div>
                </div>

                {/* Botões vêm colados no balão, um por linha. */}
                {buttons.length > 0 && (
                  <div className="border-t border-slate-100">
                    {buttons.map((b, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-center px-2 py-2 text-[12px] font-medium text-[#00A5F4] ${
                          i > 0 ? "border-t border-slate-100" : ""
                        }`}
                      >
                        <IconeBotao tipo={b.type} />
                        <span className="truncate">{b.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campo de digitação, só cenário */}
          <div className="flex items-center gap-2 bg-[#F0F0F0] px-3 py-2">
            <div className="flex-1 rounded-full bg-white px-3 py-1.5 text-[10px] text-slate-400">Mensagem</div>
            <div className="h-6 w-6 shrink-0 rounded-full bg-[#075E54]" />
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-[10px] font-medium text-slate-400">
        Prévia aproximada — o WhatsApp pode variar detalhes de exibição.
      </p>
    </div>
  );
}

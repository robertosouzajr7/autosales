import { useEffect, useMemo, useState } from "react";
import { Check, ImageIcon, Loader2, Search } from "lucide-react";
import { Folha } from "./Folha";
import { ItemDoCatalogo, enviarItemDoCatalogo, listarCatalogo } from "../dados";
import { baseDaApi } from "../plataforma";

/**
 * Enviar item do catálogo sem sair da conversa.
 *
 * Antes o atendente abria o catálogo em outra tela, copiava nome e preço e
 * digitava de novo no chat — com o preço saindo errado de vez em quando. Aqui
 * ele toca no item e a mensagem sai com a foto e o valor certo.
 */

const dinheiro = (v: number | null) =>
  v === null || v === undefined
    ? "sob consulta"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function FolhaCatalogo({
  aberta, aoFechar, leadId, nomeDoCliente, aoEnviar,
}: {
  aberta: boolean;
  aoFechar: () => void;
  leadId: string;
  nomeDoCliente: string;
  aoEnviar: () => void;
}) {
  const [itens, setItens] = useState<ItemDoCatalogo[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberta) return;
    setBusca(""); setCategoria(""); setErro(null);
    setCarregando(true);
    listarCatalogo()
      .then((r) => setItens(r.filter((i: any) => i.isActive !== false)))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [aberta]);

  const categorias = useMemo(
    () => [...new Set(itens.map((i) => i.category).filter(Boolean))] as string[],
    [itens]
  );

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (categoria && i.category !== categoria) return false;
      if (!t) return true;
      return i.name.toLowerCase().includes(t) || (i.description || "").toLowerCase().includes(t);
    });
  }, [itens, busca, categoria]);

  const enviar = async (item: ItemDoCatalogo) => {
    setEnviando(item.id);
    setErro(null);
    try {
      await enviarItemDoCatalogo(leadId, item.id);
      aoEnviar();
      aoFechar();
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <Folha
      aberta={aberta}
      aoFechar={aoFechar}
      titulo="Catálogo"
      subtitulo={`Escolha o item para enviar na conversa com ${nomeDoCliente.split(" ")[0]}`}
      altura="80%"
    >
      <div className="mb-3 flex h-[38px] items-center gap-2.5 rounded-[11px] bg-[#EDEDF2] px-3">
        <Search className="h-[15px] w-[15px] shrink-0 text-[rgba(60,60,67,0.45)]" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar no catálogo"
          className="w-full bg-transparent text-[15px] text-[#0F172A] outline-none placeholder:text-[rgba(60,60,67,0.45)]"
        />
      </div>

      {categorias.length > 0 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {["", ...categorias].map((c) => {
            const on = categoria === c;
            return (
              <button
                key={c || "todas"}
                onClick={() => setCategoria(c)}
                className="inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-full px-[13px] text-[13px] font-semibold"
                style={{
                  background: on ? "#2563EB" : "#fff",
                  color: on ? "#fff" : "rgba(60,60,67,0.7)",
                }}
              >
                {c || "Todos"}
              </button>
            );
          })}
        </div>
      )}

      {erro && (
        <p className="mb-3 rounded-xl bg-rose-50 px-4 py-3 text-[13.5px] leading-snug text-rose-700">{erro}</p>
      )}

      {carregando && (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[rgba(60,60,67,0.35)]" />
        </div>
      )}

      {!carregando && !visiveis.length && (
        <p className="px-1 pt-6 text-[15px] leading-relaxed text-[rgba(60,60,67,0.5)]">
          {itens.length ? "Nada com esse filtro." : "Nenhum item no catálogo ainda."}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        {visiveis.map((item) => (
          <button
            key={item.id}
            onClick={() => enviar(item)}
            disabled={!!enviando}
            className="overflow-hidden rounded-[16px] bg-white text-left disabled:opacity-60"
          >
            <div className="grid h-[118px] place-items-center bg-gradient-to-br from-[#2563EB] to-[#60A5FA]">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl.startsWith("/") ? baseDaApi() + item.imageUrl : item.imageUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageIcon className="h-6 w-6 text-white/70" />
              )}
            </div>
            <div className="px-3 py-2.5">
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-[#0F172A]">{item.name}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[14px] font-bold text-[#2563EB]">
                {enviando === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {dinheiro(item.price)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Folha>
  );
}

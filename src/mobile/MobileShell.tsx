import { useEffect, useState } from "react";
import { App as AppNativo } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { ehNativo } from "./plataforma";
import { restaurarSessao } from "./sessao";
import { Aba, BarraDeAbas } from "./componentes/BarraDeAbas";
import { Entrar } from "./telas/Entrar";
import { Perfil } from "./telas/Perfil";
import { EmBreve } from "./telas/EmBreve";

/**
 * O shell do app.
 *
 * Tudo do app começa aqui, e nada daqui alcança a web: quem renderiza este
 * componente é o `App.tsx`, atrás de um único `ehApp()`. No navegador o
 * roteador de sempre segue intacto, rota por rota.
 *
 * A navegação é por estado, não por URL. Dentro do aparelho não existe barra
 * de endereço, e o histórico do navegador só atrapalharia: o botão físico do
 * Android é tratado aqui embaixo, explicitamente.
 */

export default function MobileShell() {
  const [carregando, setCarregando] = useState(true);
  const [autenticado, setAutenticado] = useState(false);
  const [aba, setAba] = useState<Aba>("conversas");

  useEffect(() => {
    let vivo = true;
    (async () => {
      // No aparelho o token pode estar só no armazenamento do sistema — o
      // WebView é limpo com mais frequência do que se imagina.
      await restaurarSessao();
      if (!vivo) return;
      setAutenticado(Boolean(localStorage.getItem("token")));
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  // A área segura só é liberada dentro do app. Mexer no `viewport` do
  // index.html mudaria também o site aberto no celular, e ele não deve mudar.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const antes = meta?.getAttribute("content") || "";
    meta?.setAttribute("content", "width=device-width, initial-scale=1.0, viewport-fit=cover");
    return () => { if (meta && antes) meta.setAttribute("content", antes); };
  }, []);

  useEffect(() => {
    if (!ehNativo()) return;
    // As telas são claras; sem isto o texto da barra sai branco no branco.
    StatusBar.setStyle({ style: Style.Light }).catch(() => { /* Android antigo */ });
  }, []);

  // Botão físico do Android: volta para a caixa de entrada; já nela, sai.
  useEffect(() => {
    if (!ehNativo()) return;
    const p = AppNativo.addListener("backButton", () => {
      setAba((atual) => {
        if (atual !== "conversas") return "conversas";
        AppNativo.exitApp();
        return atual;
      });
    });
    return () => { p.then((h) => h.remove()).catch(() => { /* já removido */ }); };
  }, []);

  if (carregando) {
    return (
      <div className="grid h-[100dvh] place-items-center bg-white">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#E5E7EB] border-t-[#2563EB]" />
      </div>
    );
  }

  if (!autenticado) {
    return (
      <div className="h-[100dvh] overflow-y-auto bg-white">
        <Entrar aoEntrar={() => setAutenticado(true)} />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#F2F2F7]">
      <div className="min-h-0 flex-1">
        {aba === "conversas" && (
          <EmBreve
            titulo="Conversas"
            texto="A caixa de entrada com a fila no topo é a próxima etapa. Por enquanto, atenda pelo navegador."
          />
        )}
        {aba === "fila" && (
          <EmBreve titulo="Fila" texto="Quem está esperando um atendente humano aparece aqui na próxima etapa." />
        )}
        {aba === "buscar" && (
          <EmBreve titulo="Buscar" texto="Busca por cliente, mensagem e item do catálogo." />
        )}
        {aba === "perfil" && <Perfil aoSair={() => { setAba("conversas"); setAutenticado(false); }} />}
      </div>
      <BarraDeAbas ativa={aba} aoTrocar={setAba} />
    </div>
  );
}

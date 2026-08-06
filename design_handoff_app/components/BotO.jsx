// figma node: 11:14 Botão (6 variants)
const __venc = (v) => String(v).replace(/[%|=]/g, encodeURIComponent);
const __vkey = (p) => "estilo=" + __venc(p.estilo) + '|' + "estado=" + __venc(p.estado);

export function BotO(_p = {}) {
  const props = { ..._p, estilo: _p.estilo ?? "primária", estado: _p.estado ?? "padrão" };
  const __body0 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      borderRadius: 12,
      backgroundColor: "var(--cor-acao-primaria)",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-sobre-acao)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __body1 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      opacity: 0.45,
      borderRadius: 12,
      backgroundColor: "var(--cor-acao-primaria)",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-sobre-acao)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __body2 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      borderRadius: 12,
      backgroundColor: "var(--cor-fundo-superficie)",
      boxShadow: "inset 0 0 0 1px var(--cor-borda-padrao)",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-primario)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __body3 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      opacity: 0.45,
      borderRadius: 12,
      backgroundColor: "var(--cor-fundo-superficie)",
      boxShadow: "inset 0 0 0 1px var(--cor-borda-padrao)",
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-primario)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __body4 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      borderRadius: 12,
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-secundario)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __body5 = () => (
    <div className={props.className} style={{
      width: "fit-content",
      opacity: 0.45,
      borderRadius: 12,
      display: "flex",
      flexDirection: "row",
      gap: 8,
      padding: "11px 18px 11px 18px",
      alignItems: "center",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-secundario)",
        flexShrink: 0,
        alignSelf: "stretch",
      }}>{props.text1 ?? "Fazer recarga"}</span>
    </div>
  );
  const __impls = {
    // figma: Estilo=Primária, Estado=Padrão
    "estilo=primária|estado=padrão": __body0,
    // figma: Estilo=Primária, Estado=Desabilitado
    "estilo=primária|estado=desabilitado": __body1,
    // figma: Estilo=Secundária, Estado=Padrão
    "estilo=secundária|estado=padrão": __body2,
    // figma: Estilo=Secundária, Estado=Desabilitado
    "estilo=secundária|estado=desabilitado": __body3,
    // figma: Estilo=Fantasma, Estado=Padrão
    "estilo=fantasma|estado=padrão": __body4,
    // figma: Estilo=Fantasma, Estado=Desabilitado
    "estilo=fantasma|estado=desabilitado": __body5,
  };
  return (__impls[__vkey(props)] ?? __body0)();
}
export default BotO;

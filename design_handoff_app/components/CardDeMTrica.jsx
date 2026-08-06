// figma node: 14:2 Card de métrica
export function CardDeMTrica(_p = {}) {
  const props = { ..._p, rTulo: _p.rTulo ?? "Conversas atendidas", valor: _p.valor ?? "143", contexto: _p.contexto ?? "últimos 30 dias" };
  return (
    <div className={props.className} style={{
      width: 240,
      borderRadius: 16,
      backgroundColor: "var(--cor-fundo-superficie)",
      boxShadow: "inset 0 0 0 1px var(--cor-borda-padrao)",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "20px 20px 20px 20px",
      alignItems: "flex-start",
      flexWrap: "nowrap",
      boxSizing: "border-box",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 600,
        fontSize: 12,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-secundario)",
        flexShrink: 0,
      }}>{props.rTulo}</span>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 700,
        fontSize: 30,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-primario)",
        flexShrink: 0,
      }}>{props.valor}</span>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 400,
        fontSize: 12,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-secundario)",
        flexShrink: 0,
      }}>{props.contexto}</span>
    </div>
  );
}
export default CardDeMTrica;

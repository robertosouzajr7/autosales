// figma node: 14:6 Cabeçalho de página
export function CabeAlhoDePGina(_p = {}) {
  const props = { ..._p, tTulo: _p.tTulo ?? "Assinatura", subtTulo: _p.subtTulo ?? "Gerencie seu plano, pagamento e faturas." };
  return (
    <div className={props.className} style={{
      width: 420,
      height: 60,
      display: "flex",
      flexDirection: "column",
      gap: 4,
      alignItems: "flex-start",
      flexWrap: "nowrap",
      position: "relative",
      ...props.style,
    }}>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 700,
        fontSize: 24,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-primario)",
        flexShrink: 0,
      }}>{props.tTulo}</span>
      <span style={{
        position: "relative",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif",
        fontWeight: 400,
        fontSize: 14,
        whiteSpace: "nowrap",
        lineHeight: "100%",
        color: "var(--cor-texto-secundario)",
        flexShrink: 0,
      }}>{props.subtTulo}</span>
    </div>
  );
}
export default CabeAlhoDePGina;

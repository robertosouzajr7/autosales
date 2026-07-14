// Módulo de prospecção outbound foi descontinuado. O produto agora é
// inbound (IA de agendamento no WhatsApp). Este stub existe apenas para
// manter compatibilidade com imports antigos (Settings, ICP etc.).

const gone = (_req, res) =>
  res.status(410).json({
    error:
      "Prospecção outbound foi removida da plataforma. O produto atende clientes inbound via WhatsApp.",
  });

export const prospectGeneric = gone;
export const searchApollo = gone;
export const prospectLinkedIn = gone;
export const enrichData = gone;

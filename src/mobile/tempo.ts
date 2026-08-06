/** Quanto tempo faz, dito como se diz em voz alta. */

export function haQuanto(quando: string | Date | null): string {
  if (!quando) return "";
  const minutos = Math.max(0, Math.round((Date.now() - new Date(quando).getTime()) / 60000));
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.round(horas / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias} dias`;
  return new Date(quando).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** "Esperando há 12 minutos" — por extenso, porque é o que dói. */
export function espera(minutos: number): string {
  if (minutos < 1) return "Esperando agora";
  if (minutos === 1) return "Esperando há 1 minuto";
  if (minutos < 60) return `Esperando há ${minutos} minutos`;
  const horas = Math.floor(minutos / 60);
  return horas === 1 ? "Esperando há 1 hora" : `Esperando há ${horas} horas`;
}

export function hora(quando: string | Date): string {
  return new Date(quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

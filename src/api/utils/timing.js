/**
 * Cronômetro leve para medir as etapas de um fluxo e imprimir uma única
 * linha consolidada — em vez de espalhar console.time pelo código.
 *
 *   const sw = stopwatch("webhook");
 *   ... ; sw.lap("stt");
 *   ... ; sw.lap("ia");
 *   sw.done("AUDIO");   // [Perf] webhook AUDIO · total=21.1s · stt=3.2s · ia=17.1s
 *
 * Etapas com menos de 1ms são omitidas para a linha não virar ruído.
 */
export function stopwatch(label) {
  const t0 = process.hrtime.bigint();
  let last = t0;
  const laps = [];

  const ms = (from, to) => Number(to - from) / 1e6;

  return {
    lap(name) {
      const now = process.hrtime.bigint();
      const d = ms(last, now);
      last = now;
      if (d >= 1) laps.push(`${name}=${fmt(d)}`);
      return d;
    },
    done(suffix = "") {
      const total = ms(t0, process.hrtime.bigint());
      const parts = [`total=${fmt(total)}`, ...laps].join(" · ");
      console.log(`[Perf] ${label}${suffix ? ` ${suffix}` : ""} · ${parts}`);
      return total;
    },
  };
}

// Abaixo de 1s mostra em ms; acima, em segundos com 1 casa — mais legível
// quando o número é o que interessa (17.1s em vez de 17100ms).
function fmt(msValue) {
  return msValue < 1000 ? `${Math.round(msValue)}ms` : `${(msValue / 1000).toFixed(1)}s`;
}

export default { stopwatch };

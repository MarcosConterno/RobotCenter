export function formatarData(dataIso: string) {
  const data = new Date(dataIso);

  if (Number.isNaN(data.getTime())) return dataIso;

  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(data);
}

export function formatarDataHora(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(data);
}

export function formatarDataHoraRelativa(dataIso: string) {
  const data = new Date(dataIso);
  if (Number.isNaN(data.getTime())) return dataIso;

  const diferencaEmSegundos = Math.round((data.getTime() - Date.now()) / 1000);
  const unidades = [
    { limite: 60, divisor: 1, unidade: "second" },
    { limite: 3600, divisor: 60, unidade: "minute" },
    { limite: 86400, divisor: 3600, unidade: "hour" },
    { limite: Infinity, divisor: 86400, unidade: "day" },
  ] as const;
  const faixa = unidades.find((item) => Math.abs(diferencaEmSegundos) < item.limite) ?? unidades[3];
  const valor = Math.round(diferencaEmSegundos / faixa.divisor);

  return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(valor, faixa.unidade);
}

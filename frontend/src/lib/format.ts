// Separador de miles en coma y dos decimales: convención de moneda para la app.
export function formatPriceParts(amount: number): { whole: string; cents: string } {
  const [intPart, cents = '00'] = amount.toFixed(2).split('.');
  const whole = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return { whole, cents };
}

// Agrupa solo la parte entera con comas (para kilometraje y contadores sin decimales).
export function groupThousands(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// mm:ss del temporizador de subasta.
export function formatClock(seconds: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

// dd/mm · hh:mm escrito a mano para no depender de Intl en Hermes.
export function formatBidStamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
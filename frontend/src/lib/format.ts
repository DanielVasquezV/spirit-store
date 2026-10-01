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

// Temporizador de subasta: mm:ss en el último tramo, hh:mm:ss o días cuando la subasta dura más.
export function formatClock(seconds: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}`;
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds % 60)}`;
  return `${pad(minutes)}:${pad(seconds % 60)}`;
}

// dd/mm · hh:mm escrito a mano para no depender de Intl en Hermes.
export function formatBidStamp(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
// Hora si es de hoy, "Ayer" o dd/mm: el mismo criterio que mostraba el inbox con datos de prueba.
export function formatChatTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (date.getTime() >= startOfToday) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (date.getTime() >= startOfToday - 86_400_000) return 'Ayer';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

// "$12,345" o, con centavos, "$12,345.67": texto de precio en línea, fuera del componente Price.
export function formatMoney(amount: number, { cents = false }: { cents?: boolean } = {}): string {
  const parts = formatPriceParts(amount);
  return cents ? `$${parts.whole}.${parts.cents}` : `$${parts.whole}`;
}

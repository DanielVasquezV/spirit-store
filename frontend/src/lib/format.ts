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
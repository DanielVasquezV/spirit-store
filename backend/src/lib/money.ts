// Las columnas de dinero son `Decimal(12,2)`. El numero que llega por JSON es un
// float IEEE-754, así que comparar precios con `>=` o sumar incrementos deja
// huecos: 0.1 + 0.2 no es 0.3 y una puja valida puede quedar rejected o, peor,
// aceptada por dos centavos.
//
// Todo el razonamiento de pujas se hace en centavos enteros y recien ahi se
// convierte a Decimal para escribir. Es la unica forma de que "la puja minima"
// signifique lo mismo en el request, en la base y en la comparacion que decide
// el ganador.

/** Centavos enteros de un monto con hasta dos decimales. */
export function toCents(value: number): number {
  return Math.round(value * 100);
}

/** Vuelve a numero de la API, que expone los montos como `number`. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * Texto exacto para Prisma. `Decimal` acepta un number, pero eso reinterpreta el
 * error binario del float: pasar `19.99` puede guardarse como 19.98999999...
 * y el `toFixed(2)` que uno haria a mano justamente lo evita.
 */
export function decimalString(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${units}.${frac}`;
}

/**
 * Si el monto tiene mas de dos decimales. Se tolera el error de coma flotante
 * (0.1 * 100 es 10.000000000000002) con un margen chico: 19.999 queda
 * afuera, que es justo lo que se quiere.
 */
export function hasAtMostTwoDecimals(value: number): boolean {
  const scaled = value * 100;
  return Math.abs(scaled - Math.round(scaled)) < 1e-6;
}
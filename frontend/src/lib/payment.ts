// Validación de tarjeta del pago simulado. Corre solo en el teléfono: al backend viajan marca, últimos 4 y titular.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'card';

// Tarjetas de prueba del simulador, las mismas que usan las pasarelas reales.
export const TEST_CARDS = {
  approved: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
} as const;

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

export function detectBrand(number: string): CardBrand {
  const digits = digitsOnly(number);
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  return 'card';
}

export const BRAND_LABELS: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', card: 'Tarjeta' };

// Grupos de 4 (Amex 4-6-5) para que el número se lea como en el plástico.
export function formatCardNumber(value: string): string {
  const digits = digitsOnly(value).slice(0, 16);
  if (detectBrand(digits) === 'amex') return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10, 15)].filter(Boolean).join(' ');
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

// Algoritmo de Luhn: descarta números mal tipeados antes de "cobrar".
export function passesLuhn(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 13) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

export interface CardFields {
  holderName: string;
  number: string;
  expiry: string;
  cvv: string;
}

export function validateCard(fields: CardFields, now = new Date()): Partial<Record<keyof CardFields, string>> {
  const errors: Partial<Record<keyof CardFields, string>> = {};
  if (fields.holderName.trim().length < 3) errors.holderName = 'Escribí el nombre como aparece en la tarjeta.';
  if (!passesLuhn(fields.number)) errors.number = 'El número de tarjeta no es válido.';
  const [month, year] = fields.expiry.split('/').map(Number);
  // La tarjeta vale hasta el último día del mes impreso.
  const expiresAt = new Date(2000 + (year ?? 0), month ?? 0, 1);
  if (!month || month > 12 || !year || expiresAt <= now) errors.expiry = 'Revisá la fecha de vencimiento (MM/AA).';
  const cvvLength = detectBrand(fields.number) === 'amex' ? 4 : 3;
  if (digitsOnly(fields.cvv).length !== cvvLength) errors.cvv = `El CVV tiene ${cvvLength} dígitos.`;
  return errors;
}

// Minutos y segundos que le quedan a una reserva.
export function remainingMs(expiresAt: string | null, now = Date.now()): number {
  return expiresAt ? Math.max(0, new Date(expiresAt).getTime() - now) : 0;
}

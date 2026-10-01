import { prisma } from '../../lib/prisma.js';
import {
  CATEGORY_LABELS,
  FUEL_LABELS,
  SALE_TYPE_LABELS,
  TRANSMISSION_LABELS,
} from '../../services/taxonomy.js';
import type { Category, Fuel, Transmission } from '../../generated/prisma/client.js';

// Muestra corta del catálogo real para que el modelo recomiende autos que existen, dentro del límite de tokens de Groq gratis.

const MAX_CANDIDATES = 40;
const MAX_IN_PROMPT = 12;
// Un diagnóstico casi nunca termina en recomendación: con pocas filas el prompt queda liviano.
const MAX_WITHOUT_SHOPPING_INTENT = 4;

const SHOPPING_WORDS = ['busco', 'recomienda', 'recomendame', 'comprar', 'quiero un', 'quiero una', 'opciones', 'presupuesto', 'me conviene', 'cual carro', 'que carro', 'alternativa'];

export interface CatalogCandidate {
  id: string;
  line: string;
}

const CATEGORY_WORDS: Record<Category, string[]> = {
  PICKUP: ['pickup', 'pick up', 'camioneta', 'paila', 'carga', '4x4', 'trabajo'],
  SUV: ['suv', 'familiar', 'camioneta', 'todoterreno', 'off road', 'offroad'],
  SEDAN: ['sedan', 'ejecutivo'],
  SPORT: ['deportivo', 'sport', 'rapido', 'potente', 'coupe'],
  ELECTRIC: ['electrico', 'ev', 'bateria'],
  COMPACT: ['compacto', 'economico', 'ciudad', 'hatchback', 'pequeno', 'primer carro'],
};

const FUEL_WORDS: Record<Fuel, string[]> = {
  DIESEL: ['diesel'],
  GASOLINE: ['gasolina', 'nafta'],
  ELECTRIC: ['electrico'],
  HYBRID: ['hibrido'],
};

const TRANSMISSION_WORDS: Record<Transmission, string[]> = {
  MANUAL: ['manual', 'estandar', 'mecanico'],
  AUTOMATIC: ['automatico', 'automatica'],
};

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

// "30 mil", "$30,000", "30k" → 30000. Se toma el número más alto: suele ser el techo del presupuesto.
export function parseBudget(text: string): number | undefined {
  const normalized = normalize(text).replace(/,/g, '');
  const amounts = [...normalized.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(mil|k)?/g)]
    .map((match) => Number(match[1]) * (match[2] ? 1000 : 1))
    .filter((value) => value >= 1000 && value <= 5_000_000);
  return amounts.length > 0 ? Math.max(...amounts) : undefined;
}

function matches<T extends string>(text: string, table: Record<T, string[]>): T[] {
  return (Object.keys(table) as T[]).filter((key) => table[key].some((word) => text.includes(word)));
}

// Candidatos del catálogo ordenados por afinidad con lo que pidió el usuario.
export async function buildCatalogContext(userText: string): Promise<CatalogCandidate[]> {
  const text = normalize(userText);
  const categories = matches(text, CATEGORY_WORDS);
  const fuels = matches(text, FUEL_WORDS);
  const transmissions = matches(text, TRANSMISSION_WORDS);
  const budget = parseBudget(userText);
  const shopping = Boolean(budget) || categories.length > 0 || SHOPPING_WORDS.some((word) => text.includes(word));

  const rows = await prisma.vehicle.findMany({
    where: {
      deletedAt: null,
      status: { in: ['AVAILABLE', 'IN_AUCTION'] },
      // Un margen del 15% sobre el presupuesto deja recomendar algo apenas por encima si encaja mucho mejor.
      ...(budget ? { basePrice: { lte: budget * 1.15 } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_CANDIDATES,
    include: { auction: { select: { status: true, currentBid: true, startingPrice: true } } },
  });

  const scored = rows.map((row) => {
    let score = 0;
    if (categories.includes(row.category)) score += 3;
    if (fuels.includes(row.fuel)) score += 2;
    if (transmissions.includes(row.transmission)) score += 2;
    if (text.includes(normalize(row.brand))) score += 3;
    if (text.includes(normalize(row.model).split(' ')[0])) score += 2;
    return { row, score };
  });
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, shopping ? MAX_IN_PROMPT : MAX_WITHOUT_SHOPPING_INTENT).map(({ row }) => {
    const price = row.auction?.status === 'ACTIVE'
      ? `subasta, puja actual $${Number(row.auction.currentBid ?? row.auction.startingPrice).toLocaleString('en-US')}`
      : `$${Number(row.basePrice).toLocaleString('en-US')} ${SALE_TYPE_LABELS[row.saleType].toLowerCase()}`;
    return {
      id: row.id,
      line: [
        row.id,
        `${row.brand} ${row.model} ${row.year}`,
        CATEGORY_LABELS[row.category],
        FUEL_LABELS[row.fuel],
        TRANSMISSION_LABELS[row.transmission],
        `${row.mileage.toLocaleString('en-US')} km`,
        `${row.engine}, ${row.power}, ${row.drivetrain}`,
        price,
      ].join(' | '),
    };
  });
}

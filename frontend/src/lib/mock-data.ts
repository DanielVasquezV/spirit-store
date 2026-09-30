import { groupThousands } from '@/lib/format';

export type Category = { id: string; label: string };

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'Todo' },
  { id: 'suv', label: 'SUV' },
  { id: 'sedan', label: 'Sedán' },
  { id: 'sport', label: 'Deportivo' },
  { id: 'electric', label: 'Eléctrico' },
  { id: 'pickup', label: 'Pickup' },
  { id: 'compact', label: 'Compacto' },
];

export const FUEL_OPTIONS = ['Todos', 'Gasolina', 'Diésel', 'Eléctrico', 'Híbrido'] as const;

export type Fuel = (typeof FUEL_OPTIONS)[number];

export type ProductTech = { engine: string; power: string; drivetrain: string };

// Fotos de relleno determinísticas; se reemplazan por las del vehículo real.
function placeholderImages(id: string): string[] {
  return [1, 2, 3].map((n) => `https://picsum.photos/seed/spirit-${id}-${n}/1200/800`);
}

export type Product = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  transmission: 'Automática' | 'Manual';
  fuel: Fuel;
  category: Exclude<Category['id'], 'all'>;
  saleType: SaleType;
  price: number;
  tech: ProductTech;
  images: string[];
};

export const MOCK_VEHICLES: Product[] = [
  {
    id: 'p1',
    title: 'Toyota Hilux SRX',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2023,
    mileage: 18500,
    transmission: 'Automática',
    fuel: 'Diésel',
    category: 'pickup',
    saleType: 'DIRECT_SALE',
    price: 42900,
    tech: { engine: '2.8L Diésel Turbo', power: '204 HP', drivetrain: '4x4' },
    images: placeholderImages('p1'),
  },
  {
    id: 'p2',
    title: 'BMW Serie 3 330i',
    brand: 'BMW',
    model: 'Serie 3',
    year: 2022,
    mileage: 34000,
    transmission: 'Automática',
    fuel: 'Gasolina',
    category: 'sedan',
    saleType: 'BOTH',
    price: 38900,
    tech: { engine: '2.0L Turbo', power: '258 HP', drivetrain: 'RWD' },
    images: placeholderImages('p2'),
  },
  {
    id: 'p3',
    title: 'Porsche 911 Carrera',
    brand: 'Porsche',
    model: '911',
    year: 2021,
    mileage: 12000,
    transmission: 'Automática',
    fuel: 'Gasolina',
    category: 'sport',
    saleType: 'AUCTION',
    price: 128500,
    tech: { engine: '3.0L Boxer Turbo', power: '385 HP', drivetrain: 'RWD' },
    images: placeholderImages('p3'),
  },
  {
    id: 'p4',
    title: 'Tesla Model 3 Long Range',
    brand: 'Tesla',
    model: 'Model 3',
    year: 2023,
    mileage: 21000,
    transmission: 'Automática',
    fuel: 'Eléctrico',
    category: 'electric',
    saleType: 'DIRECT_SALE',
    price: 47500,
    tech: { engine: 'Doble motor eléctrico', power: '346 HP', drivetrain: 'AWD' },
    images: placeholderImages('p4'),
  },
  {
    id: 'p5',
    title: 'Volkswagen Golf GTI',
    brand: 'Volkswagen',
    model: 'Golf GTI',
    year: 2022,
    mileage: 27000,
    transmission: 'Manual',
    fuel: 'Gasolina',
    category: 'compact',
    saleType: 'DIRECT_SALE',
    price: 31800,
    tech: { engine: '2.0L TSI Turbo', power: '245 HP', drivetrain: 'FWD' },
    images: placeholderImages('p5'),
  },
  {
    id: 'p6',
    title: 'Chevrolet Silverado',
    brand: 'Chevrolet',
    model: 'Silverado',
    year: 2023,
    mileage: 15000,
    transmission: 'Automática',
    fuel: 'Gasolina',
    category: 'pickup',
    saleType: 'AUCTION',
    price: 52900,
    tech: { engine: '5.3L V8', power: '355 HP', drivetrain: '4x4' },
    images: placeholderImages('p6'),
  },
  {
    id: 'p7',
    title: 'Mercedes-Benz Clase G',
    brand: 'Mercedes-Benz',
    model: 'Clase G',
    year: 2022,
    mileage: 28000,
    transmission: 'Automática',
    fuel: 'Diésel',
    category: 'suv',
    saleType: 'AUCTION',
    price: 142000,
    tech: { engine: '3.0L Diésel', power: '286 HP', drivetrain: 'AWD' },
    images: placeholderImages('p7'),
  },
  {
    id: 'p8',
    title: 'Honda Civic Si',
    brand: 'Honda',
    model: 'Civic',
    year: 2023,
    mileage: 9000,
    transmission: 'Manual',
    fuel: 'Gasolina',
    category: 'compact',
    saleType: 'DIRECT_SALE',
    price: 27500,
    tech: { engine: '1.5L VTEC Turbo', power: '200 HP', drivetrain: 'FWD' },
    images: placeholderImages('p8'),
  },
  {
    id: 'p9',
    title: 'Ford Mustang GT',
    brand: 'Ford',
    model: 'Mustang',
    year: 2021,
    mileage: 31000,
    transmission: 'Automática',
    fuel: 'Gasolina',
    category: 'sport',
    saleType: 'BOTH',
    price: 45000,
    tech: { engine: '5.0L V8', power: '450 HP', drivetrain: 'RWD' },
    images: placeholderImages('p9'),
  },
];

export const FEATURED_PRODUCTS: Product[] = [
  MOCK_VEHICLES[0],
  MOCK_VEHICLES[1],
  MOCK_VEHICLES[3],
  MOCK_VEHICLES[4],
  MOCK_VEHICLES[7],
];

export const AUCTION_PRODUCTS: Product[] = [MOCK_VEHICLES[2], MOCK_VEHICLES[5], MOCK_VEHICLES[6]];

export function getProductById(id: string): Product | undefined {
  return MOCK_VEHICLES.find((product) => product.id === id);
}

export type Seller = { name: string; city: string; verified: boolean };

export const SELLERS: Record<string, Seller> = {
  p1: { name: 'Josué Ramírez', city: 'San Salvador', verified: true },
  p2: { name: 'Camila Ordóñez', city: 'Santa Tecla', verified: true },
  p3: { name: 'Andrés Molina', city: 'San Salvador', verified: false },
  p4: { name: 'Tech Motion SV', city: 'Antiguo Cuscatlán', verified: true },
  p5: { name: 'Diego Henríquez', city: 'Santa Ana', verified: true },
  p6: { name: 'Región Motors', city: 'San Miguel', verified: true },
  p7: { name: 'Alejandro Paz', city: 'Santa Tecla', verified: true },
  p8: { name: 'Diego Henríquez', city: 'Santa Ana', verified: true },
  p9: { name: 'Camila Ordóñez', city: 'Santa Tecla', verified: true },
};

export type ChatType = 'buy' | 'sell';

export type ChatMessage = { id: string; from: 'me' | 'peer'; text: string; time: string };

export type ChatThread = {
  id: string;
  type: ChatType;
  peerName: string;
  vehicleId: string;
  lastTime: string;
  unread: number;
  messages: ChatMessage[];
};

export const CHAT_THREADS: ChatThread[] = [
  {
    id: 'c1',
    type: 'buy',
    peerName: 'María López',
    vehicleId: 'p1',
    lastTime: '09:42',
    unread: 2,
    messages: [
      { id: 'm1', from: 'peer', text: 'Hola, ¿sigue disponible la Hilux?', time: '08:10' },
      { id: 'm2', from: 'me', text: '¡Hola María! Sí, sigue disponible.', time: '08:15' },
      { id: 'm3', from: 'peer', text: '¿Aceptás financiamiento bancario?', time: '09:40' },
      { id: 'm4', from: 'peer', text: 'La vería este sábado si se puede.', time: '09:42' },
    ],
  },
  {
    id: 'c2',
    type: 'sell',
    peerName: 'Carlos Menjívar',
    vehicleId: 'p7',
    lastTime: 'Ayer',
    unread: 0,
    messages: [
      { id: 'm5', from: 'me', text: 'Te comparto los documentos de la Clase G.', time: 'Ayer' },
      { id: 'm6', from: 'peer', text: 'Perfecto, los reviso y te confirmo la prueba.', time: 'Ayer' },
    ],
  },
  {
    id: 'c3',
    type: 'buy',
    peerName: 'Ana Torres',
    vehicleId: 'p3',
    lastTime: '14:05',
    unread: 1,
    messages: [
      { id: 'm7', from: 'peer', text: '¿Cómo va la subasta del 911?', time: '13:58' },
      { id: 'm8', from: 'peer', text: 'Estoy siguiendo las ofertas.', time: '14:05' },
    ],
  },
];

export type CartItem = { id: string; vehicleId: string; title: string; price: number; year: number };

export const CART_ITEMS: CartItem[] = [
  { id: 'i1', vehicleId: 'p1', title: 'Toyota Hilux SRX', price: 42900, year: 2023 },
  { id: 'i2', vehicleId: 'p5', title: 'Volkswagen Golf GTI', price: 31800, year: 2022 },
  { id: 'i3', vehicleId: 'p2', title: 'BMW Serie 3 330i', price: 38900, year: 2022 },
];

export const CART_COUNT = CART_ITEMS.length;

export const AUCTION_BIDDERS = ['María López', 'Carlos Menjívar', 'Ana Torres', 'Josué Ramírez', 'Región Motors'];

export type SaleType = 'DIRECT_SALE' | 'AUCTION' | 'BOTH';

export function saleBadges(saleType: SaleType): string[] {
  if (saleType === 'BOTH') return ['Venta directa', 'Subasta'];
  return saleType === 'DIRECT_SALE' ? ['Venta directa'] : ['Subasta'];
}

export function vehicleSpecs(product: Product): string[] {
  return [`${product.year}`, product.transmission, `${groupThousands(product.mileage)} km`];
}

export function techSpecs(product: Product): { label: string; value: string }[] {
  return [
    { label: 'Motor', value: product.tech.engine },
    { label: 'Potencia', value: product.tech.power },
    { label: 'Tracción', value: product.tech.drivetrain },
    { label: 'Transmisión', value: product.transmission },
    { label: 'Combustible', value: product.fuel },
    { label: 'Kilometraje', value: `${groupThousands(product.mileage)} km` },
  ];
}
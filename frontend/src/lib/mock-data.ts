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

export type SaleType = 'DIRECT_SALE' | 'AUCTION' | 'BOTH';

export type Product = {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  transmission: string;
  saleType: SaleType;
  price: number;
};

export const FEATURED_PRODUCTS: Product[] = [
  {
    id: 'p1',
    title: 'Toyota Hilux SRX',
    brand: 'Toyota',
    model: 'Hilux',
    year: 2023,
    mileage: 18500,
    transmission: 'Automática',
    saleType: 'DIRECT_SALE',
    price: 42900,
  },
  {
    id: 'p2',
    title: 'BMW Serie 3 330i',
    brand: 'BMW',
    model: 'Serie 3',
    year: 2022,
    mileage: 34000,
    transmission: 'Automática',
    saleType: 'BOTH',
    price: 38900,
  },
  {
    id: 'p3',
    title: 'Porsche 911 Carrera',
    brand: 'Porsche',
    model: '911',
    year: 2021,
    mileage: 12000,
    transmission: 'Automática',
    saleType: 'AUCTION',
    price: 128500,
  },
  {
    id: 'p4',
    title: 'Tesla Model 3 Long Range',
    brand: 'Tesla',
    model: 'Model 3',
    year: 2023,
    mileage: 21000,
    transmission: 'Automática',
    saleType: 'DIRECT_SALE',
    price: 47500,
  },
  {
    id: 'p5',
    title: 'Volkswagen Golf GTI',
    brand: 'Volkswagen',
    model: 'Golf GTI',
    year: 2022,
    mileage: 27000,
    transmission: 'Manual',
    saleType: 'DIRECT_SALE',
    price: 31800,
  },
  {
    id: 'p6',
    title: 'Chevrolet Silverado',
    brand: 'Chevrolet',
    model: 'Silverado',
    year: 2023,
    mileage: 15000,
    transmission: 'Automática',
    saleType: 'AUCTION',
    price: 52900,
  },
];

export const AUCTION_PRODUCTS: Product[] = [
  { ...FEATURED_PRODUCTS[2] },
  { ...FEATURED_PRODUCTS[5] },
  {
    id: 'p7',
    title: 'Mercedes-Benz Clase G',
    brand: 'Mercedes-Benz',
    model: 'Clase G',
    year: 2022,
    mileage: 28000,
    transmission: 'Automática',
    saleType: 'AUCTION',
    price: 142000,
  },
];

export function saleBadges(saleType: SaleType): string[] {
  if (saleType === 'BOTH') return ['Venta directa', 'Subasta'];
  return saleType === 'DIRECT_SALE' ? ['Venta directa'] : ['Subasta'];
}

export function vehicleSpecs(product: Product): string[] {
  return [`${product.year}`, product.transmission, `${product.mileage.toLocaleString()} km`];
}

export const CART_COUNT = 3;
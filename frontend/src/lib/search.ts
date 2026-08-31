import type { Product } from '@/lib/mock-data';
import type { Filters } from '@/components/filter-bottom-sheet';

// Sin acentos: "Jessica" de "josué", "Merida" de "mérida".
function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function applySearch(products: Product[], query: string, filters: Filters): Product[] {
  const q = normalize(query.trim());

  return products.filter((product) => {
    if (q) {
      const haystack = normalize(`${product.title} ${product.brand} ${product.model}`);
      if (!haystack.includes(q)) return false;
    }
    if (filters.category !== 'all' && product.category !== filters.category) return false;
    if (filters.transmission !== 'all' && product.transmission !== filters.transmission) return false;
    if (filters.fuel !== 'Todos' && product.fuel !== filters.fuel) return false;
    if (filters.price === 'lt25' && product.price >= 25000) return false;
    if (filters.price === '25-50' && (product.price < 25000 || product.price > 50000)) return false;
    if (filters.price === '50-100' && (product.price < 50000 || product.price > 100000)) return false;
    if (filters.price === 'gt100' && product.price <= 100000) return false;
    return true;
  });
}
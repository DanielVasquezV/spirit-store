import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { VehicleDto } from '@/lib/types/api';

export interface CartItem {
  vehicleId: string;
  title: string;
  year: number;
  price: number;
  imageUrl: string | null;
}

export interface CartValue {
  items: CartItem[];
  count: number;
  add: (vehicle: VehicleDto) => void;
  remove: (vehicleId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

// El carrito es UI local y vive solo en memoria: el backend no tiene tabla de
// carrito y cada orden nace de un vehicleId. Sobrevive mientras la app no se cierre.
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const add = useCallback((vehicle: VehicleDto) => {
    setItems((current) =>
      current.some((item) => item.vehicleId === vehicle.id)
        ? current
        : [
            ...current,
            {
              vehicleId: vehicle.id,
              title: vehicle.title,
              year: vehicle.year,
              price: vehicle.basePrice,
              imageUrl: vehicle.images[0]?.url ?? null,
            },
          ],
    );
  }, []);

  const remove = useCallback((vehicleId: string) => {
    setItems((current) => current.filter((item) => item.vehicleId !== vehicleId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartValue>(() => ({ items, count: items.length, add, remove, clear }), [items, add, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('useCart debe usarse dentro de CartProvider');
  return value;
}
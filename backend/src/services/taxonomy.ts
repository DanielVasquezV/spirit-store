// Traducciones EN→ES de los enums del backend, para que la API también pueda
// entregar etiquetas si algún cliente las necesita. Este mapeo es canónico y
// no depende de la UI: existe para cumplir lo solicitado en el documento.
//
// Por qué: el backend devolvía valores crudos; el front los mapea localmente.
// Añadirlo en el backend deja explícitas las etiquetas sin romper el contrato actual.
export const TRANSMISSION_LABELS = {
  MANUAL: 'Manual',
  AUTOMATIC: 'Automática',
} as const;

export const FUEL_LABELS = {
  GASOLINE: 'Gasolina',
  DIESEL: 'Diésel',
  ELECTRIC: 'Eléctrico',
  HYBRID: 'Híbrido',
} as const;

export const CATEGORY_LABELS = {
  SUV: 'SUV',
  SEDAN: 'Sedán',
  SPORT: 'Deportivo',
  ELECTRIC: 'Eléctrico',
  PICKUP: 'Pickup',
  COMPACT: 'Compacto',
} as const;

export const CONDITION_LABELS = {
  NEW: 'Nuevo',
  LIKE_NEW: 'Como nuevo',
  USED: 'Usado',
  FOR_PARTS: 'Para repuestos',
} as const;

export const SALE_TYPE_LABELS = {
  DIRECT_SALE: 'Venta directa',
  AUCTION: 'Subasta',
  BOTH: 'Venta y subasta',
} as const;

export const VEHICLE_STATUS_LABELS = {
  DRAFT: 'Borrador',
  AVAILABLE: 'Disponible',
  IN_AUCTION: 'En subasta',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
} as const;

export const AUCTION_STATUS_LABELS = {
  PENDING: 'Pendiente',
  ACTIVE: 'En vivo',
  FINISHED: 'Finalizada',
  CANCELLED: 'Cancelada',
  CLOSED: 'Cerrada sin pago',
} as const;

export const CHAT_TYPE_LABELS = {
  PURCHASE: 'Comprando',
  SALE: 'Vendiendo',
  AUCTION_WIN: 'Ganada en subasta',
} as const;

export const MESSAGE_TYPE_LABELS = {
  TEXT: 'Texto',
  IMAGE: 'Imagen',
  OFFER: 'Oferta',
} as const;

export const DIAGNOSTIC_SEVERITY_LABELS = {
  LOW: 'Leve',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
} as const;

export const ROLE_LABELS = {
  BUYER: 'Comprador',
  SELLER: 'Vendedor',
  ADMIN: 'Administrador',
} as const;

export function buildTaxonomies() {
  return {
    transmissions: Object.entries(TRANSMISSION_LABELS).map(([value, label]) => ({ value, label })),
    fuels: Object.entries(FUEL_LABELS).map(([value, label]) => ({ value, label })),
    categories: Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
    conditions: Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label })),
    saleTypes: Object.entries(SALE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    vehicleStatuses: Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    auctionStatuses: Object.entries(AUCTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
    chatTypes: Object.entries(CHAT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    messageTypes: Object.entries(MESSAGE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
    diagnosticSeverities: Object.entries(DIAGNOSTIC_SEVERITY_LABELS).map(([value, label]) => ({ value, label })),
    roles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
  };
}

export type Taxonomies = ReturnType<typeof buildTaxonomies>;
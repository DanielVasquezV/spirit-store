import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { deleteAsset } from '../upload/upload.service.js';
import type {
  AuctionStatus,
  Category,
  Condition,
  Fuel,
  Prisma,
  SaleType,
  Transmission,
  VehicleStatus,
} from '../../generated/prisma/client.js';

// Relaciones que necesita la ficha publica. El `select` del vendedor toma
// `duiPhotoUrl` para poder derivar `isVerified`, pero el DTO lo descarta: la
// foto del documento nunca viaja al catalogo.
export const VEHICLE_INCLUDE = {
  images: { orderBy: { position: 'asc' } },
  auction: true,
  seller: { select: { id: true, fullName: true, duiPhotoUrl: true } },
} as const satisfies Prisma.VehicleInclude;

type VehicleRow = Prisma.VehicleGetPayload<{ include: typeof VEHICLE_INCLUDE }>;

export interface VehicleImageDto {
  id: string;
  url: string;
  publicId: string | null;
  position: number;
}

export interface VehicleSellerDto {
  id: string;
  fullName: string;
  /** Tiene el DUI cargado. Es lo que habilita a publicar. */
  isVerified: boolean;
}

export interface VehicleAuctionDto {
  id: string;
  status: AuctionStatus;
  startingPrice: number;
  currentBid: number | null;
  minBidIncrement: number;
  startTime: string;
  endTime: string;
}

export interface VehicleDto {
  id: string;
  sellerId: string;
  vin: string;
  licensePlate: string;
  brand: string;
  model: string;
  /** Derivado de `brand` + `model`. La app lo pinta como nombre de la card. */
  title: string;
  year: number;
  mileage: number;
  transmission: Transmission;
  fuel: Fuel;
  category: Category;
  engine: string;
  power: string;
  drivetrain: string;
  condition: Condition;
  color: string | null;
  basePrice: number;
  saleType: SaleType;
  status: VehicleStatus;
  description: string | null;
  images: VehicleImageDto[];
  seller: VehicleSellerDto;
  auction: VehicleAuctionDto | null;
  createdAt: string;
  updatedAt: string;
}

// Dinero a numero y fechas a ISO. Prisma serializa `Decimal` como string y la
// app del catalogo hace aritmetica con el precio, asi que un `"42900"` en el
// JSON la obliga a parsear en cada pantalla.
export function toVehicleDto(row: VehicleRow): VehicleDto {
  return {
    id: row.id,
    sellerId: row.sellerId,
    vin: row.vin,
    licensePlate: row.licensePlate,
    brand: row.brand,
    model: row.model,
    title: `${row.brand} ${row.model}`.trim(),
    year: row.year,
    mileage: row.mileage,
    transmission: row.transmission,
    fuel: row.fuel,
    category: row.category,
    engine: row.engine,
    power: row.power,
    drivetrain: row.drivetrain,
    condition: row.condition,
    color: row.color,
    basePrice: Number(row.basePrice),
    saleType: row.saleType,
    status: row.status,
    description: row.description,
    images: row.images.map((image) => ({
      id: image.id,
      url: image.url,
      publicId: image.publicId,
      position: image.position,
    })),
    seller: {
      id: row.seller.id,
      fullName: row.seller.fullName,
      isVerified: Boolean(row.seller.duiPhotoUrl),
    },
    auction: row.auction
      ? {
          id: row.auction.id,
          status: row.auction.status,
          startingPrice: Number(row.auction.startingPrice),
          currentBid: row.auction.currentBid === null ? null : Number(row.auction.currentBid),
          minBidIncrement: Number(row.auction.minBidIncrement),
          startTime: row.auction.startTime.toISOString(),
          endTime: row.auction.endTime.toISOString(),
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Texto de busqueda de un vehiculo: marca + modelo en minusculas y sin
 * diacriticos.
 *
 * Se guarda en `vehicles.searchText` en vez de buscar sobre `brand`/`model`
 * porque la extension `unaccent` de Postgres no esta disponible: con `ILIKE` a
 * secas "skoda" no encuentra "Skoda" ni "sedan" encuentra "Sedan".
 * Normalizando en la app se resuelve sin depender de como este configurada la
 * base.
 */
export function buildSearchText({ brand, model }: { brand: string; model: string }): string {
  return [brand, model]
    .map((part) => part.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim())
    .filter(Boolean)
    .join(' ');
}

export interface VehicleFilters {
  q?: string;
  category?: Category;
  fuel?: Fuel;
  transmission?: Transmission;
  saleType?: SaleType;
  status?: VehicleStatus;
  minPrice?: number;
  maxPrice?: number;
  sellerId?: string;
}

function buildWhere(filters: VehicleFilters, { includeDrafts }: { includeDrafts: boolean }): Prisma.VehicleWhereInput {
  const where: Prisma.VehicleWhereInput = { deletedAt: null };

  // Los borradores son publicaciones sin terminar: solo los ve su dueño.
  if (filters.status === 'DRAFT' && !includeDrafts) {
    where.status = { not: 'DRAFT' };
  } else if (filters.status) {
    where.status = filters.status;
  } else if (!includeDrafts) {
    where.status = { not: 'DRAFT' };
  }

  if (filters.sellerId) where.sellerId = filters.sellerId;
  if (filters.category) where.category = filters.category;
  if (filters.fuel) where.fuel = filters.fuel;
  if (filters.transmission) where.transmission = filters.transmission;
  if (filters.saleType) where.saleType = filters.saleType;

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.basePrice = {
      ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
      ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
    };
  }

  if (filters.q) {
    // Un solo campo con marca + modelo. La comparacion es sensible a mayusculas
    // a proposito: los dos lados ya llegan en minusculas desde buildSearchText,
    // asi que no hace falta (ni conviene) pedirle a la base un ILIKE.
    where.searchText = { contains: buildSearchText({ brand: filters.q, model: '' }) };
  }

  return where;
}

export interface Page {
  skip: number;
  take: number;
}

export interface VehiclePage {
  rows: VehicleDto[];
  total: number;
}

async function runPage(where: Prisma.VehicleWhereInput, page: Page): Promise<{ rows: VehicleRow[]; total: number }> {
  const [total, rows] = await prisma.$transaction([
    prisma.vehicle.count({ where }),
    prisma.vehicle.findMany({
      where,
      include: VEHICLE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: page.skip,
      take: page.take,
    }),
  ]);
  return { rows, total };
}

/** Catalogo publico: sin borradores ni vehiculos dados de baja. */
export async function listVehicles(
  filters: VehicleFilters,
  page: Page,
): Promise<VehiclePage> {
  const { rows, total } = await runPage(buildWhere(filters, { includeDrafts: false }), page);
  return { rows: rows.map(toVehicleDto), total };
}

/** Publicaciones propias, incluyendo borradores. */
export async function listMyVehicles(
  sellerId: string,
  filters: VehicleFilters,
  page: Page,
): Promise<VehiclePage> {
  const where = buildWhere({ ...filters, sellerId }, { includeDrafts: true });
  const { rows, total } = await runPage(where, page);
  return { rows: rows.map(toVehicleDto), total };
}

export interface Requester {
  id: string;
  role: string;
}

function canManage(row: { sellerId: string }, requester: Requester): boolean {
  return row.sellerId === requester.id || requester.role === 'ADMIN';
}

function assertCanManage(row: { sellerId: string }, requester: Requester): void {
  if (!canManage(row, requester)) {
    throw AppError.forbidden('Solo el vendedor que publico el vehiculo puede modificarlo');
  }
}

/**
 * `viewer` decide si un borrador es visible: su dueño y un ADMIN lo ven, el
 * resto recibe 404 y no 403, para no revelar que el id existe.
 */
export async function getVehicleById(
  id: string,
  viewer?: Requester,
): Promise<VehicleDto | null> {
  const row = await prisma.vehicle.findFirst({ where: { id, deletedAt: null }, include: VEHICLE_INCLUDE });
  if (!row) return null;
  if (row.status === 'DRAFT' && !(viewer && canManage(row, viewer))) return null;
  return toVehicleDto(row);
}

export interface VehicleImageInput {
  url: string;
  publicId?: string;
}

export interface AuctionInput {
  startingPrice: number;
  startTime?: Date;
  endTime: Date;
  minBidIncrement?: number;
}

export interface CreateVehicleInput {
  vin: string;
  licensePlate: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  transmission: Transmission;
  fuel: Fuel;
  category: Category;
  engine: string;
  power: string;
  drivetrain: string;
  condition?: Condition;
  color?: string;
  basePrice: number;
  saleType: SaleType;
  description?: string;
  images?: VehicleImageInput[];
  auction?: AuctionInput;
}

// Una subasta arrancada ya esta ACTIVE; una con startTime futuro queda PENDING
// hasta que el job/socket la levante. Asi el listado no muestra como "en vivo"
// algo que todavia no abrio.
function initialAuctionStatus(startTime: Date): AuctionStatus {
  return startTime.getTime() <= Date.now() ? 'ACTIVE' : 'PENDING';
}

export async function createVehicle(
  seller: Requester & { duiPhotoUrl?: string | null },
  input: CreateVehicleInput,
): Promise<VehicleDto> {
  // Regla de la plataforma (db-er.mermaid): para enlistar hace falta el DUI del
  // vendedor. Sin el no hay forma de saber que quien publica es el dueño.
  if (!seller.duiPhotoUrl) {
    throw AppError.badRequest(
      'Carga tu DUI en el perfil antes de publicar un vehiculo',
      { duiPhotoUrl: 'El DUI es obligatorio para publicar' },
    );
  }

  const startTime = input.auction?.startTime ?? new Date();
  const hasAuction = Boolean(input.auction);
  const status: VehicleStatus = hasAuction ? 'IN_AUCTION' : 'AVAILABLE';

  const row = await prisma.vehicle.create({
    data: {
      sellerId: seller.id,
      vin: input.vin,
      licensePlate: input.licensePlate,
      brand: input.brand,
      model: input.model,
      year: input.year,
      mileage: input.mileage,
      transmission: input.transmission,
      fuel: input.fuel,
      category: input.category,
      engine: input.engine,
      power: input.power,
      drivetrain: input.drivetrain,
      ...(input.condition ? { condition: input.condition } : {}),
      ...(input.color ? { color: input.color } : {}),
      basePrice: input.basePrice,
      saleType: input.saleType,
      status,
      searchText: buildSearchText({ brand: input.brand, model: input.model }),
      ...(input.description ? { description: input.description } : {}),
      ...(input.images && input.images.length > 0
        ? {
            images: {
              create: input.images.map((image, index) => ({
                url: image.url,
                ...(image.publicId ? { publicId: image.publicId } : {}),
                position: index,
              })),
            },
          }
        : {}),
      ...(input.auction
        ? {
            auction: {
              create: {
                sellerId: seller.id,
                startingPrice: input.auction.startingPrice,
                minBidIncrement: input.auction.minBidIncrement,
                startTime,
                endTime: input.auction.endTime,
                status: initialAuctionStatus(startTime),
              },
            },
          }
        : {}),
    },
    include: VEHICLE_INCLUDE,
  });

  return toVehicleDto(row);
}

export interface UpdateVehicleInput {
  brand?: string;
  model?: string;
  year?: number;
  mileage?: number;
  transmission?: Transmission;
  fuel?: Fuel;
  category?: Category;
  engine?: string;
  power?: string;
  drivetrain?: string;
  condition?: Condition;
  color?: string | null;
  basePrice?: number;
  status?: VehicleStatus;
  description?: string | null;
}

export async function updateVehicle(
  id: string,
  requester: Requester,
  input: UpdateVehicleInput,
): Promise<VehicleDto> {
  const current = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
  if (!current) throw AppError.notFound('Vehicle');
  assertCanManage(current, requester);

  // While there is an auction running, the vehicle's state belongs to the
  // auction: a seller who puts it back as AVAILABLE/DRAFT would leave an active
  // auction bidding on a car that is also for sale at a fixed price. The way out
  // is to cancel the auction (DELETE /auctions/:id), which returns the vehicle
  // to AVAILABLE by itself.
  if (input.status !== undefined) {
    const openAuction = await prisma.auction.findFirst({
      where: { vehicleId: id, status: { in: ['PENDING', 'ACTIVE'] } },
      select: { id: true },
    });
    if (openAuction) {
      throw AppError.conflict(
        'El vehiculo tiene una subasta en curso: cancelala antes de cambiar el estado',
      );
    }
  }

  const row = await prisma.vehicle.update({
    where: { id },
    data: {
      ...(input.brand !== undefined ? { brand: input.brand } : {}),
      ...(input.model !== undefined ? { model: input.model } : {}),
      ...(input.year !== undefined ? { year: input.year } : {}),
      ...(input.mileage !== undefined ? { mileage: input.mileage } : {}),
      ...(input.transmission !== undefined ? { transmission: input.transmission } : {}),
      ...(input.fuel !== undefined ? { fuel: input.fuel } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.engine !== undefined ? { engine: input.engine } : {}),
      ...(input.power !== undefined ? { power: input.power } : {}),
      ...(input.drivetrain !== undefined ? { drivetrain: input.drivetrain } : {}),
      ...(input.condition !== undefined ? { condition: input.condition } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.basePrice !== undefined ? { basePrice: input.basePrice } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      searchText: buildSearchText({
        brand: input.brand ?? current.brand,
        model: input.model ?? current.model,
      }),
    },
    include: VEHICLE_INCLUDE,
  });

  return toVehicleDto(row);
}

export async function softDeleteVehicle(id: string, requester: Requester): Promise<void> {
  const current = await prisma.vehicle.findFirst({ where: { id, deletedAt: null } });
  if (!current) throw AppError.notFound('Vehicle');
  assertCanManage(current, requester);

  // Borrado logico: los chats, ordenes y pujas que referencian el vehiculo
  // tienen que seguir resolviendo el historial. Y la subasta se cancela en la
  // misma transaccion para que no quede una subasta viva sobre algo dado de baja.
  await prisma.$transaction([
    prisma.vehicle.update({ where: { id }, data: { deletedAt: new Date() } }),
    prisma.auction.updateMany({
      where: { vehicleId: id, status: { in: ['PENDING', 'ACTIVE'] } },
      data: { status: 'CANCELLED' },
    }),
  ]);
}

export async function addVehicleImage(
  vehicleId: string,
  requester: Requester,
  input: VehicleImageInput & { position?: number },
): Promise<VehicleDto> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
  if (!vehicle) throw AppError.notFound('Vehicle');
  assertCanManage(vehicle, requester);

  // La portada es la posicion 0. Si el cliente no la pide, la nueva foto va al
  // final de la galeria en vez de pisar un indice ocupado.
  let position = input.position;
  if (position === undefined) {
    const last = await prisma.vehicleImage.findFirst({
      where: { vehicleId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    position = (last?.position ?? -1) + 1;
  }

  const row = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      images: {
        create: {
          url: input.url,
          ...(input.publicId ? { publicId: input.publicId } : {}),
          position,
        },
      },
    },
    include: VEHICLE_INCLUDE,
  });

  return toVehicleDto(row);
}

export async function removeVehicleImage(
  vehicleId: string,
  imageId: string,
  requester: Requester,
): Promise<void> {
  const vehicle = await prisma.vehicle.findFirst({ where: { id: vehicleId, deletedAt: null } });
  if (!vehicle) throw AppError.notFound('Vehicle');
  assertCanManage(vehicle, requester);

  const image = await prisma.vehicleImage.findFirst({ where: { id: imageId, vehicleId } });
  if (!image) throw AppError.notFound('Vehicle image');

  // El publicId se guarda justamente para poder limpiar el asset. Se intenta
  // antes de tocar la base, pero un fallo de Supabase Storage no puede dejar al
  // vendedor con una foto que la API no le deja quitar: la base manda y el
  // asset huerfano queda como tarea de mantenimiento.
  if (image.publicId) {
    try {
      await deleteAsset(image.publicId, 'vehicles');
    } catch (error) {
      console.error(`[vehiculos] no se pudo borrar el asset ${image.publicId}:`, error);
    }
  }

  await prisma.vehicleImage.delete({ where: { id: imageId } });
}

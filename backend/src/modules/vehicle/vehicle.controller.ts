import type { Request, Response } from 'express';

import { AppError, asyncHandler } from '../../middleware/error-handler.js';
import { created, noContent, ok, paginated } from '../../lib/api-response.js';
import {
  readEnum,
  readInteger,
  readNumber,
  readQueryString,
  requireUuid,
  parsePagination,
  Validator,
} from '../../lib/validate.js';
import {
  Category,
  Condition,
  Fuel,
  SaleType,
  Transmission,
  VehicleStatus,
} from '../../generated/prisma/client.js';
import * as vehicleService from './vehicle.service.js';
import type { AuctionInput, VehicleFilters, VehicleImageInput } from './vehicle.service.js';

const ALLOWED = {
  transmission: Object.values(Transmission),
  fuel: Object.values(Fuel),
  category: Object.values(Category),
  condition: Object.values(Condition),
  saleType: Object.values(SaleType),
  status: Object.values(VehicleStatus),
} as const;

const CLOUDINARY_URL_RE = /^https:\/\/[a-z0-9-]+\.cloudinary\.com\//i;

// El id y el rol salen del token; el DUI es la unica credencial extra que se
// necesita para autorizar la publicacion.
function requester(req: Request): vehicleService.Requester & { duiPhotoUrl?: string | null } {
  return { id: req.user!.id, role: req.user!.role, duiPhotoUrl: req.user!.duiPhotoUrl };
}

function requireString(
  validator: Validator,
  body: Record<string, unknown>,
  field: string,
  { min = 1, max = 200 }: { min?: number; max?: number } = {},
): string {
  const value = typeof body[field] === 'string' ? (body[field] as string).trim() : '';
  if (!value) {
    validator.add(field, `${field} es obligatorio`);
  } else if (value.length < min) {
    validator.add(field, `${field} debe tener al menos ${min} caracteres`);
  } else if (value.length > max) {
    validator.add(field, `${field} no puede superar ${max} caracteres`);
  }
  return value;
}

function requireEnum<T extends string>(
  validator: Validator,
  body: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
  optional = false,
): T | undefined {
  const value = body[field];
  if (value === undefined) {
    if (!optional) validator.add(field, `${field} es obligatorio`);
    return undefined;
  }
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    validator.add(field, `${field} debe ser uno de: ${allowed.join(', ')}`);
    return undefined;
  }
  return value as T;
}

function requireNumber(
  validator: Validator,
  body: Record<string, unknown>,
  field: string,
  { min, integer = false }: { min?: number; integer?: boolean } = {},
): number | undefined {
  const value = body[field];
  if (value === undefined || value === null) {
    validator.add(field, `${field} es obligatorio`);
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    validator.add(field, `${field} debe ser un numero`);
    return undefined;
  }
  if (integer && !Number.isInteger(value)) {
    validator.add(field, `${field} debe ser un entero`);
    return undefined;
  }
  if (min !== undefined && value < min) {
    validator.add(field, `${field} debe ser mayor o igual a ${min}`);
    return undefined;
  }
  return value;
}

export const create = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const vin = requireString(validator, body, 'vin', { min: 5, max: 17 }).toUpperCase();
  const licensePlate = requireString(validator, body, 'licensePlate', { min: 3, max: 12 }).toUpperCase();
  const brand = requireString(validator, body, 'brand', { min: 2, max: 40 });
  const model = requireString(validator, body, 'model', { min: 1, max: 60 });
  const engine = requireString(validator, body, 'engine', { min: 1, max: 80 });
  const power = requireString(validator, body, 'power', { min: 1, max: 80 });
  const drivetrain = requireString(validator, body, 'drivetrain', { min: 1, max: 80 });

  const year = requireNumber(validator, body, 'year', { integer: true });
  if (year !== undefined && (year < 1900 || year > new Date().getFullYear() + 1)) {
    validator.add('year', `year debe estar entre 1900 y ${new Date().getFullYear() + 1}`);
  }
  const mileage = requireNumber(validator, body, 'mileage', { integer: true, min: 0 });
  const basePrice = requireNumber(validator, body, 'basePrice', { min: 1 });

  const transmission = requireEnum(validator, body, 'transmission', ALLOWED.transmission);
  const fuel = requireEnum(validator, body, 'fuel', ALLOWED.fuel);
  const category = requireEnum(validator, body, 'category', ALLOWED.category);
  const saleType = requireEnum(validator, body, 'saleType', ALLOWED.saleType);
  const condition = requireEnum(validator, body, 'condition', ALLOWED.condition, true);

  const color = typeof body['color'] === 'string' ? body['color'].trim() : undefined;
  if (color !== undefined && color.length > 40) validator.add('color', 'color no puede superar 40 caracteres');

  const description = typeof body['description'] === 'string' ? body['description'].trim() : undefined;
  if (description !== undefined && description.length > 2000) {
    validator.add('description', 'description no puede superar 2000 caracteres');
  }

  // Imagenes: se suben antes con /uploads/sign y aca solo se referencian. La URL
  // tiene que ser de Cloudinary para que no se pueda apuntar la ficha a un host
  // ajeno que despues cambie de contenido.
  const images: VehicleImageInput[] = [];
  if (body['images'] !== undefined) {
    if (!Array.isArray(body['images'])) {
      validator.add('images', 'images debe ser un arreglo');
    } else {
      body['images'].forEach((raw, index) => {
        if (typeof raw !== 'object' || raw === null) {
          validator.add(`images[${index}]`, 'cada imagen debe ser un objeto { url, publicId? }');
          return;
        }
        const item = raw as Record<string, unknown>;
        const url = typeof item['url'] === 'string' ? item['url'].trim() : '';
        if (!url || !CLOUDINARY_URL_RE.test(url)) {
          validator.add(`images[${index}].url`, 'La imagen debe venir de Cloudinary');
          return;
        }
        const publicId = typeof item['publicId'] === 'string' ? item['publicId'].trim() : undefined;
        images.push({ url, ...(publicId ? { publicId } : {}) });
      });
    }
  }

  // Bloque de subasta. Solo tiene sentido si el vehiculo se subasta; y para
  // AUCTION es obligatorio, porque sin fechas no habria subasta que abrir.
  let auction: AuctionInput | undefined;
  const rawAuction = body['auction'];
  if (rawAuction !== undefined) {
    if (typeof rawAuction !== 'object' || rawAuction === null || Array.isArray(rawAuction)) {
      validator.add('auction', 'auction debe ser un objeto');
    } else {
      // Lecturas explícitas y no los helpers genericos: acá la clave se busca
      // en el sub-objeto (`startingPrice`) pero el error se reporta con el
      // prefijo (`auction.startingPrice`) para que la app lo ubique.
      const a = rawAuction as Record<string, unknown>;

      let startingPrice: number | undefined;
      const rawStarting = a['startingPrice'];
      if (rawStarting === undefined || rawStarting === null) {
        validator.add('auction.startingPrice', 'auction.startingPrice es obligatorio');
      } else if (typeof rawStarting !== 'number' || !Number.isFinite(rawStarting)) {
        validator.add('auction.startingPrice', 'auction.startingPrice debe ser un numero');
      } else if (rawStarting <= 0) {
        validator.add('auction.startingPrice', 'auction.startingPrice debe ser mayor a 0');
      } else {
        startingPrice = rawStarting;
      }

      let minBidIncrement: number | undefined;
      const rawIncrement = a['minBidIncrement'];
      if (rawIncrement !== undefined && rawIncrement !== null) {
        if (typeof rawIncrement !== 'number' || !Number.isFinite(rawIncrement) || rawIncrement <= 0) {
          validator.add('auction.minBidIncrement', 'auction.minBidIncrement debe ser mayor a 0');
        } else {
          minBidIncrement = rawIncrement;
        }
      }

      let endTime: Date | undefined;
      const rawEnd = a['endTime'];
      if (rawEnd === undefined || rawEnd === null) {
        validator.add('auction.endTime', 'auction.endTime es obligatorio');
      } else {
        endTime = typeof rawEnd === 'string' ? new Date(rawEnd) : undefined;
        if (!endTime || Number.isNaN(endTime.getTime())) {
          validator.add('auction.endTime', 'auction.endTime no es una fecha valida');
          endTime = undefined;
        } else if (endTime.getTime() <= Date.now()) {
          validator.add('auction.endTime', 'auction.endTime debe ser una fecha futura');
        }
      }

      let startTime: Date | undefined;
      const rawStart = a['startTime'];
      if (rawStart !== undefined && rawStart !== null) {
        startTime = typeof rawStart === 'string' ? new Date(rawStart) : undefined;
        if (!startTime || Number.isNaN(startTime.getTime())) {
          validator.add('auction.startTime', 'auction.startTime no es una fecha valida');
          startTime = undefined;
        }
      }
      if (startTime && endTime && startTime.getTime() >= endTime.getTime()) {
        validator.add('auction.startTime', 'auction.startTime debe ser anterior a endTime');
      }

      if (startingPrice !== undefined && endTime) {
        auction = {
          startingPrice,
          endTime,
          ...(startTime ? { startTime } : {}),
          ...(minBidIncrement !== undefined ? { minBidIncrement } : {}),
        };
      }
    }
  }

  if (saleType === 'AUCTION' && !auction) {
    validator.add('auction', 'Un vehiculo en subasta necesita startingPrice y endTime');
  }
  if (saleType === 'DIRECT_SALE' && auction) {
    validator.add('auction', 'saleType DIRECT_SALE no admite datos de subasta');
  }

  validator.assert();

  created(
    res,
    await vehicleService.createVehicle(requester(req), {
      vin,
      licensePlate,
      brand,
      model,
      year: year!,
      mileage: mileage!,
      transmission: transmission!,
      fuel: fuel!,
      category: category!,
      engine,
      power,
      drivetrain,
      ...(condition ? { condition } : {}),
      ...(color ? { color } : {}),
      basePrice: basePrice!,
      saleType: saleType!,
      ...(description ? { description } : {}),
      ...(images.length > 0 ? { images } : {}),
      ...(auction ? { auction } : {}),
    }),
  );
});

// Filtros del catalogo. Un enum invalido se rechaza con 400 en vez de
// ignorarse: un filtro mal escrito que no filtra muestra el catalogo entero y
// parece que la busqueda "no anda".
function parseFilters(query: Record<string, unknown>): VehicleFilters {
  const filters: VehicleFilters = {};
  const q = readQueryString(query['q']);
  if (q) filters.q = q;

  const enumFilter = <T extends string>(field: string, allowed: readonly T[]): T | undefined => {
    const value = readQueryString(query[field]);
    if (value === undefined) return undefined;
    if (!(allowed as readonly string[]).includes(value)) {
      throw AppError.badRequest('Validation failed', { [field]: `${field} debe ser uno de: ${allowed.join(', ')}` });
    }
    return value as T;
  };

  const category = enumFilter('category', ALLOWED.category);
  if (category) filters.category = category;
  const fuel = enumFilter('fuel', ALLOWED.fuel);
  if (fuel) filters.fuel = fuel;
  const transmission = enumFilter('transmission', ALLOWED.transmission);
  if (transmission) filters.transmission = transmission;
  const saleType = enumFilter('saleType', ALLOWED.saleType);
  if (saleType) filters.saleType = saleType;
  const status = enumFilter('status', ALLOWED.status);
  if (status) filters.status = status;

  const minPrice = readQueryString(query['minPrice']);
  if (minPrice !== undefined) filters.minPrice = readNumber({ minPrice: Number(minPrice) }, 'minPrice');
  const maxPrice = readQueryString(query['maxPrice']);
  if (maxPrice !== undefined) filters.maxPrice = readNumber({ maxPrice: Number(maxPrice) }, 'maxPrice');

  const sellerId = readQueryString(query['sellerId']);
  if (sellerId) filters.sellerId = sellerId;

  return filters;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const pagination = parsePagination(query);
  const { rows, total } = await vehicleService.listVehicles(parseFilters(query), pagination);
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

// Va antes que `/:id`: si no, Express matchea "mine" contra el param y el
// listado propio responde 404 de vehiculo inexistente.
export const listMine = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as Record<string, unknown>;
  const pagination = parsePagination(query);
  const { rows, total } = await vehicleService.listMyVehicles(
    req.auth!.sub,
    parseFilters(query),
    pagination,
  );
  paginated(res, rows, { page: pagination.page, pageSize: pagination.pageSize, total });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const viewer = req.auth ? { id: req.auth.sub, role: req.auth.role } : undefined;
  const vehicle = await vehicleService.getVehicleById(requireUuid(String(req.params.id)), viewer);
  if (!vehicle) throw AppError.notFound('Vehicle');
  ok(res, vehicle);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const validator = new Validator();

  const text = (field: string, max: number): string | undefined => {
    if (body[field] === undefined) return undefined;
    return requireString(validator, body, field, { max });
  };

  const brand = text('brand', 40);
  const model = text('model', 60);
  const engine = text('engine', 80);
  const power = text('power', 80);
  const drivetrain = text('drivetrain', 80);

  const year = readInteger(body, 'year');
  if (year !== undefined && (year < 1900 || year > new Date().getFullYear() + 1)) {
    validator.add('year', `year debe estar entre 1900 y ${new Date().getFullYear() + 1}`);
  }
  const mileage = readInteger(body, 'mileage');
  if (mileage !== undefined && mileage < 0) validator.add('mileage', 'mileage no puede ser negativo');
  const basePrice = readNumber(body, 'basePrice');
  if (basePrice !== undefined && basePrice <= 0) validator.add('basePrice', 'basePrice debe ser mayor a 0');

  const transmission = readEnum(body, 'transmission', ALLOWED.transmission);
  const fuel = readEnum(body, 'fuel', ALLOWED.fuel);
  const category = readEnum(body, 'category', ALLOWED.category);
  const condition = readEnum(body, 'condition', ALLOWED.condition);
  const status = readEnum(body, 'status', ALLOWED.status);
  // El vendedor controla si su publicacion esta visible o guardada, nada mas.
  // IN_AUCTION lo maneja el ciclo de vida de la subasta y SOLD el cierre de
  // venta: dejarlos editables a mano abriria la puerta a un vehiculo marcado
  // como vendido sin auction, o en subasta sin subasta.
  if (status !== undefined && status !== 'DRAFT' && status !== 'AVAILABLE') {
    validator.add(
      'status',
      'El vendedor solo puede alternar entre DRAFT y AVAILABLE; IN_AUCTION y SOLD los maneja la API',
    );
  }

  const color = body['color'] === null ? null : text('color', 40);
  const description = body['description'] === null ? null : text('description', 2000);

  validator.assert();

  ok(
    res,
    await vehicleService.updateVehicle(requireUuid(String(req.params.id)), requester(req), {
      ...(brand !== undefined ? { brand } : {}),
      ...(model !== undefined ? { model } : {}),
      ...(year !== undefined ? { year } : {}),
      ...(mileage !== undefined ? { mileage } : {}),
      ...(transmission !== undefined ? { transmission } : {}),
      ...(fuel !== undefined ? { fuel } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(engine !== undefined ? { engine } : {}),
      ...(power !== undefined ? { power } : {}),
      ...(drivetrain !== undefined ? { drivetrain } : {}),
      ...(condition !== undefined ? { condition } : {}),
      ...(color !== undefined ? { color } : {}),
      ...(basePrice !== undefined ? { basePrice } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(description !== undefined ? { description } : {}),
    }),
  );
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await vehicleService.softDeleteVehicle(requireUuid(String(req.params.id)), requester(req));
  noContent(res);
});

export const addImage = asyncHandler(async (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const url = typeof body['url'] === 'string' ? body['url'].trim() : '';
  if (!url) throw AppError.badRequest("Falta el campo 'url'", { url: 'url es obligatorio' });
  if (!CLOUDINARY_URL_RE.test(url)) {
    throw AppError.badRequest('La imagen debe venir de Cloudinary', { url: 'La imagen debe venir de Cloudinary' });
  }
  const publicId = typeof body['publicId'] === 'string' ? body['publicId'].trim() : undefined;
  const position = readInteger(body, 'position');

  created(
    res,
    await vehicleService.addVehicleImage(requireUuid(String(req.params.id)), requester(req), {
      url,
      ...(publicId ? { publicId } : {}),
      ...(position !== undefined ? { position } : {}),
    }),
  );
});

export const removeImage = asyncHandler(async (req: Request, res: Response) => {
  await vehicleService.removeVehicleImage(
    requireUuid(String(req.params.id)),
    requireUuid(String(req.params.imageId), 'imageId'),
    requester(req),
  );
  noContent(res);
});

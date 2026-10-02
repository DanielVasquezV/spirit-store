import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Category, Fuel, SaleType, Transmission } from '../src/generated/prisma/client.js';

config({ path: '../.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = 'admin@spirit.dev';
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

// Cuentas de prueba compartidas por toda la app; la clave sale de SEED_DEMO_PASSWORD.
const DEMO_USERS = [
  { email: 'ana@spirit.dev', fullName: 'Ana Torres', phoneNumber: '+50370000001', role: 'SELLER', dui: true },
  { email: 'carlos@spirit.dev', fullName: 'Carlos Menjívar', phoneNumber: '+50370000002', role: 'BUYER', dui: true },
  { email: 'maria@spirit.dev', fullName: 'María López', phoneNumber: '+50370000003', role: 'BUYER', dui: false },
] as const;

type DemoVehicle = {
  vin: string;
  plate: string;
  seller: (typeof DEMO_USERS)[number]['email'];
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
  price: number;
  saleType: SaleType;
  description: string;
};

// Mismo catálogo que tenía mock-data.ts, para que las pantallas se vean igual que con los mocks.
const DEMO_VEHICLES: DemoVehicle[] = [
  { vin: 'MR0FA3CD4P0000001', plate: 'P100-001', seller: 'ana@spirit.dev', brand: 'Toyota', model: 'Hilux SRX', year: 2023, mileage: 18500, transmission: 'AUTOMATIC', fuel: 'DIESEL', category: 'PICKUP', engine: '2.8L Diésel Turbo', power: '204 HP', drivetrain: '4x4', price: 42900, saleType: 'DIRECT_SALE', description: 'Único dueño, mantenimientos en agencia.' },
  { vin: 'WBA5R1C50N0000002', plate: 'P100-002', seller: 'ana@spirit.dev', brand: 'BMW', model: 'Serie 3 330i', year: 2022, mileage: 34000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SEDAN', engine: '2.0L Turbo', power: '258 HP', drivetrain: 'RWD', price: 38900, saleType: 'DIRECT_SALE', description: 'Paquete M Sport, techo panorámico.' },
  { vin: 'WP0AB2A99M0000003', plate: 'P100-003', seller: 'ana@spirit.dev', brand: 'Porsche', model: '911 Carrera', year: 2021, mileage: 12000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SPORT', engine: '3.0L Biturbo', power: '385 HP', drivetrain: 'RWD', price: 98500, saleType: 'AUCTION', description: 'Sport Chrono, escape deportivo.' },
  { vin: '5YJ3E1EA7P0000004', plate: 'P100-004', seller: 'carlos@spirit.dev', brand: 'Tesla', model: 'Model 3', year: 2023, mileage: 9000, transmission: 'AUTOMATIC', fuel: 'ELECTRIC', category: 'ELECTRIC', engine: 'Doble motor eléctrico', power: '346 HP', drivetrain: 'AWD', price: 41500, saleType: 'DIRECT_SALE', description: 'Long Range, autopiloto mejorado.' },
  { vin: 'WVWZZZAUZN0000005', plate: 'P100-005', seller: 'carlos@spirit.dev', brand: 'Volkswagen', model: 'Golf GTI', year: 2022, mileage: 21000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT', engine: '2.0L TSI', power: '241 HP', drivetrain: 'FWD', price: 31800, saleType: 'DIRECT_SALE', description: 'Caja manual de 6, llantas de 18".' },
  { vin: '1FMEE5DH0N0000006', plate: 'P100-006', seller: 'ana@spirit.dev', brand: 'Ford', model: 'Bronco Badlands', year: 2022, mileage: 15000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'SUV', engine: '2.7L EcoBoost V6', power: '330 HP', drivetrain: '4x4', price: 52000, saleType: 'AUCTION', description: 'Techo desmontable, suspensión Bilstein.' },
  { vin: 'W1NYC7HJ0M0000007', plate: 'P100-007', seller: 'ana@spirit.dev', brand: 'Mercedes-Benz', model: 'Clase G 63', year: 2021, mileage: 26000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SUV', engine: '4.0L V8 Biturbo', power: '577 HP', drivetrain: 'AWD', price: 165000, saleType: 'AUCTION', description: 'AMG, blindaje nivel III.' },
  { vin: '2HGFE1E52P0000008', plate: 'P100-008', seller: 'carlos@spirit.dev', brand: 'Honda', model: 'Civic Si', year: 2023, mileage: 9000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'COMPACT', engine: '1.5L VTEC Turbo', power: '200 HP', drivetrain: 'FWD', price: 27500, saleType: 'DIRECT_SALE', description: 'Como nuevo, garantía vigente.' },
  { vin: '1FA6P8CF5M0000009', plate: 'P100-009', seller: 'ana@spirit.dev', brand: 'Ford', model: 'Mustang GT', year: 2021, mileage: 31000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SPORT', engine: '5.0L V8', power: '450 HP', drivetrain: 'RWD', price: 45000, saleType: 'DIRECT_SALE', description: 'Escape activo, Performance Pack.' },
  // Variedad de precio y uso para que el asistente tenga qué recomendar (económicos, familiares, trabajo, híbridos).
  { vin: 'MR2B29F30N0000011', plate: 'P100-011', seller: 'ana@spirit.dev', brand: 'Toyota', model: 'Yaris', year: 2022, mileage: 28000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'COMPACT', engine: '1.5L 4 cil.', power: '106 HP', drivetrain: 'FWD', price: 16500, saleType: 'DIRECT_SALE', description: 'Muy económico en ciudad, ideal como primer carro.' },
  { vin: 'KMHCT41DAN0000012', plate: 'P100-012', seller: 'carlos@spirit.dev', brand: 'Hyundai', model: 'Accent', year: 2021, mileage: 41000, transmission: 'MANUAL', fuel: 'GASOLINE', category: 'SEDAN', engine: '1.6L 4 cil.', power: '120 HP', drivetrain: 'FWD', price: 13900, saleType: 'DIRECT_SALE', description: 'Mantenimientos al día, bajo consumo.' },
  { vin: 'JTDKARFU0N0000013', plate: 'P100-013', seller: 'ana@spirit.dev', brand: 'Toyota', model: 'Prius', year: 2022, mileage: 35000, transmission: 'AUTOMATIC', fuel: 'HYBRID', category: 'SEDAN', engine: '1.8L Híbrido', power: '121 HP', drivetrain: 'FWD', price: 24500, saleType: 'DIRECT_SALE', description: 'Híbrido, rinde más de 20 km/l en ciudad.' },
  { vin: '2T3P1RFV0P0000014', plate: 'P100-014', seller: 'carlos@spirit.dev', brand: 'Toyota', model: 'RAV4 Hybrid', year: 2023, mileage: 15000, transmission: 'AUTOMATIC', fuel: 'HYBRID', category: 'SUV', engine: '2.5L Híbrido', power: '219 HP', drivetrain: 'AWD', price: 36900, saleType: 'DIRECT_SALE', description: 'SUV familiar híbrida, cinco pasajeros y buen maletero.' },
  { vin: 'KNDPM3AC0N0000015', plate: 'P100-015', seller: 'ana@spirit.dev', brand: 'Kia', model: 'Sportage', year: 2022, mileage: 32000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SUV', engine: '2.0L 4 cil.', power: '155 HP', drivetrain: 'FWD', price: 23800, saleType: 'DIRECT_SALE', description: 'Familiar, cámara de retroceso y Apple CarPlay.' },
  { vin: '3N6CD33B0N0000016', plate: 'P100-016', seller: 'carlos@spirit.dev', brand: 'Nissan', model: 'Frontier', year: 2022, mileage: 47000, transmission: 'MANUAL', fuel: 'DIESEL', category: 'PICKUP', engine: '2.5L Diésel', power: '161 HP', drivetrain: '4x4', price: 29500, saleType: 'DIRECT_SALE', description: 'Pickup de trabajo, caja de 6 y doble cabina.' },
  { vin: 'MMBJYKL10N0000017', plate: 'P100-017', seller: 'ana@spirit.dev', brand: 'Mitsubishi', model: 'L200', year: 2021, mileage: 58000, transmission: 'MANUAL', fuel: 'DIESEL', category: 'PICKUP', engine: '2.4L Diésel', power: '178 HP', drivetrain: '4x4', price: 26000, saleType: 'DIRECT_SALE', description: 'Resistente para finca y carga pesada.' },
  { vin: 'LRWYGCEK0P0000018', plate: 'P100-018', seller: 'carlos@spirit.dev', brand: 'BYD', model: 'Dolphin', year: 2024, mileage: 6000, transmission: 'AUTOMATIC', fuel: 'ELECTRIC', category: 'ELECTRIC', engine: 'Motor eléctrico 60 kWh', power: '201 HP', drivetrain: 'FWD', price: 27900, saleType: 'DIRECT_SALE', description: 'Eléctrico urbano, 420 km de autonomía.' },
  { vin: '3MZBPABL0N0000019', plate: 'P100-019', seller: 'ana@spirit.dev', brand: 'Mazda', model: '3 Sedán', year: 2022, mileage: 24000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SEDAN', engine: '2.5L Skyactiv', power: '186 HP', drivetrain: 'FWD', price: 21500, saleType: 'DIRECT_SALE', description: 'Interior premium, consumo moderado.' },
  { vin: '1C4HJXDG0N0000020', plate: 'P100-020', seller: 'ana@spirit.dev', brand: 'Jeep', model: 'Wrangler Sport', year: 2021, mileage: 39000, transmission: 'AUTOMATIC', fuel: 'GASOLINE', category: 'SUV', engine: '3.6L V6', power: '285 HP', drivetrain: '4x4', price: 34000, saleType: 'AUCTION', description: 'Subasta rápida para probar el pago del ganador.' },
];

// El Wrangler cierra a los pocos minutos con Carlos ganando: prueba la orden del ganador y su pago desde Mis compras.
const QUICK_AUCTION_VIN = '1C4HJXDG0N0000020';
const QUICK_AUCTION_MINUTES = 3;

// Copia de buildSearchText del servicio de vehículos: el seed escribe directo en la tabla.
function searchText(brand: string, model: string): string {
  return [brand, model]
    .map((part) => part.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim())
    .filter(Boolean)
    .join(' ');
}

// Foto real de cada modelo, tomada de Wikimedia Commons (la enciclopedia). Es la
// imagen principal del articulo de Wikipedia de ese auto, asi que corresponde a la
// marca/modelo (y generacion) del vehiculo. Se pide a 1200px via Special:FilePath,
// que resuelve el thumbnail escalado del archivo original: no depende de un bucket
// propio ni de anchos de thumbnail pre-generados.
const WIKIMEDIA_PHOTOS: Record<string, string> = {
  MR0FA3CD4P0000001: '2016_Toyota_HiLux_Invincible_D-4D_4WD_2.4_Front.jpg',
  WBA5R1C50N0000002: '2019_BMW_318d_SE_Automatic_2.0_Front.jpg',
  WP0AB2A99M0000003: '2025_Porsche_992_Carrera_convertible_DSC_7026.jpg',
  '5YJ3E1EA7P0000004': 'Tesla_Model_3_%282023%29_Autofr%C3%BChling_Ulm_IMG_9282.jpg',
  WVWZZZAUZN0000005: '2020_Volkswagen_Golf_Style_1.5_Front.jpg',
  '1FMEE5DH0N0000006': 'Ford_Bronco_%286th_generation%29_Outer_Banks_1X7A0384.jpg',
  W1NYC7HJ0M0000007: 'Mercedes-Benz_W463_G_350_BlueTEC_01.jpg',
  '2HGFE1E52P0000008': '2022_Honda_Civic_Touring_in_Lunar_Silver_Metallic%2C_Front_Left%2C_05-10-2022.jpg',
  '1FA6P8CF5M0000009': '2019_Ford_Mustang_GT_5.0_facelift.jpg',
  MR2B29F30N0000011: '2020_Toyota_Yaris_Design_HEV_CVT_1.5_Front.jpg',
  KMHCT41DAN0000012: '2019_Hyundai_Accent_1.6L%2C_front_10.8.19.jpg',
  JTDKARFU0N0000013: 'Toyota_Prius_2.0_HEV_Limited_%28V%29_%E2%80%93_f_18112022.jpg',
  '2T3P1RFV0P0000014': '2024_Toyota_RAV4_Prime_XSE_Premium_in_Silver_Sky_with_Midnight_Black_roof%2C_front_left.jpg',
  KNDPM3AC0N0000015: '2025_Kia_Sportage_S_front_only.jpg',
  '3N6CD33B0N0000016': '2021_Nissan_Frontier_Pro_4X_%28Colombia%3B_facelift%29_front_view_01.png',
  MMBJYKL10N0000017: 'Mitsubishi_Triton_LC_2.4_GLS_2WD_Blade_Silver_Metallic_%28cropped%29.jpg',
  LRWYGCEK0P0000018: '2021_BYD_Dolphin_EV_%28front%29.jpg',
  '3MZBPABL0N0000019': 'Mazda3_SKYACTIV-G.jpg',
  '1C4HJXDG0N0000020': 'Jeep_Wrangler_Unlimited_%28JL%29_PHEV_IMG_5808.jpg',
};

// Galeria del vehiculo: la portada es la foto fiel al modelo; si un VIN no tiene
// foto curada, cae a un relleno deterministico (el almacenamiento propio solo se
// exige al subir desde la app).
function images(vin: string): { url: string; position: number }[] {
  const file = WIKIMEDIA_PHOTOS[vin];
  if (file) {
    return [{ url: `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=1200`, position: 0 }];
  }
  return [0, 1, 2].map((position) => ({ url: `https://picsum.photos/seed/${vin}-${position}/1200/800`, position }));
}

async function seedAdmin(): Promise<void> {
  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'change-me', SALT_ROUNDS);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: { email: ADMIN_EMAIL, fullName: 'SpiritApex Admin', passwordHash, role: 'ADMIN' },
  });
}

async function seedUsers(): Promise<Map<string, string>> {
  const passwordHash = await bcrypt.hash(process.env.SEED_DEMO_PASSWORD ?? 'spirit-demo-123', SALT_ROUNDS);
  const ids = new Map<string, string>();
  for (const demo of DEMO_USERS) {
    const dui = demo.dui
      ? { duiPhotoUrl: 'https://picsum.photos/seed/dui-demo/800/500', duiStatus: 'VERIFIED' as const, duiVerifiedAt: new Date() }
      : {};
    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: { passwordHash },
      create: { email: demo.email, fullName: demo.fullName, phoneNumber: demo.phoneNumber, role: demo.role, passwordHash, ...dui },
    });
    ids.set(demo.email, user.id);
  }
  return ids;
}

async function seedVehicles(users: Map<string, string>): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const demo of DEMO_VEHICLES) {
    const existing = await prisma.vehicle.findUnique({ where: { vin: demo.vin }, select: { id: true } });
    if (existing) {
      // El seed es idempotente, pero la galeria puede cambiar (p. ej. fotos curadas):
      // se reemplazan las imagenes del vehiculo ya sembrado sin recrearlo.
      await prisma.vehicleImage.deleteMany({ where: { vehicleId: existing.id } });
      await prisma.vehicleImage.createMany({
        data: images(demo.vin).map((image) => ({ ...image, vehicleId: existing.id })),
      });
      ids.set(demo.vin, existing.id);
      continue;
    }
    const sellerId = users.get(demo.seller)!;
    const auction = demo.saleType === 'AUCTION';
    const vehicle = await prisma.vehicle.create({
      data: {
        sellerId,
        vin: demo.vin,
        licensePlate: demo.plate,
        brand: demo.brand,
        model: demo.model,
        year: demo.year,
        mileage: demo.mileage,
        transmission: demo.transmission,
        fuel: demo.fuel,
        category: demo.category,
        engine: demo.engine,
        power: demo.power,
        drivetrain: demo.drivetrain,
        basePrice: demo.price,
        saleType: demo.saleType,
        status: auction ? 'IN_AUCTION' : 'AVAILABLE',
        searchText: searchText(demo.brand, demo.model),
        description: demo.description,
        images: { create: images(demo.vin) },
      },
    });
    if (auction) {
      const quick = demo.vin === QUICK_AUCTION_VIN;
      // Arrancan hace una hora y cierran en dos días, salvo la rápida: siempre hay subastas en vivo al levantar el entorno.
      const created = await prisma.auction.create({
        data: {
          vehicleId: vehicle.id,
          sellerId,
          startingPrice: demo.price,
          minBidIncrement: 5,
          startTime: new Date(Date.now() - 60 * 60_000),
          endTime: new Date(Date.now() + (quick ? QUICK_AUCTION_MINUTES * 60_000 : 2 * 24 * 60 * 60_000)),
          status: 'ACTIVE',
        },
      });
      if (quick) {
        const carlos = users.get('carlos@spirit.dev')!;
        await prisma.bid.create({ data: { auctionId: created.id, bidderId: carlos, amount: demo.price + 500 } });
        await prisma.auction.update({ where: { id: created.id }, data: { currentBid: demo.price + 500, currentWinnerId: carlos } });
      }
    }
    ids.set(demo.vin, vehicle.id);
  }
  return ids;
}

async function seedChats(users: Map<string, string>, vehicles: Map<string, string>): Promise<void> {
  const ana = users.get('ana@spirit.dev')!;
  const carlos = users.get('carlos@spirit.dev')!;
  const threads = [
    { vin: 'MR0FA3CD4P0000001', buyer: carlos, seller: ana, lines: [[carlos, 'Hola, ¿sigue disponible la Hilux?'], [ana, '¡Hola Carlos! Sí, sigue disponible.'], [carlos, '¿Aceptás financiamiento bancario?']] },
    { vin: 'WVWZZZAUZN0000005', buyer: ana, seller: carlos, lines: [[ana, '¿El Golf tiene historial de servicio?'], [carlos, 'Sí, te comparto los documentos por acá.']] },
  ] as const;

  for (const thread of threads) {
    const vehicleId = vehicles.get(thread.vin)!;
    const exists = await prisma.chat.findFirst({ where: { vehicleId, buyerId: thread.buyer, sellerId: thread.seller } });
    if (exists) continue;
    await prisma.chat.create({
      data: {
        vehicleId,
        buyerId: thread.buyer,
        sellerId: thread.seller,
        chatType: 'PURCHASE',
        messages: {
          // createdAt escalonado para que el orden del hilo no dependa del insert.
          create: thread.lines.map(([senderId, content], index) => ({
            senderId,
            content,
            createdAt: new Date(Date.now() - (thread.lines.length - index) * 5 * 60_000),
          })),
        },
      },
    });
  }
}

async function main(): Promise<void> {
  await seedAdmin();
  const users = await seedUsers();
  const vehicles = await seedVehicles(users);
  await seedChats(users, vehicles);
  console.log(`Seed complete: admin, ${users.size} demo users, ${vehicles.size} vehicles.`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

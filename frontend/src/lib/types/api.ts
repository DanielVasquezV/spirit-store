// DTOs espejados del backend. Si el contrato cambia, cambia acá y en features/*,
// nunca dentro de una pantalla.

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export const FUELS = ['GASOLINE', 'DIESEL', 'ELECTRIC', 'HYBRID'] as const;
export const VEHICLE_CATEGORIES = ['SUV', 'SEDAN', 'SPORT', 'ELECTRIC', 'PICKUP', 'COMPACT'] as const;
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'USED', 'FOR_PARTS'] as const;
export const SALE_TYPES = ['DIRECT_SALE', 'AUCTION', 'BOTH'] as const;
export const VEHICLE_STATUSES = ['DRAFT', 'AVAILABLE', 'IN_AUCTION', 'RESERVED', 'SOLD'] as const;
export const AUCTION_STATUSES = ['PENDING', 'ACTIVE', 'FINISHED', 'CANCELLED'] as const;
export const CHAT_TYPES = ['PURCHASE', 'SALE', 'AUCTION_WIN'] as const;
export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'OFFER'] as const;
export const DIAGNOSTIC_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const DIAGNOSTIC_SENDERS = ['USER', 'AI_ASSISTANT'] as const;
export const ROLES = ['BUYER', 'SELLER', 'ADMIN'] as const;

export type Transmission = (typeof TRANSMISSIONS)[number];
export type Fuel = (typeof FUELS)[number];
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];
export type Condition = (typeof CONDITIONS)[number];
export type SaleType = (typeof SALE_TYPES)[number];
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];
export type ChatType = (typeof CHAT_TYPES)[number];
export type MessageType = (typeof MESSAGE_TYPES)[number];
export type DiagnosticSeverity = (typeof DIAGNOSTIC_SEVERITIES)[number];
export type DiagnosticSender = (typeof DIAGNOSTIC_SENDERS)[number];
export type Role = (typeof ROLES)[number];

export interface SelfUser {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  duiPhotoUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResult {
  user: SelfUser;
  accessToken: string;
  tokenType: 'Bearer';
  /** Vida del access token tal como la define el backend. */
  expiresIn: string;
}

export interface VehicleImageDto {
  id: string;
  url: string;
  publicId: string | null;
  position: number;
}

export interface VehicleSellerDto {
  id: string;
  fullName: string;
  isVerified: boolean;
}

export interface VehicleAuctionSummary {
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
  title: string;
  year: number;
  mileage: number;
  transmission: Transmission;
  fuel: Fuel;
  category: VehicleCategory;
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
  auction: VehicleAuctionSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface BidDto {
  id: string;
  amount: number;
  createdAt: string;
  bidder: { id: string; fullName: string };
}

export interface AuctionDto {
  id: string;
  vehicleId: string;
  sellerId: string;
  startingPrice: number;
  currentBid: number | null;
  minBidIncrement: number;
  currentWinner: { id: string; fullName: string } | null;
  startTime: string;
  endTime: string;
  status: AuctionStatus;
  bidCount: number;
  /** Solo las 10 más recientes que el backend incluye en el detalle. */
  recentBids: BidDto[];
  vehicle: VehicleDto;
  seller: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface MyBidDto extends BidDto {
  auction: { id: string; vehicleId: string; status: AuctionStatus; endTime: string; currentBid: number | null };
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  messageType: MessageType;
  metadata: unknown;
  isRead: boolean;
  createdAt: string;
}

export interface ChatPreviewDto {
  id: string;
  chatType: ChatType;
  vehicle: { id: string; title: string; imageUrl: string | null } | null;
  counterpart: { id: string; fullName: string };
  lastMessage: ChatMessageDto | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticMessageDto {
  id: string;
  sender: DiagnosticSender;
  content: string;
  model: string | null;
  createdAt: string;
}

export interface AiDiagnosticDto {
  id: string;
  vehicleId: string | null;
  title: string;
  vehicleBrand: string | null;
  vehicleModel: string | null;
  vehicleYear: number | null;
  mileage: number | null;
  symptoms: unknown;
  summary: string | null;
  confidence: number | null;
  severity: DiagnosticSeverity | null;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AiDiagnosticDetailDto extends AiDiagnosticDto {
  messages: DiagnosticMessageDto[];
}

export interface BidPlacedEvent {
  auctionId: string;
  bid: BidDto;
  currentBid: number;
  minBidIncrement: number;
  /** Lo que tiene que poner el siguiente postor, ya redondeado por el servidor. */
  minimumNextBid: number;
  bidCount: number;
  currentWinner: { id: string; fullName: string } | null;
}

export interface OutbidEvent {
  auctionId: string;
  previousWinnerId: string;
  currentBid: number;
  minimumNextBid: number;
}

export interface AuctionStartedEvent {
  auctionId: string;
  startingPrice: number;
  minBidIncrement: number;
}

export interface AuctionClosedEvent {
  auctionId: string;
  vehicleId: string;
  status: AuctionStatus;
  winnerId: string | null;
  currentBid: number | null;
}

export interface ChatMessageEvent {
  chatId: string;
  message: ChatMessageDto;
}

export interface ChatMessagesReadEvent {
  chatId: string;
  readerId: string;
  count: number;
}

export interface DiagnosticDoneEvent {
  userId: string;
  diagnosticId: string;
  summary: string | null;
  severity: string | null;
  confidence: number | null;
}

export interface ConnectionErrorEvent {
  code: string;
  message: string;
}
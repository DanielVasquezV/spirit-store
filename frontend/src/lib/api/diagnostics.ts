import { http, type Paginated } from './http-client';
import type { AiDiagnosticDetailDto, AiDiagnosticDto } from '@/lib/types/api';

export interface CreateDiagnosticInput {
  title: string;
  vehicleId?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  mileage?: number;
  symptoms?: unknown;
}

// El cliente la consulta para no ofrecer el botón si falta la clave del modelo.
export function diagnosticsAvailable(): Promise<{ available: boolean }> {
  return http.get<{ available: boolean }>('/diagnostics/availability');
}

export function createDiagnostic(input: CreateDiagnosticInput): Promise<AiDiagnosticDetailDto> {
  return http.post<AiDiagnosticDetailDto>('/diagnostics', input);
}

export function listDiagnostics(page: number, pageSize: number): Promise<Paginated<AiDiagnosticDto>> {
  return http.paginated<AiDiagnosticDto>('/diagnostics', { query: { page, pageSize } });
}

export function getDiagnostic(id: string): Promise<AiDiagnosticDetailDto> {
  return http.get<AiDiagnosticDetailDto>(`/diagnostics/${id}`);
}

// Devuelve la respuesta y el hilo actualizado, con las recomendaciones del catálogo ya resueltas.
export function askDiagnostic(id: string, question: string): Promise<{ answer: string; diagnostic: AiDiagnosticDetailDto }> {
  return http.post<{ answer: string; diagnostic: AiDiagnosticDetailDto }>(`/diagnostics/${id}/ask`, { question });
}

export function resolveDiagnostic(id: string, resolved: boolean): Promise<AiDiagnosticDto> {
  return http.patch<AiDiagnosticDto>(`/diagnostics/${id}/resolved`, { resolved });
}
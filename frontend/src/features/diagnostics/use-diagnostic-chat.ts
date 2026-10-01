import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { isApiError, messageFor } from '@/lib/api/api-error';
import { askDiagnostic, createDiagnostic, diagnosticsAvailable, getDiagnostic } from '@/lib/api/diagnostics';
import type { AiDiagnosticDetailDto, DiagnosticMessageDto, RecommendedVehicleDto } from '@/lib/types/api';

export type AssistantEntry = { id: string; from: 'me' | 'bot'; text: string; recommendations?: RecommendedVehicleDto[] };

const INTRO: AssistantEntry = {
  id: 'intro',
  from: 'bot',
  text: 'Hola, soy Spirit, el asistente automotriz. Contame qué le escuchás o sentís a tu vehículo y te oriento con posibles causas, o decime qué carro buscás y te recomiendo opciones del catálogo.',
};

// El backend guarda el título como primer turno del hilo y lo limita a 120 caracteres.
const MAX_TITLE = 120;

// El endpoint exige sesión: para un invitado no se consulta y la vista le ofrece iniciar sesión.
export function useDiagnosticsAvailability(enabled = true) {
  return useQuery({ queryKey: ['diagnostics', 'availability'], queryFn: diagnosticsAvailable, staleTime: 5 * 60_000, enabled });
}

// Conversación con el asistente: el primer síntoma crea el diagnóstico y lo demás son seguimientos.
export function useDiagnosticChat(vehicleId?: string) {
  const [diagnostic, setDiagnostic] = useState<AiDiagnosticDetailDto | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticId, setDiagnosticId] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      setPending(text);
      setThinking(true);
      setError(null);
      try {
        if (!diagnosticId) {
          const created = await createDiagnostic({
            title: text.slice(0, MAX_TITLE),
            vehicleId,
            // Lo que no entra en el título viaja completo en symptoms para que el modelo lo lea igual.
            symptoms: text.length > MAX_TITLE ? { description: text } : undefined,
          });
          setDiagnosticId(created.id);
          setDiagnostic(created);
        } else {
          setDiagnostic((await askDiagnostic(diagnosticId, text)).diagnostic);
        }
      } catch (err) {
        // Si el modelo falla después de guardar la fila, el id viene en details para reintentar sobre el mismo hilo.
        const savedId = isApiError(err) ? (err.details?.diagnosticId as string | undefined) : undefined;
        if (savedId && !diagnosticId) {
          setDiagnosticId(savedId);
          setDiagnostic(await getDiagnostic(savedId).catch(() => null));
        }
        setError(messageFor(err, 'El asistente no respondió. Intentá de nuevo.'));
      } finally {
        setPending(null);
        setThinking(false);
      }
    },
    [diagnosticId, vehicleId],
  );

  const messages: DiagnosticMessageDto[] = diagnostic?.messages ?? [];
  // El turno propio se pinta en el acto aunque el backend todavía no lo haya devuelto.
  const entries: AssistantEntry[] = [
    INTRO,
    ...messages.map((message) => ({
      id: message.id,
      from: message.sender === 'USER' ? ('me' as const) : ('bot' as const),
      text: message.content,
      recommendations: message.recommendations,
    })),
    ...(pending ? [{ id: 'pending', from: 'me' as const, text: pending }] : []),
  ];
  return { diagnostic, messages, entries, pending, thinking, error, send };
}

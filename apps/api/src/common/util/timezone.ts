/** Colombia no tiene horario de verano: UTC-5 fijo. */
const BOGOTA_OFFSET_MS = 5 * 60 * 60 * 1000;

/** Inicio del día actual en America/Bogota, expresado en UTC. */
export function startOfDayBogota(now = new Date()): Date {
  const local = new Date(now.getTime() - BOGOTA_OFFSET_MS);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() + BOGOTA_OFFSET_MS);
}

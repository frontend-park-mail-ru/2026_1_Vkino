/**
 * Returns the first finite number from an array (skips null/undefined/NaN/Infinity).
 */
export function getFirstFiniteNumber(values) {
  for (const value of values) {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }
  }
  return null;
}

/**
 * Normalizes time fields into { duration, position, unit } with seconds output.
 */
export function normalizeTimeFields(item) {
  const durationRaw = getFirstFiniteNumber([
    item.duration_seconds,
    item.duration,
    item.total_seconds,
    item.duration_ms,
    item.durationMs,
    item.progress?.duration_seconds,
    item.progress?.duration_ms,
  ]);
  const positionRaw = getFirstFiniteNumber([
    item.position_seconds,
    item.current_position_seconds,
    item.progress_seconds,
    item.position_ms,
    item.current_position_ms,
    item.progress?.position_seconds,
    item.progress?.position_ms,
    item.progress?.seconds,
  ]);

  const hasMsField =
    item.duration_ms !== undefined ||
    item.durationMs !== undefined ||
    item.position_ms !== undefined ||
    item.current_position_ms !== undefined ||
    item.progress?.duration_ms !== undefined ||
    item.progress?.position_ms !== undefined;

  const useMilliseconds = hasMsField || (durationRaw !== null && durationRaw > 43200);
  const factor = useMilliseconds ? 1 / 1000 : 1;

  return {
    duration: durationRaw !== null ? Math.round(durationRaw * factor) : null,
    position: positionRaw !== null ? Math.round(positionRaw * factor) : null,
    unit: "s",
  };
}

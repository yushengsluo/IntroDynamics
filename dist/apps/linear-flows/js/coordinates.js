export const DEFAULT_RANGE = 5;

// Text inputs retain unfinished signs while a coordinate is being edited.
export function parseCoordinate(raw) {
  const text = raw.trim().replace(/\u2212/g, '-');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) && Math.abs(value) <= 100 ? value : null;
}


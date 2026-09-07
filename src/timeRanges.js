export const TIME_RANGES = {
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 24 * 7,
};

export function rangeStartTime(key, now = new Date()) {
  const hours = TIME_RANGES[key] ?? TIME_RANGES["24h"];
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

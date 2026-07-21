export function getDayDiscount(totalDays: number): number {
  if (totalDays <= 2) return 0;
  if (totalDays <= 6) return 5;
  if (totalDays <= 13) return 10;
  if (totalDays <= 20) return 15;
  return 20;
}

export function applyDiscount(priceCentsPerDay: number, totalDays: number): number {
  const pct = getDayDiscount(totalDays);
  return Math.round(priceCentsPerDay * (1 - pct / 100));
}

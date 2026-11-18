// Recipe costing shown live in the recipe editor. Mirrors the server's recipeCost.ts so the numbers
// on screen match what is saved; the server stays the source of truth.

export interface CostInputLine {
  quantity: number;
  wastagePercent: number;
  unitCostPence: number;
}

export const lineCostPence = (l: CostInputLine) =>
  Math.round(l.quantity * (1 + l.wastagePercent / 100) * l.unitCostPence);

export function summarizeCost(lines: CostInputLine[], pricePence: number) {
  const costPerPortionPence = lines.reduce((sum, l) => sum + lineCostPence(l), 0);
  return {
    costPerPortionPence,
    marginPence: pricePence - costPerPortionPence,
    foodCostPercent: pricePence > 0 ? Math.round((costPerPortionPence / pricePence) * 1000) / 10 : null,
  };
}

export const pounds = (pence: number) =>
  `${pence < 0 ? "-" : ""}£${(Math.abs(pence) / 100).toFixed(2)}`;

/** Colour for a food-cost %: under 30% healthy, 30-40% watch, over 40% high. */
export function foodCostTone(percent: number | null): "good" | "watch" | "high" | "none" {
  if (percent === null) return "none";
  if (percent <= 30) return "good";
  if (percent <= 40) return "watch";
  return "high";
}

export const FOOD_COST_CLASSES: Record<ReturnType<typeof foodCostTone>, string> = {
  good: "text-emerald-700 bg-emerald-50 border-emerald-200",
  watch: "text-amber-700 bg-amber-50 border-amber-200",
  high: "text-rose-700 bg-rose-50 border-rose-200",
  none: "text-zinc-500 bg-zinc-50 border-zinc-200",
};

/** Error text from an RTK Query error (the API replies { error: { message } }). */
export function apiErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { data?: { error?: { message?: string }; message?: string } } | undefined;
  return e?.data?.error?.message ?? e?.data?.message ?? fallback;
}

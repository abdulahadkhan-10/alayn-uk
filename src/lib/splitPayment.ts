/**
 * Split payments — one bill settled with several payments (e.g. £10.00 cash + £18.50 card on a £28.50 bill).
 *
 * Everything is integer pence: pound text typed by the cashier is parsed straight to pence (never via
 * floating point), so £0.10 + £0.20 is exactly £0.30. Mirrors alayn-backend/src/modules/orders/splitPayment.ts,
 * which re-checks every rule at settlement — keep them in sync.
 */

export type PaymentMethodCode = "CASH" | "CARD";
export type PlatformMethodCode = "DELIVEROO" | "UBER_EATS" | "JUST_EAT";
export type SettleMethodCode = PaymentMethodCode | PlatformMethodCode;

export const PAYMENT_METHODS: PaymentMethodCode[] = ["CASH", "CARD"];
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  DELIVEROO: "Deliveroo",
  UBER_EATS: "Uber Eats",
  JUST_EAT: "Just Eat",
  // Legacy methods, kept so bills paid before the UK launch still read correctly
  UPI: "UPI",
  SWIGGY: "Swiggy",
  ZOMATO: "Zomato",
  EAZYDINER: "EazyDiner",
  SPLIT: "Split",
};
const SHORT_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  DELIVEROO: "Deliveroo",
  UBER_EATS: "Uber Eats",
  JUST_EAT: "Just Eat",
  UPI: "UPI",
  SWIGGY: "Swiggy",
  ZOMATO: "Zomato",
  EAZYDINER: "EazyDiner",
};

export const isPlatformMethod = (method: string): method is PlatformMethodCode =>
  method === "DELIVEROO" || method === "UBER_EATS" || method === "JUST_EAT";

/** Money arrives outside the till, so the cashier must confirm it was received */
export const isOnlineMethod = (method: string) => method === "CARD" || isPlatformMethod(method);

export const MAX_SPLIT_PAYMENTS = 6;

export interface SplitLine {
  key: string;
  method: PaymentMethodCode;
  /** What the cashier typed, in pounds */
  amountText: string;
  /** Follows the remaining balance until the cashier types an amount */
  auto: boolean;
  reference: string;
  verified: boolean;
}

/** "185", "185.5", "£1,185.50" → pence/paise. null when it isn't a valid amount with at most 2 decimals. */
export function poundsToPence(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, "");
  const match = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(cleaned) || /^\.(\d{1,2})$/.exec(cleaned);
  if (!match) return null;
  if (cleaned.startsWith(".")) return Number(match[1].padEnd(2, "0"));
  return Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0"));
}

/** 18500 → "185.00" (for inputs) */
export const paiseToInput = (paise: number) => (paise / 100).toFixed(2);

/** 18500 → "£185.00" */
export const formatPaise = (paise: number) =>
  `£${(paise / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

let lineSeq = 0;
export function newSplitLine(method: PaymentMethodCode, amountPaise?: number, auto = false): SplitLine {
  lineSeq += 1;
  return {
    key: `split-${Date.now()}-${lineSeq}`,
    method,
    amountText: amountPaise !== undefined && amountPaise > 0 ? paiseToInput(amountPaise) : "",
    auto,
    reference: "",
    verified: false,
  };
}

/** Recompute the auto line so the split always offers to cover what is left */
export function rebalanceAutoLine(lines: SplitLine[], duePaise: number): SplitLine[] {
  const autoIndex = lines.findIndex((l) => l.auto);
  if (autoIndex === -1) return lines;
  const others = lines.reduce((sum, l, i) => (i === autoIndex ? sum : sum + (poundsToPence(l.amountText) || 0)), 0);
  const remaining = Math.max(0, duePaise - others);
  const nextText = remaining > 0 ? paiseToInput(remaining) : "";
  if (lines[autoIndex].amountText === nextText) return lines;
  return lines.map((l, i) => (i === autoIndex ? { ...l, amountText: nextText, verified: false } : l));
}

export interface SplitSummary {
  allocatedPaise: number;
  /** > 0 still to allocate, < 0 over-allocated */
  remainingPaise: number;
  hasInvalidAmount: boolean;
  unverifiedOnline: SplitLine[];
  isBalanced: boolean;
  canSettle: boolean;
  /** Why the settle button is disabled, phrased as the next thing to do */
  blocker: string | null;
}

export function summarizeSplit(lines: SplitLine[], duePaise: number): SplitSummary {
  let allocatedPaise = 0;
  let hasInvalidAmount = false;
  for (const line of lines) {
    const paise = poundsToPence(line.amountText);
    if (paise === null || paise <= 0) hasInvalidAmount = true;
    else allocatedPaise += paise;
  }
  const remainingPaise = duePaise - allocatedPaise;
  const unverifiedOnline = lines.filter((l) => isOnlineMethod(l.method) && !l.verified);
  const isBalanced = remainingPaise === 0 && !hasInvalidAmount;

  let blocker: string | null = null;
  if (lines.length === 0) blocker = "Add a payment";
  else if (hasInvalidAmount) blocker = "Enter an amount for every payment";
  else if (remainingPaise > 0) blocker = `Allocate ${formatPaise(remainingPaise)} more`;
  else if (remainingPaise < 0) blocker = `Reduce by ${formatPaise(-remainingPaise)}`;
  else if (unverifiedOnline.length > 0) blocker = `Confirm ${SHORT_LABELS[unverifiedOnline[0].method]} received`;

  return { allocatedPaise, remainingPaise, hasInvalidAmount, unverifiedOnline, isBalanced, canSettle: blocker === null, blocker };
}

/** Request body parts for the API */
export function toPaymentPayload(lines: SplitLine[]) {
  return lines.map((l) => ({
    method: l.method,
    amountPaise: poundsToPence(l.amountText) || 0,
    reference: l.reference.trim() || undefined,
    verified: isOnlineMethod(l.method) ? l.verified : undefined,
  }));
}

export interface PaymentLine {
  method: string;
  label: string;
  amountPaise: number;
  reference: string | null;
}

/** The payment fields of an order as the API returns them (or as a receipt is handed one) */
export interface OrderPaymentsLike {
  paymentMethod?: string;
  paymentSplits?: { method: string; amountPaise?: number; amount?: number; reference?: string | null }[];
  payments?: { method: string; amountPaise: number; status: string; reference?: string | null }[];
}

export interface CustomerPaymentClaims {
  /** The diner will pay at the counter */
  payAtCounter: boolean;
  /** How they said they'll pay at the counter (null on older orders that didn't say) */
  counterMethod: "CASH" | "CARD" | null;
}

const NO_CLAIMS: CustomerPaymentClaims = { payAtCounter: false, counterMethod: null };

/**
 * What diners told us about paying from the table QR: PENDING payments the cashier still has to check.
 * Only QR orders count — a POS order also carries a PENDING payment (the method picked at the till), which
 * is not the customer saying they paid. Orders placed before claims were recorded as payments carry the
 * same hints in placedByName.
 */
export function getCustomerPaymentClaims(
  order:
    | (OrderPaymentsLike & { placedByName?: string | null; source?: string | null; orderSource?: string | null })
    | null
    | undefined
): CustomerPaymentClaims {
  const isQrOrder = order?.source === "QR" || order?.orderSource === "QR";
  if (!order || !isQrOrder) return NO_CLAIMS;
  const pending = Array.isArray(order.payments) ? order.payments.filter((p) => p.status === "PENDING") : [];
  const placedBy = order.placedByName || "";
  const counterMethod = pending.some((p) => p.method === "CARD") ? "CARD" : pending.some((p) => p.method === "CASH") ? "CASH" : null;
  return {
    payAtCounter: !!counterMethod || placedBy.includes("Pay at Counter"),
    counterMethod,
  };
}

/** How a settled bill was paid, for receipts and reports (falls back to the single paymentMethod) */
export function getPaymentLines(order: OrderPaymentsLike | null | undefined): PaymentLine[] {
  const fromApi: { method: string; amountPaise?: number; amount?: number; reference?: string | null }[] = Array.isArray(order?.paymentSplits)
    ? order.paymentSplits
    : Array.isArray(order?.payments)
      ? order.payments.filter((p) => p.status === "CONFIRMED")
      : [];
  return fromApi.map((p) => ({
    method: p.method,
    label: SHORT_LABELS[p.method] || p.method,
    amountPaise: typeof p.amountPaise === "number" ? p.amountPaise : Math.round(Number(p.amount || 0) * 100),
    reference: p.reference || null,
  }));
}

/** "Cash £100.00 + Card £185.00", or the single method's name */
export function describePaymentLines(order: OrderPaymentsLike | null | undefined, fallback = "CASH"): string {
  const lines = getPaymentLines(order);
  if (lines.length > 1) return lines.map((l) => `${l.label} ${formatPaise(l.amountPaise)}`).join(" + ");
  return lines[0]?.method || order?.paymentMethod || fallback;
}

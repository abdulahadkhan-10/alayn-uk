/**
 * Bill calculation — mirrors alayn-uk-api/src/modules/orders/billing.ts
 * Single source of truth for bill estimation on the POS and order previews.
 *
 * UK pricing: menu prices INCLUDE VAT, so VAT is the part of the price already paid, not an extra.
 * All financial math is done in pence integers to prevent IEEE-754 floating-point drift:
 *   subtotal       = Σ unit price × qty           (VAT-inclusive)
 *   net            = subtotal − discount
 *   VAT            = round(net × rate / (100 + rate))   (0 when the outlet isn't VAT-registered)
 *   service charge = round(net × scRate)          (dine-in only; voluntary, so outside the scope of VAT)
 *   total          = net + service charge         (bills are not rounded)
 */

export interface BillRates {
  /** Percentages, e.g. 20 for 20% */
  vatRate: number;
  serviceChargeRate: number;
}

export interface BillOptions {
  /** Service charge only applies to dine-in (TABLE/QR) orders */
  dineIn: boolean;
  serviceChargeWaived?: boolean;
  /** Discount in Pounds */
  discount?: number;
  /** false: the outlet is below the VAT threshold, so its bills carry no VAT */
  vatRegistered?: boolean;
}

export interface CartLineItem {
  price: number;
  quantity: number;
}

export interface BillEstimate {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  /** Value of the goods excluding VAT */
  netOfVat: number;
  /** VAT included in the prices */
  vat: number;
  roundOff: number;
  total: number;
  appliedRates: BillRates;
}

export const DINE_IN_SOURCES = ['TABLE', 'QR'];

export function isDineIn(source?: string | null): boolean {
  return !!source && DINE_IN_SOURCES.includes(source.toUpperCase());
}

export function estimateBill(
  items: CartLineItem[],
  rates: BillRates,
  options: BillOptions
): BillEstimate {
  const subtotalPence = items.reduce(
    (sum, item) => sum + Math.round((item.price || 0) * 100) * (item.quantity || 0),
    0
  );

  const discountPence = Math.min(
    Math.max(0, Math.round((options.discount || 0) * 100)),
    subtotalPence
  );
  const netPence = subtotalPence - discountPence;

  const serviceChargeRate =
    options.dineIn && !options.serviceChargeWaived ? Math.max(0, rates.serviceChargeRate || 0) : 0;
  const serviceChargePence = Math.round((netPence * serviceChargeRate) / 100);

  const vatRate = options.vatRegistered === false ? 0 : Math.max(0, rates.vatRate || 0);
  const vatPence = Math.round((netPence * vatRate) / (100 + vatRate));

  return {
    subtotal: subtotalPence / 100,
    discount: discountPence / 100,
    serviceCharge: serviceChargePence / 100,
    netOfVat: (netPence - vatPence) / 100,
    vat: vatPence / 100,
    roundOff: 0,
    total: (netPence + serviceChargePence) / 100,
    appliedRates: { vatRate, serviceChargeRate },
  };
}

/**
 * VAT details for printing a saved bill (receipt, ESC/POS, HTML print).
 * Prefers the amounts saved on the order; falls back to the outlet's settings.
 */
export function receiptVat(order: any): { registered: boolean; rate: number; vatPounds: number; vatNumber: string } {
  const outlet = order?.outlet || {};
  const registered = (order?.vatRegistered ?? outlet.vatRegistered) !== false;
  const rate =
    order?.vatRate !== undefined && order?.vatRate !== null
      ? Number(order.vatRate)
      : outlet.vatRateDecimal !== undefined
        ? Number(outlet.vatRateDecimal)
        : 20;

  let vatPounds = 0;
  if (registered) {
    if (order?.vatPence !== undefined) vatPounds = order.vatPence / 100;
    else if (order?.vatAmount !== undefined) vatPounds = Number(order.vatAmount);
    else {
      const subtotal = order?.subtotalPence !== undefined ? order.subtotalPence / 100 : Number(order?.subtotal || 0);
      const discount = order?.discountPence !== undefined ? order.discountPence / 100 : Number(order?.discountAmount || 0);
      vatPounds = Math.round(((Math.max(0, subtotal - discount) * rate) / (100 + rate)) * 100) / 100;
    }
  }
  return { registered, rate, vatPounds, vatNumber: registered ? outlet.vatNumber || "" : "" };
}

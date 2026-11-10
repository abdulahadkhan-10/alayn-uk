// Suppliers have their own standalone app (supplier-alayn-uk). Restaurant pages a supplier lands on
// send them there; everything restaurant-side that links to the portal goes through this helper.

export const SUPPLIER_PORTAL_URL = (
  process.env.NEXT_PUBLIC_SUPPLIER_PORTAL_URL || "https://suppliers.alaynai.com"
).replace(/\/+$/, "");

/** Absolute URL of a supplier portal page, e.g. supplierPortalUrl("/orders"). */
export function supplierPortalUrl(path = ""): string {
  return `${SUPPLIER_PORTAL_URL}${path}`;
}

// Where a person lands after signing in, and how the "come back to this page" link is kept safe.

/** The page each role starts on. */
export function roleHome(role?: string | null): string {
  if (role === "STAFF") return "/pos";
  if (role === "KITCHEN") return "/kitchen";
  if (role === "SUPPLIER") return "/supplier";
  return "/dashboard";
}

const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Accepts only a same-site path (e.g. "/orders?tab=open") from the ?next= parameter. Anything that
 * could send a user to another site ("//evil.com", "https://...", "/\\evil.com") is dropped, as are
 * the sign-in pages themselves, which would loop.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  if (raw.length > 512) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  // Control characters / encoded newlines have no place in a path
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0];
  if (AUTH_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}

/** "/login?next=<current page>" so a person returns to where they were after signing back in. */
export function loginUrlFor(currentPath: string | null | undefined): string {
  const next = safeNextPath(currentPath);
  return next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";
}

/** The ?next= value from the current address, already checked. Browser only. */
export function readNextFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return safeNextPath(new URLSearchParams(window.location.search).get("next"));
  } catch {
    return null;
  }
}

/**
 * Where to go after signing in: the ?next= page only if this role may open it, otherwise the role's home.
 * Keeps a leftover ?next=/supplier from sending a restaurant owner to the supplier route, and keeps
 * POS and kitchen staff inside their own screens.
 */
export function roleAllowedNext(role?: string | null, rawNext?: string | null): string {
  const home = roleHome(role);
  const next = safeNextPath(rawNext);
  if (!next) return home;

  const path = next.split(/[?#]/)[0];

  if (role === "SUPPLIER") {
    return path === "/supplier" || path.startsWith("/supplier/") || path === "/profile" || path.startsWith("/profile/")
      ? next
      : "/supplier";
  }

  // Only suppliers use the supplier route
  if (path === "/supplier" || path.startsWith("/supplier/")) return home;

  if (role === "STAFF" && !path.startsWith("/pos")) return "/pos";
  if (role === "KITCHEN" && !path.startsWith("/kitchen")) return "/kitchen";

  return next;
}

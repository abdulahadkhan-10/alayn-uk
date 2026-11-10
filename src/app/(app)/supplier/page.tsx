"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { SUPPLIER_PORTAL_URL, supplierPortalUrl } from "@/lib/supplierPortal";

// Suppliers work in the standalone Supplier Portal; this old in-app route only forwards them there.
export default function SupplierRedirectPage() {
  useEffect(() => {
    window.location.href = supplierPortalUrl("/orders");
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#C41E2A]" />
        <p className="mt-3 text-sm font-semibold text-gray-700">
          Redirecting to the Supplier Portal...
        </p>
        <p className="mt-1 text-xs text-gray-400">{SUPPLIER_PORTAL_URL.replace(/^https?:\/\//, "")}</p>
      </div>
    </div>
  );
}

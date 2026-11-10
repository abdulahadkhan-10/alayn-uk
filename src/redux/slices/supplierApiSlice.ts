import { baseApi } from "../store/baseApi";

export interface SupplierItemApi {
  id: string;
  supplierId: string;
  name: string;
  sku?: string | null;
  category: string;
  unit: string;
  pricePaise: number;
  minOrderQty: number;
  inStock: boolean;
  leadTimeHours: number;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
  supplier?: {
    id: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    rating?: number;
    deliveryTerms?: string;
  };
}

export type MarketplaceSort = "BEST" | "PRICE" | "DELIVERY" | "NAME";

export interface MarketplaceSupplierRow {
  supplier: {
    id: string;
    name: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: string;
    rating: number | null;
    deliveryTerms: string | null;
  };
  categories: string[];
  totalItems: number;
  fastestLeadTimeHours: number;
  /** Cheapest item among those matching the search/category */
  minPricePaise: number;
  /** Cheapest products whose name matches the search (up to 3) */
  matchedItems: Pick<SupplierItemApi, "id" | "supplierId" | "name" | "unit" | "pricePaise" | "inStock">[];
  matchedCount: number;
}

export interface MarketplacePage {
  suppliers: MarketplaceSupplierRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  categories?: { name: string; supplierCount: number }[];
  totalSuppliers?: number;
}

export interface MarketplaceArgs {
  search?: string;
  category?: string;
  sort: MarketplaceSort;
  page: number;
}

export interface ComparisonOption extends SupplierItemApi {
  priceRupees: number;
  savingsPaise: number;
  savingsPercent: number;
  isCheaper: boolean;
  qualityScore?: number;
  supplierName: string;
  contactPerson: string;
  phone: string;
  email: string;
  rating: number;
  deliveryTerms?: string;
}

export interface SupplierComparisonResult {
  summary: {
    totalSuppliersFound: number;
    lowestPricePaise: number;
    lowestPriceRupees: number;
    highestSavingsPercent: number;
    fastestDeliveryHours: number;
  };
  recommendations: {
    cheapest: ComparisonOption | null;
    bestQuality: ComparisonOption | null;
    fastestDelivery: ComparisonOption | null;
  };
  allOptions: ComparisonOption[];
}

// Restaurant-side marketplace: browse suppliers who sell through the Supplier Portal and compare
// their prices. Suppliers manage their own profile and catalogue in the Supplier Portal app.
export const supplierApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Paged marketplace. "Show more" requests page 2, 3… and the pages are
    // appended into one cache entry per search/category/sort.
    getMarketplaceSuppliers: builder.query<MarketplacePage, MarketplaceArgs>({
      query: ({ search, category, sort, page }) => {
        const qs = new URLSearchParams({ sort, page: String(page) });
        if (search) qs.set("search", search);
        if (category && category !== "All") qs.set("category", category);
        return `/suppliers/marketplace?${qs.toString()}`;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}|${queryArgs.search ?? ""}|${queryArgs.category ?? ""}|${queryArgs.sort}`,
      merge: (cache, incoming, { arg }) => {
        if (arg.page === 1) return incoming;
        const seen = new Set(cache.suppliers.map((r) => r.supplier.id));
        cache.suppliers.push(...incoming.suppliers.filter((r) => !seen.has(r.supplier.id)));
        cache.total = incoming.total;
        cache.page = incoming.page;
        cache.hasMore = incoming.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg?.page !== previousArg?.page,
      providesTags: ["SupplierCatalog"],
      transformResponse: (response: { data: MarketplacePage }) => response.data,
    }),

    getMarketplaceSupplierItems: builder.query<SupplierItemApi[], string>({
      query: (supplierId) => `/suppliers/marketplace/${supplierId}/items`,
      providesTags: ["SupplierCatalog"],
      transformResponse: (response: { data: SupplierItemApi[] }) => response.data ?? [],
    }),

    compareSuppliers: builder.query<SupplierComparisonResult, { itemName?: string; category?: string; currentUnitCostPaise?: number; unit?: string }>({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params.itemName) queryParams.set("itemName", params.itemName);
        if (params.category && params.category !== "All") queryParams.set("category", params.category);
        if (params.currentUnitCostPaise !== undefined) queryParams.set("currentUnitCostPaise", String(params.currentUnitCostPaise));
        if (params.unit) queryParams.set("unit", params.unit);
        return `/suppliers/compare?${queryParams.toString()}`;
      },
      providesTags: ["SupplierCatalog"],
      transformResponse: (response: { data: SupplierComparisonResult }) => response.data,
    }),
  }),
});

export const {
  useGetMarketplaceSuppliersQuery,
  useGetMarketplaceSupplierItemsQuery,
  useCompareSuppliersQuery,
} = supplierApi;

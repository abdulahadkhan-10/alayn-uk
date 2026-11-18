import { baseApi } from "../store/baseApi";

/*
 * Recipes: the raw materials (stock items) one portion of a menu item uses at one branch.
 * They are optional. A sold dish with a recipe takes its ingredients out of stock when the bill is settled.
 *
 * The branch is sent by the app-wide x-outlet-id header; `outletId` is also passed as a query argument
 * so each branch gets its own cache entry (a menu item can be shared across branches with different recipes).
 */

export interface RecipeLine {
  itemId: string;
  name: string;
  sku: string;
  unit: string;
  unitCostPence: number;
  quantity: number;
  wastagePercent: number;
  lineCostPence: number;
}

export interface Recipe {
  menuItemId: string;
  menuItemName: string;
  outletId: string;
  hasRecipe: boolean;
  lines: RecipeLine[];
  costPerPortionPence: number;
  pricePence: number;
  marginPence: number;
  foodCostPercent: number | null;
}

export interface SaveRecipeLine {
  itemId: string;
  quantity: number;
  wastagePercent: number;
}

export interface SaveRecipeResult extends Recipe {
  copiedTo: { outletId: string; copied: boolean; reason?: string }[];
}

export interface RecipeCoverageItem {
  menuItemId: string;
  name: string;
  category: string | null;
  isActive: boolean;
  hasRecipe: boolean;
  ingredientCount: number;
  pricePence: number;
  costPerPortionPence: number | null;
  marginPence: number | null;
  foodCostPercent: number | null;
}

export interface RecipeCoverage {
  outletId: string;
  totalMenuItems: number;
  withRecipe: number;
  withoutRecipe: number;
  items: RecipeCoverageItem[];
}

/** The API wraps replies as { success, data } */
/** An add-on's recipe as the API returns it (named after the add-on, not a menu item) */
interface ModifierRecipeResponse extends Omit<Recipe, "menuItemId" | "menuItemName"> {
  modifierItemId: string;
  modifierName: string;
}

/** Add-on recipes are shown in the same editor as dish recipes, so they are given the same shape */
const asRecipe = (r: ModifierRecipeResponse): Recipe => {
  const { modifierItemId, modifierName, ...rest } = r;
  return { ...rest, menuItemId: modifierItemId, menuItemName: modifierName };
};

export interface UsageVarianceItem {
  itemId: string;
  name: string;
  unit: string;
  unitCostPence: number;
  /** False when no recipe uses this ingredient, so its use cannot be compared with sales */
  inRecipes: boolean;
  measuredFrom: string;
  measuredTo: string;
  actualUsed: number;
  soldTheoretical: number;
  wasteLogged: number;
  /** actualUsed minus (sold + waste). Positive = more went than the books explain */
  variance: number;
  variancePence: number;
}

export interface UsageVariance {
  outletId: string;
  from: string;
  to: string;
  items: UsageVarianceItem[];
  notMeasured: number;
  totalVariancePence: number;
  totalLossPence: number;
}

const unwrap = <T,>(response: unknown): T => ((response as { data?: T } | null)?.data ?? response) as T;

export const recipeApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRecipe: builder.query<Recipe, { menuItemId: string; outletId: string }>({
      query: ({ menuItemId }) => `/menu/items/${menuItemId}/recipe`,
      transformResponse: (r: unknown) => unwrap<Recipe>(r),
      providesTags: (_r, _e, { menuItemId }) => [{ type: "Recipes", id: menuItemId }],
    }),
    saveRecipe: builder.mutation<
      SaveRecipeResult,
      { menuItemId: string; lines: SaveRecipeLine[]; applyToOutletIds?: string[] }
    >({
      query: ({ menuItemId, lines, applyToOutletIds }) => ({
        url: `/menu/items/${menuItemId}/recipe`,
        method: "PUT",
        body: { lines, applyToOutletIds: applyToOutletIds ?? [] },
      }),
      transformResponse: (r: unknown) => unwrap<SaveRecipeResult>(r),
      invalidatesTags: ["Recipes"],
    }),
    deleteRecipe: builder.mutation<{ menuItemId: string; hasRecipe: false }, { menuItemId: string }>({
      query: ({ menuItemId }) => ({ url: `/menu/items/${menuItemId}/recipe`, method: "DELETE" }),
      transformResponse: (r: unknown) => unwrap<{ menuItemId: string; hasRecipe: false }>(r),
      invalidatesTags: ["Recipes"],
    }),
    getModifierRecipe: builder.query<Recipe, { modifierItemId: string; outletId: string }>({
      query: ({ modifierItemId }) => `/menu/modifier-items/${modifierItemId}/recipe`,
      transformResponse: (r: unknown) => asRecipe(unwrap<ModifierRecipeResponse>(r)),
      providesTags: (_r, _e, { modifierItemId }) => [{ type: "Recipes", id: modifierItemId }],
    }),
    saveModifierRecipe: builder.mutation<Recipe, { modifierItemId: string; lines: SaveRecipeLine[] }>({
      query: ({ modifierItemId, lines }) => ({
        url: `/menu/modifier-items/${modifierItemId}/recipe`,
        method: "PUT",
        body: { lines },
      }),
      transformResponse: (r: unknown) => asRecipe(unwrap<ModifierRecipeResponse>(r)),
      invalidatesTags: ["Recipes"],
    }),
    deleteModifierRecipe: builder.mutation<{ modifierItemId: string; hasRecipe: false }, { modifierItemId: string }>({
      query: ({ modifierItemId }) => ({ url: `/menu/modifier-items/${modifierItemId}/recipe`, method: "DELETE" }),
      transformResponse: (r: unknown) => unwrap<{ modifierItemId: string; hasRecipe: false }>(r),
      invalidatesTags: ["Recipes"],
    }),
    getUsageVariance: builder.query<UsageVariance, { outletId: string; from?: string; to?: string }>({
      query: ({ from, to }) => {
        const qs = new URLSearchParams();
        if (from) qs.set("from", from);
        if (to) qs.set("to", to);
        const text = qs.toString();
        return `/inventory/variance${text ? `?${text}` : ""}`;
      },
      transformResponse: (r: unknown) => unwrap<UsageVariance>(r),
      // Stock counts, sales and waste all change it
      providesTags: ["Recipes", "Inventory"],
    }),
    getRecipeCoverage: builder.query<RecipeCoverage, { outletId: string }>({
      query: () => "/inventory/recipes",
      transformResponse: (r: unknown) => unwrap<RecipeCoverage>(r),
      providesTags: ["Recipes"],
    }),
  }),
});

export const {
  useGetRecipeQuery,
  useSaveRecipeMutation,
  useDeleteRecipeMutation,
  useGetRecipeCoverageQuery,
  useGetModifierRecipeQuery,
  useSaveModifierRecipeMutation,
  useDeleteModifierRecipeMutation,
  useGetUsageVarianceQuery,
} = recipeApiSlice;

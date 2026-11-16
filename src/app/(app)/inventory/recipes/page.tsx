"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Building2, Search } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import InventoryNavTabs from "@/components/Inventory/InventoryNavTabs";
import RecipeEditor, { RecipeEditorMenuItem } from "@/components/menu/RecipeEditor";
import { useBranch } from "@/lib/BranchContext";
import { cn } from "@/lib/utils";
import { FOOD_COST_CLASSES, foodCostTone, pounds } from "@/lib/recipeCost";
import { RecipeCoverageItem, useGetRecipeCoverageQuery } from "@/redux/slices/recipeApiSlice";

type Filter = "ALL" | "WITH" | "WITHOUT";
type Sort = "NAME" | "FOOD_COST_DESC" | "MARGIN_ASC";

/*
 * Recipes overview: which dishes have a recipe, what a portion costs to make and what it leaves.
 * Recipes are optional, so a dish without one is simply listed as "No recipe"; it is not an error.
 */
export default function RecipesPage() {
  const { activeBranch, loading: branchLoading } = useBranch();
  const outletId = activeBranch?.id && activeBranch.id !== "all" ? activeBranch.id : null;
  const { data, isLoading } = useGetRecipeCoverageQuery({ outletId: outletId ?? "" }, { skip: !outletId });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("NAME");
  const [target, setTarget] = useState<RecipeEditorMenuItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (data?.items ?? []).filter(
      (r) =>
        (!q || r.name.toLowerCase().includes(q) || (r.category ?? "").toLowerCase().includes(q)) &&
        (filter === "ALL" || (filter === "WITH" ? r.hasRecipe : !r.hasRecipe)),
    );
    const byNumber = (a: number | null, b: number | null, dir: 1 | -1) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1; // dishes without a figure always last
      if (b === null) return -1;
      return (a - b) * dir;
    };
    return [...list].sort((a, b) =>
      sort === "FOOD_COST_DESC"
        ? byNumber(a.foodCostPercent, b.foodCostPercent, -1)
        : sort === "MARGIN_ASC"
          ? byNumber(a.marginPaise, b.marginPaise, 1)
          : a.name.localeCompare(b.name),
    );
  }, [data, search, filter, sort]);

  const total = data?.totalMenuItems ?? 0;
  const covered = data?.withRecipe ?? 0;
  const percent = total > 0 ? Math.round((covered / total) * 100) : 0;

  const openEditor = (r: RecipeCoverageItem) => {
    setTarget({ id: r.menuItemId, name: r.name, price: r.pricePaise / 100 });
    setEditorOpen(true);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "ALL", label: "All dishes" },
    { id: "WITH", label: "With recipe" },
    { id: "WITHOUT", label: "No recipe" },
  ];

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full gap-5 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-10">
        <InventoryNavTabs />

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Recipes</h1>
            {outletId && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-0.5 text-xs font-bold text-[#D3232A] border border-red-100">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-600 max-w-prose">
            A recipe lists the raw materials one portion of a dish uses. When a dish with a recipe is sold and the bill is
            settled, those materials come out of stock automatically. Recipes are optional; dishes without one leave stock alone.
          </p>
        </div>

        {!outletId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Recipes are kept per branch because stock is per branch. Choose a specific branch at the top of the page to see its recipes.
          </div>
        ) : isLoading || branchLoading ? (
          <Skeleton count={6} height={52} borderRadius={12} className="mb-2" />
        ) : total === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
            <p className="text-sm font-semibold text-zinc-700">No menu items at this branch yet</p>
            <p className="text-sm text-zinc-500 mt-1">Add dishes on the Menu page, then give them recipes here.</p>
          </div>
        ) : (
          <>
            {/* Coverage */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-bold text-zinc-900">
                  {covered} of {total} dishes have a recipe
                </p>
                <p className="text-sm font-semibold text-zinc-600 tabular-nums">{percent}%</p>
              </div>
              <div
                className="mt-2 h-2 rounded-full bg-zinc-100 overflow-hidden"
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Dishes with a recipe"
              >
                <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-300" style={{ width: `${percent}%` }} />
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                <input
                  type="search"
                  placeholder="Find a dish or category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-3 py-2 text-sm focus:border-zinc-900 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-0.5" role="group" aria-label="Filter dishes">
                  {filters.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      aria-pressed={filter === f.id}
                      className={cn(
                        "rounded-[10px] px-3 py-1.5 text-xs font-bold transition-colors",
                        filter === f.id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <label className="sr-only" htmlFor="recipe-sort">Sort dishes</label>
                <select
                  id="recipe-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-700 focus:border-zinc-900 focus:outline-none"
                >
                  <option value="NAME">Sort: Name</option>
                  <option value="FOOD_COST_DESC">Sort: Highest food cost</option>
                  <option value="MARGIN_ASC">Sort: Lowest margin</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-2xs">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="text-left font-bold px-4 py-3">Dish</th>
                    <th className="text-left font-bold px-4 py-3">Category</th>
                    <th className="text-right font-bold px-4 py-3">Price</th>
                    <th className="text-right font-bold px-4 py-3">Cost / portion</th>
                    <th className="text-right font-bold px-4 py-3">Margin</th>
                    <th className="text-right font-bold px-4 py-3">Food cost</th>
                    <th className="px-4 py-3 text-right font-bold">Recipe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                        No dishes match.
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.menuItemId} className="hover:bg-zinc-50/80">
                        <td className="px-4 py-3 font-semibold text-zinc-900">
                          {r.name}
                          {!r.isActive && <span className="ml-2 text-xs font-medium text-zinc-500">(inactive)</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-600">{r.category ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{pounds(r.pricePaise)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.costPerPortionPaise === null ? <span className="text-zinc-500">—</span> : pounds(r.costPerPortionPaise)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {r.marginPaise === null ? <span className="text-zinc-500">—</span> : pounds(r.marginPaise)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {r.foodCostPercent === null ? (
                            <span className="text-zinc-500">—</span>
                          ) : (
                            <span
                              className={cn(
                                "inline-block rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums",
                                FOOD_COST_CLASSES[foodCostTone(r.foodCostPercent)],
                              )}
                            >
                              {r.foodCostPercent}%
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEditor(r)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                              r.hasRecipe
                                ? "border-zinc-200 text-zinc-700 hover:bg-zinc-100"
                                : "border-[#D3232A]/30 text-[#D3232A] hover:bg-red-50",
                            )}
                          >
                            <BookOpen className="h-3.5 w-3.5" />
                            {r.hasRecipe ? `Edit (${r.ingredientCount})` : "Add recipe"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <RecipeEditor open={editorOpen} onClose={() => setEditorOpen(false)} menuItem={target} />
    </DashboardLayout>
  );
}

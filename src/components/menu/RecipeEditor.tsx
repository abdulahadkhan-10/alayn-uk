"use client";

import React, { useMemo, useState } from "react";
import { BookOpen, Loader2, Plus, Search, Store, Trash2, X } from "lucide-react";
import { TModal } from "@/components/ui/TModal";
import { useBranch } from "@/lib/BranchContext";
import { cn } from "@/lib/utils";
import { useGetItemsQuery } from "@/redux/slices/inventoryApiSlice";
import {
  Recipe,
  useDeleteModifierRecipeMutation,
  useDeleteRecipeMutation,
  useGetModifierRecipeQuery,
  useGetRecipeQuery,
  useSaveModifierRecipeMutation,
  useSaveRecipeMutation,
} from "@/redux/slices/recipeApiSlice";
import {
  FOOD_COST_CLASSES,
  apiErrorMessage,
  foodCostTone,
  lineCostPence,
  pounds,
  summarizeCost,
} from "@/lib/recipeCost";

export interface RecipeEditorMenuItem {
  id: string;
  name: string;
  /** Selling price in pounds, as the menu page holds it (for an add-on, the extra it adds) */
  price: number;
  /** A dish (the default) or an add-on / option choice such as "Extra cheese" */
  kind?: "dish" | "addon";
}

interface DraftLine {
  itemId: string;
  quantity: string;
  wastagePercent: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  menuItem: RecipeEditorMenuItem | null;
}

const toNumber = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

function RecipeForm({
  menuItem,
  recipe,
  outletId,
  onClose,
}: {
  menuItem: RecipeEditorMenuItem;
  recipe: Recipe;
  outletId: string;
  onClose: () => void;
}) {
  const { branches } = useBranch();
  const { data: stock } = useGetItemsQuery();
  const isAddon = menuItem.kind === "addon";
  const [saveDish, { isLoading: isSavingDish }] = useSaveRecipeMutation();
  const [deleteDish, { isLoading: isDeletingDish }] = useDeleteRecipeMutation();
  const [saveAddon, { isLoading: isSavingAddon }] = useSaveModifierRecipeMutation();
  const [deleteAddon, { isLoading: isDeletingAddon }] = useDeleteModifierRecipeMutation();
  const isSaving = isSavingDish || isSavingAddon;
  const isDeleting = isDeletingDish || isDeletingAddon;

  // Starts from the saved recipe; the form is mounted only once it has loaded
  const [lines, setLines] = useState<DraftLine[]>(() =>
    recipe.lines.map((l) => ({
      itemId: l.itemId,
      quantity: String(l.quantity),
      wastagePercent: l.wastagePercent ? String(l.wastagePercent) : "",
    })),
  );
  const [search, setSearch] = useState("");
  const [copyTo, setCopyTo] = useState<string[]>([]);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const items = useMemo(() => stock?.items ?? [], [stock]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const pricePence = Math.round((menuItem?.price ?? 0) * 100);
  const costLines = lines.map((l) => ({
    quantity: toNumber(l.quantity),
    wastagePercent: toNumber(l.wastagePercent),
    unitCostPence: itemById.get(l.itemId)?.unitCostPence ?? 0,
  }));
  const summary = summarizeCost(costLines, pricePence);
  const tone = foodCostTone(lines.length ? summary.foodCostPercent : null);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const used = new Set(lines.map((l) => l.itemId));
    return items
      .filter((i) => !used.has(i.id) && (i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)))
      .slice(0, 8);
  }, [search, items, lines]);

  const otherBranches = useMemo(() => branches.filter((b) => b.id !== "all" && b.id !== outletId), [branches, outletId]);

  const invalid = lines.some((l) => toNumber(l.quantity) <= 0 || toNumber(l.wastagePercent) < 0 || toNumber(l.wastagePercent) > 100);
  const hasSavedRecipe = recipe.hasRecipe;

  const addIngredient = (itemId: string) => {
    setLines((prev) => [...prev, { itemId, quantity: "", wastagePercent: "" }]);
    setSearch("");
  };
  const updateLine = (itemId: string, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));

  const handleSave = async () => {
    if (!menuItem) return;
    setMessage(null);
    try {
      const payload = lines.map((l) => ({ itemId: l.itemId, quantity: toNumber(l.quantity), wastagePercent: toNumber(l.wastagePercent) }));
      if (isAddon) {
        await saveAddon({ modifierItemId: menuItem.id, lines: payload }).unwrap();
        onClose();
        return;
      }
      const result = await saveDish({ menuItemId: menuItem.id, lines: payload, applyToOutletIds: copyTo }).unwrap();
      const failed = result.copiedTo.filter((c) => !c.copied);
      if (failed.length > 0) {
        const nameOf = (id: string) => branches.find((b) => b.id === id)?.name ?? "A branch";
        setMessage({ kind: "info", text: `Saved. Not copied: ${failed.map((f) => `${nameOf(f.outletId)} (${f.reason})`).join("; ")}` });
        return;
      }
      onClose();
    } catch (err) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    }
  };

  const handleRemove = async () => {
    if (!menuItem) return;
    setMessage(null);
    try {
      if (isAddon) await deleteAddon({ modifierItemId: menuItem.id }).unwrap();
      else await deleteDish({ menuItemId: menuItem.id }).unwrap();
      onClose();
    } catch (err) {
      setMessage({ kind: "error", text: apiErrorMessage(err) });
    }
  };

  return (
    <>
              <p className="text-xs text-gray-500">
                {isAddon
                  ? "Optional. When a dish is sold with this add-on and the bill is settled, the materials below are taken out of stock on top of the dish's own recipe. Leave it empty and nothing extra is taken."
                  : "Optional. When this dish is sold and the bill is settled, the materials below are taken out of stock automatically. Leave it empty and stock isn't touched."}
              </p>

              {/* Ingredient picker */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stock items to add (name or SKU)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3232A]/20 focus:border-[#D3232A]"
                />
                {search.trim() && (
                  <ul className="absolute z-10 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
                    {matches.length === 0 ? (
                      <li className="px-3 py-2.5 text-sm text-gray-500">No matching stock items. Add the item in Inventory first.</li>
                    ) : (
                      matches.map((i) => (
                        <li key={i.id}>
                          <button
                            type="button"
                            onClick={() => addIngredient(i.id)}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          >
                            <span className="font-medium text-gray-800">{i.name}</span>
                            <span className="flex items-center gap-2 text-xs text-gray-500">
                              {i.sku} · {i.unit} <Plus className="w-4 h-4 text-[#D3232A]" />
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {/* Lines */}
              {false ? (
                <div className="flex items-center gap-2 py-6 justify-center text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading recipe…
                </div>
              ) : lines.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
                  No ingredients yet. Search above to add the first one.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500">
                      <tr>
                        <th className="text-left font-semibold px-3 py-2">Ingredient</th>
                        <th className="text-left font-semibold px-3 py-2">Qty per portion</th>
                        <th className="text-left font-semibold px-3 py-2">Wastage %</th>
                        <th className="text-right font-semibold px-3 py-2">Cost</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lines.map((l, idx) => {
                        const item = itemById.get(l.itemId);
                        const saved = recipe?.lines.find((r) => r.itemId === l.itemId);
                        const name = item?.name ?? saved?.name ?? "Unknown item";
                        const unit = item?.unit ?? saved?.unit ?? "";
                        return (
                          <tr key={l.itemId}>
                            <td className="px-3 py-2 font-medium text-gray-800">{name}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  inputMode="decimal"
                                  value={l.quantity}
                                  onChange={(e) => updateLine(l.itemId, { quantity: e.target.value })}
                                  aria-label={`Quantity of ${name} per portion`}
                                  autoFocus={idx === lines.length - 1 && l.quantity === ""}
                                  className={cn(
                                    "w-24 rounded-lg border px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3232A]/20",
                                    toNumber(l.quantity) <= 0 ? "border-rose-300" : "border-gray-200",
                                  )}
                                />
                                <span className="text-xs text-gray-500">{unit}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                inputMode="decimal"
                                value={l.wastagePercent}
                                onChange={(e) => updateLine(l.itemId, { wastagePercent: e.target.value })}
                                placeholder="0"
                                aria-label={`Wastage percent for ${name}`}
                                className="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D3232A]/20"
                              />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                              {pounds(
                                lineCostPence({
                                  quantity: toNumber(l.quantity),
                                  wastagePercent: toNumber(l.wastagePercent),
                                  unitCostPence: item?.unitCostPence ?? saved?.unitCostPence ?? 0,
                                }),
                              )}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setLines((prev) => prev.filter((x) => x.itemId !== l.itemId))}
                                aria-label={`Remove ${name}`}
                                className="p-1.5 rounded-lg text-gray-500 hover:text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Cost summary */}
              {lines.length > 0 && (
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <dt className="text-xs text-gray-500">Cost per portion</dt>
                    <dd className="text-base font-bold text-gray-900 tabular-nums">{pounds(summary.costPerPortionPence)}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <dt className="text-xs text-gray-500">{isAddon ? "Add-on price" : "Selling price"}</dt>
                    <dd className="text-base font-bold text-gray-900 tabular-nums">{pounds(pricePence)}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <dt className="text-xs text-gray-500">Margin</dt>
                    <dd className="text-base font-bold text-gray-900 tabular-nums">{pounds(summary.marginPence)}</dd>
                  </div>
                  <div className={cn("rounded-xl border p-3", FOOD_COST_CLASSES[tone])}>
                    <dt className="text-xs opacity-80">Food cost</dt>
                    <dd className="text-base font-bold tabular-nums">
                      {summary.foodCostPercent === null ? "—" : `${summary.foodCostPercent}%`}
                    </dd>
                  </div>
                </dl>
              )}

              {/* Copy to other branches */}
              {!isAddon && otherBranches.length > 0 && lines.length > 0 && (
                <fieldset className="rounded-xl border border-gray-200 p-3">
                  <legend className="px-1 text-xs font-semibold text-gray-600">Also save this recipe at</legend>
                  <p className="text-xs text-gray-500 mb-2">Ingredients are matched to the other branch&apos;s stock by SKU.</p>
                  <div className="flex flex-wrap gap-2">
                    {otherBranches.map((b) => {
                      const checked = copyTo.includes(b.id);
                      return (
                        <label
                          key={b.id}
                          className={cn(
                            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                            checked ? "border-[#D3232A] bg-red-50 text-[#D3232A]" : "border-gray-200 text-gray-700 hover:bg-gray-50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            onChange={() => setCopyTo((prev) => (checked ? prev.filter((id) => id !== b.id) : [...prev, b.id]))}
                          />
                          <Store className="w-3.5 h-3.5" /> {b.name}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {message && (
                <p
                  role="alert"
                  className={cn(
                    "rounded-xl border p-3 text-sm",
                    message.kind === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-800",
                  )}
                >
                  {message.text}
                </p>
              )}

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div>
                  {hasSavedRecipe && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={isDeleting || isSaving}
                      className="text-xs font-semibold text-rose-600 hover:text-rose-700 disabled:opacity-50"
                    >
                      {isDeleting ? "Removing…" : "Remove recipe"}
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={onClose} className="btn-ghost">
                    {message?.kind === "info" ? "Close" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving || isDeleting || invalid || (lines.length === 0 && !hasSavedRecipe)}
                    className="bg-[#D3232A] hover:bg-[#b01e23] text-white font-semibold px-4 py-2 rounded-xl transition duration-200 cursor-pointer disabled:opacity-50 text-xs"
                  >
                    {isSaving ? "Saving…" : lines.length === 0 ? "Clear recipe" : "Save recipe"}
                  </button>
                </div>
              </div>
    </>
  );
}

/*
 * Recipe editor: which raw materials, and how much of each, make one portion of a menu item at the
 * selected branch. Recipes are optional. A dish with a recipe takes these materials out of stock when
 * its bill is settled; a dish without one leaves stock alone.
 */
export default function RecipeEditor({ open, onClose, menuItem }: Props) {
  const { activeBranch } = useBranch();
  const outletId = activeBranch?.id && activeBranch.id !== "all" ? activeBranch.id : null;
  const menuItemId = menuItem?.id ?? "";

  const isAddon = menuItem?.kind === "addon";
  const skip = !open || !outletId || !menuItemId;
  const dish = useGetRecipeQuery({ menuItemId, outletId: outletId ?? "" }, { skip: skip || isAddon });
  const addon = useGetModifierRecipeQuery({ modifierItemId: menuItemId, outletId: outletId ?? "" }, { skip: skip || !isAddon });
  const { data: recipe, isError } = isAddon ? addon : dish;

  return (
    <TModal open={open} onClose={onClose} className="p-4 bg-gray-900/50 backdrop-blur-sm">
      {open && menuItem && (
        <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-[#1B2A4A] flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#D3232A]" /> {isAddon ? "Add-on recipe" : "Recipe"}
              </h3>
              <p className="text-sm text-gray-600 mt-0.5">
                {menuItem.name} <span className="text-gray-400">· {activeBranch?.name}</span>
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>


          {!outletId ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Recipes are kept per branch because stock is per branch. Choose a specific branch at the top of the page to add or edit this recipe.
            </p>
          ) : isError ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              Couldn&apos;t load this recipe. Close and try again.
            </p>
          ) : !recipe || recipe.menuItemId !== menuItem.id ? (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading recipe…
            </div>
          ) : (
            <RecipeForm key={menuItem.id} menuItem={menuItem} recipe={recipe} outletId={outletId} onClose={onClose} />
          )}
        </div>
      )}
    </TModal>
  );
}

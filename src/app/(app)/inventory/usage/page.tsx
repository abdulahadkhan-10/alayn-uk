"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ClipboardCheck } from "lucide-react";
import Skeleton from "react-loading-skeleton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import InventoryNavTabs from "@/components/Inventory/InventoryNavTabs";
import { useBranch } from "@/lib/BranchContext";
import { cn } from "@/lib/utils";
import { pounds } from "@/lib/recipeCost";
import { UsageVarianceItem, useGetUsageVarianceQuery } from "@/redux/slices/recipeApiSlice";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/** A difference within this share of what was used counts as in line (counting and portioning are never exact) */
const IN_LINE_SHARE = 0.05;

const qty = (n: number) => `${+n.toFixed(2)}`;
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Status = "over" | "under" | "inline" | "unmatched";

function statusOf(i: UsageVarianceItem): Status {
  if (!i.inRecipes) return "unmatched";
  if (Math.abs(i.variance) <= Math.abs(i.actualUsed) * IN_LINE_SHARE) return "inline";
  return i.variance > 0 ? "over" : "under";
}

const STATUS_BADGE: Record<Status, { label: string; className: string }> = {
  over: { label: "More used than sales explain", className: "border-rose-200 bg-rose-50 text-rose-700" },
  under: { label: "Less used than sales say", className: "border-amber-200 bg-amber-50 text-amber-800" },
  inline: { label: "In line", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  unmatched: { label: "Not in any recipe", className: "border-zinc-200 bg-zinc-50 text-zinc-600" },
};

/*
 * Usage: for each ingredient, what was really used between two stock counts against what recipe sales and
 * logged waste say should have been used. A big gap points to over-portioning, unlogged waste, a wrong
 * recipe or missing stock. Ingredients no recipe uses cannot be compared, so they are marked and left out of the totals.
 */
export default function UsagePage() {
  const { activeBranch, loading: branchLoading } = useBranch();
  const outletId = activeBranch?.id && activeBranch.id !== "all" ? activeBranch.id : null;

  const [days, setDays] = useState(30);
  // Fixed per choice so the request (and its cache entry) doesn't change on every render
  const range = useMemo(() => {
    const to = new Date();
    return { from: new Date(to.getTime() - days * 24 * 60 * 60 * 1000).toISOString(), to: to.toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, outletId]);

  const { data, isLoading, isError } = useGetUsageVarianceQuery(
    { outletId: outletId ?? "", ...range },
    { skip: !outletId },
  );

  const items = data?.items ?? [];

  return (
    <DashboardLayout>
      <div className="flex flex-col min-h-full gap-5 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pb-10">
        <InventoryNavTabs />

        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 tracking-tight">Usage vs recipes</h1>
            {outletId && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-0.5 text-xs font-bold text-[#D3232A] border border-red-100">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-600 max-w-prose">
            Compares what was really used between your stock counts with what recipe sales and logged waste say should have been
            used. A large gap can mean over-portioning, unlogged waste, a recipe that needs fixing, or stock going missing.
          </p>
        </div>

        {!outletId ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
            Usage is measured per branch because stock is per branch. Choose a specific branch at the top of the page.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-0.5" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => setDays(p.days)}
                    aria-pressed={days === p.days}
                    className={cn(
                      "rounded-[10px] px-3 py-1.5 text-xs font-bold transition-colors",
                      days === p.days ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100",
                    )}
                  >
                    Last {p.label}
                  </button>
                ))}
              </div>
              <Link
                href="/inventory/count"
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-800 hover:bg-zinc-50"
              >
                <ClipboardCheck className="h-4 w-4" /> Count stock
              </Link>
            </div>

            {isLoading || branchLoading ? (
              <Skeleton count={5} height={52} borderRadius={12} className="mb-2" />
            ) : isError || !data ? (
              <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
                Couldn&apos;t load usage right now. Please try again in a moment.
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold text-zinc-700">Nothing to compare yet</p>
                <p className="text-sm text-zinc-500 mt-1 max-w-prose mx-auto">
                  An ingredient needs to be counted at least twice, a day or more apart, in this period. Count your stock now and again
                  in a few days (weekly is plenty) and this page fills in.
                </p>
                {data.notMeasured > 0 && (
                  <p className="text-xs text-zinc-500 mt-2">{data.notMeasured} ingredients are waiting for a second count.</p>
                )}
              </div>
            ) : (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                    <dt className="text-xs font-semibold text-zinc-500">Used more than recipes explain</dt>
                    <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-900">{pounds(data.totalLossPaise)}</dd>
                    <p className="text-xs text-zinc-500 mt-0.5">At today&apos;s ingredient costs, ingredients in recipes only</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                    <dt className="text-xs font-semibold text-zinc-500">Ingredients compared</dt>
                    <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-900">{items.length}</dd>
                    <p className="text-xs text-zinc-500 mt-0.5">Counted twice, a day or more apart</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
                    <dt className="text-xs font-semibold text-zinc-500">Waiting for a second count</dt>
                    <dd className="mt-1 text-2xl font-black tabular-nums text-zinc-900">{data.notMeasured}</dd>
                    <p className="text-xs text-zinc-500 mt-0.5">Not shown below</p>
                  </div>
                </dl>

                <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-2xs">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
                      <tr>
                        <th className="text-left font-bold px-4 py-3">Ingredient</th>
                        <th className="text-left font-bold px-4 py-3">Between counts</th>
                        <th className="text-right font-bold px-4 py-3">Really used</th>
                        <th className="text-right font-bold px-4 py-3">Sold (recipes)</th>
                        <th className="text-right font-bold px-4 py-3">Logged waste</th>
                        <th className="text-right font-bold px-4 py-3">Difference</th>
                        <th className="text-left font-bold px-4 py-3">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {items.map((i) => {
                        const status = statusOf(i);
                        const badge = STATUS_BADGE[status];
                        return (
                          <tr key={i.itemId} className="hover:bg-zinc-50/80">
                            <td className="px-4 py-3 font-semibold text-zinc-900">{i.name}</td>
                            <td className="px-4 py-3 text-zinc-600 whitespace-nowrap">
                              {shortDate(i.measuredFrom)} – {shortDate(i.measuredTo)}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{qty(i.actualUsed)} {i.unit}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {i.inRecipes ? `${qty(i.soldTheoretical)} ${i.unit}` : <span className="text-zinc-500">—</span>}
                            </td>
                            <td className="px-4 py-3 text-right tabular-nums">{qty(i.wasteLogged)} {i.unit}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {i.inRecipes ? (
                                <>
                                  <span className="font-bold text-zinc-900">
                                    {i.variance > 0 ? "+" : ""}{qty(i.variance)} {i.unit}
                                  </span>
                                  <span className="block text-xs text-zinc-500">{pounds(i.variancePaise)}</span>
                                </>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-block rounded-md border px-2 py-0.5 text-xs font-bold", badge.className)}>
                                {badge.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState } from "react";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Link from "next/link";
import { 
  Store, 
  Plus, 
  Search, 
  MapPin, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Landmark,
  CreditCard,
  Sparkles,
  Calendar,
  AlertTriangle,
  Receipt,
  Trash2,
  Hash,
  Minus,
  Maximize2
} from "lucide-react";
import { useAppSelector } from "@/redux/store/hooks";
import { useGetOutletsQuery, useDeleteOutletMutation } from "@/redux/slices/outletApiSlice";
import { useBranch } from "@/lib/BranchContext";
import SubscriptionRenewModal from "@/components/subscription/SubscriptionRenewModal";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function OutletsLedgerPage() {
  const user = useAppSelector((state) => state.auth.user);
  const { data: outletsData, isLoading, refetch } = useGetOutletsQuery();
  const { activeBranch, setActiveBranch, refreshBranches } = useBranch();
  const [deleteOutlet, { isLoading: isDeletingOutlet }] = useDeleteOutletMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedOutletForRenew, setSelectedOutletForRenew] = useState<any | null>(null);

  const userRole = user?.role || "BUSINESS_OWNER";
  const isAuthorized = userRole === "BUSINESS_OWNER" || userRole === "SUPER_ADMIN";

  const outlets = (outletsData as any)?.data || (Array.isArray(outletsData) ? outletsData : []);

  const filteredOutlets = (outlets as any[]).filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.name?.toLowerCase().includes(query) ||
      item.city?.toLowerCase().includes(query) ||
      item.address?.toLowerCase().includes(query) ||
      item.state?.toLowerCase().includes(query)
    );
  });

  // Access Restricted Guard for Managers / Staff / Kitchen
  if (!isAuthorized) {
    return (
      <AuthGuard>
        <DashboardLayout>
          <div className="max-w-2xl mx-auto py-12 text-center">
            <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-gray-100 flex flex-col items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-[#D3232A] mb-6 shadow-xs">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-serif mb-3">
                Access Restricted
              </h1>
              <p className="text-sm text-zinc-500 max-w-md font-medium leading-relaxed mb-8">
                The Outlet Ledger view is reserved exclusively for <strong>Business Owners</strong> and <strong>Super Admins</strong>.
              </p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#D3232A] px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#b01e23] transition-all"
              >
                Return to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  const calculateDaysRemaining = (endStr?: string) => {
    if (!endStr) return 0;
    const end = new Date(endStr).getTime();
    const now = Date.now();
    return Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  };

  return (
    <AuthGuard>
      <DashboardLayout>
        <div className="space-y-6 pb-12">
          {/* Top Header Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0B1221] px-8 py-9 rounded-[32px] text-white shadow-sm border border-slate-800">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                  <Store className="h-3.5 w-3.5" />
                  Branch Ledger Active
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Total Registered: <strong className="text-white">{outlets.length} Outlets</strong>
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Outlet & Subscription Ledger
              </h1>
              <p className="mt-1.5 text-sm text-slate-400 max-w-xl font-medium">
                Manage your physical restaurant branches, Cashfree monthly subscriptions, and live terminal statuses.
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2.5">
              <Link
                href="/settings/billing"
                className="flex items-center gap-2 rounded-xl bg-[#111a2e] hover:bg-slate-800 px-5 py-3 text-xs font-semibold text-white transition-colors border border-slate-700 cursor-pointer"
              >
                <Receipt className="h-3.5 w-3.5 text-red-400" />
                Billing & Receipts
              </Link>
              <button
                onClick={() => refetch()}
                className="flex items-center gap-2 rounded-xl bg-[#111a2e] hover:bg-slate-800 px-5 py-3 text-xs font-semibold text-white transition-colors border border-slate-700 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh
              </button>
              <Link
                href="/outlets/create"
                className="flex items-center gap-2 rounded-xl bg-[#D3232A] hover:bg-[#b01e23] px-5 py-3 text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:-translate-y-[1px]"
              >
                <Plus className="h-4 w-4" />
                Register New Outlet
              </Link>
            </div>
          </div>

          {/* Pending Activation Banner */}
          {(() => {
            const pendingList = (outlets as any[]).filter((item) => {
              const sub = item.subscription;
              if (!sub || sub.status !== "ACTIVE") return true;
              if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) <= new Date()) return true;
              return false;
            });

            if (pendingList.length === 0) return null;

            return (
              <div className="rounded-2xl bg-amber-50/90 border border-amber-200/90 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-xs sm:text-sm font-bold text-amber-950">
                      {pendingList.length === 1 
                        ? `1 outlet requires subscription payment (${pendingList[0].name})` 
                        : `${pendingList.length} outlets require subscription payment`}
                    </h2>
                    <p className="text-xs text-amber-800 font-medium mt-0.5">
                      Operational features (POS counters, Live KDS, Inventory telemetry, and Menu items) remain locked until subscription payment is completed.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOutletForRenew(pendingList[0])}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#D3232A] hover:bg-[#b01e23] text-white px-4 py-2.5 text-xs font-bold transition-all shadow-sm shrink-0 cursor-pointer hover:-translate-y-[0.5px]"
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  Pay £94.80 & Unlock Branch
                </button>
              </div>
            );
          })()}

          {/* Filter & Search Bar */}
          <div className="bg-white px-4 py-4 rounded-[28px] border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by outlet name, city..."
                className="block w-full rounded-2xl border-0 py-2.5 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#D3232A] sm:text-xs bg-gray-50/50 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Showing {filteredOutlets.length} of {outlets.length} Outlets</span>
            </div>
          </div>

          {/* Branch Network Map */}
          <div className="relative bg-slate-100/70 rounded-[28px] border border-slate-200/70 shadow-xs overflow-hidden">
            {isLoading ? (
              <SkeletonTheme baseColor="#F1F5F9" highlightColor="#F8FAFC">
                <div className="p-6 space-y-4">
                  <Skeleton height={24} width={200} borderRadius={6} />
                  <Skeleton count={4} height={56} borderRadius={12} />
                </div>
              </SkeletonTheme>
            ) : filteredOutlets.length === 0 ? (
              <div className="p-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 mx-auto mb-3">
                  <Store className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-1">No Outlets Found</h3>
                <p className="text-xs text-gray-500 mb-6 font-medium">
                  {searchQuery ? "No outlet matches your search query." : "You haven't registered any restaurant outlets yet."}
                </p>
                <Link
                  href="/outlets/create"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#D3232A] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#b01e23] transition-all"
                >
                  <Plus className="h-4 w-4" />
                  Register First Outlet
                </Link>
              </div>
            ) : (
              (() => {
                const headOutlet = filteredOutlets.find((o: any) => o.isHeadOffice) || filteredOutlets[0];
                const branchOutlets = filteredOutlets.filter((o: any) => o.id !== headOutlet.id);
                const focusId = hoveredNodeId ?? selectedNodeId;

                const renderNode = (outlet: any, isHead: boolean, popoverSide: "left" | "right") => {
                  const idx = (outlets as any[]).findIndex((o) => o.id === outlet.id);
                  const ledgerId = `#OUT-${String(idx + 1).padStart(3, "0")}`;
                  const sub = outlet.subscription;
                  const isSubActive = sub?.status === "ACTIVE";
                  const isExpired = sub?.status === "EXPIRED" || (sub?.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date());
                  const daysLeft = calculateDaysRemaining(sub?.currentPeriodEnd);
                  const isCurrent = activeBranch?.id === outlet.id;
                  const isFocused = focusId === outlet.id;
                  const needsPayment = !isSubActive || isExpired;

                  return (
                    <div
                      className="relative flex w-44 flex-col items-center text-center"
                      onMouseEnter={() => setHoveredNodeId(outlet.id)}
                      onMouseLeave={() => setHoveredNodeId(null)}
                    >
                      {isHead && (
                        <span className="absolute -top-7 rounded-md bg-red-50 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#D3232A] border border-red-100">
                          HEAD OFFICE
                        </span>
                      )}
                      <div className="relative">
                      <span className={`pointer-events-none absolute -inset-4 rounded-full border ${needsPayment ? "border-amber-300/70" : "border-red-200/60"}`} />
                      <span className={`pointer-events-none absolute -inset-8 rounded-full border ${needsPayment ? "border-amber-200/70" : "border-red-100/60"}`} />
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId((cur) => (cur === outlet.id ? null : outlet.id))}
                        className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg transition-all cursor-pointer ${
                          needsPayment
                            ? `text-amber-600 shadow-amber-100 ${isFocused ? "ring-4 ring-amber-100 border-2 border-amber-300" : "border border-amber-200 hover:ring-4 hover:ring-amber-50"}`
                            : `text-[#D3232A] shadow-red-100 ${isFocused ? "ring-4 ring-red-100 border-2 border-red-200" : "border border-red-100 hover:ring-4 hover:ring-red-50"}`
                        }`}
                      >
                        <Store className="h-7 w-7" />
                        <span
                          className={`absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-white ${
                            needsPayment ? "bg-amber-400" : isCurrent ? "bg-emerald-500" : "bg-gray-300"
                          }`}
                        />
                      </button>
                      </div>
                      <p className="mt-6 max-w-full truncate text-sm font-bold text-gray-900">{outlet.name}</p>
                      <p className="font-mono text-[10px] font-bold text-gray-400">{ledgerId}</p>
                      <p className="max-w-full truncate text-[11px] text-gray-400 font-medium">
                        {outlet.city}, {outlet.state || "United Kingdom"}
                      </p>

                      {isFocused && (
                        <div
                          className={`absolute top-10 -translate-y-1/2 z-30 w-72 rounded-2xl border border-gray-100 bg-white p-4 text-left shadow-xl ${
                            popoverSide === "right"
                              ? "left-full ml-3 before:absolute before:inset-y-0 before:-left-3 before:w-3"
                              : "right-full mr-3 before:absolute before:inset-y-0 before:-right-3 before:w-3"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{outlet.name}</h3>
                            {isHead && (
                              <span className="shrink-0 rounded-md bg-red-50 px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#D3232A] border border-red-100">
                                HEAD OFFICE
                              </span>
                            )}
                          </div>
                          <dl className="space-y-2 text-[11px]">
                            <div className="flex gap-2">
                              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-gray-400"><Hash className="h-3 w-3" />Branch ID</dt>
                              <dd className="font-semibold text-gray-700">{ledgerId}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-gray-400"><MapPin className="h-3 w-3" />Location</dt>
                              <dd className="font-semibold text-gray-700">{outlet.address}, {outlet.city}, {outlet.state || "United Kingdom"}</dd>
                            </div>
                            <div className="flex items-center gap-2">
                              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-gray-400"><CreditCard className="h-3 w-3" />Subscription</dt>
                              <dd>
                                {isSubActive && !isExpired ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                    Active · {daysLeft}d left
                                  </span>
                                ) : isExpired ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                                    <AlertTriangle className="h-3 w-3" />Expired
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                    <Sparkles className="h-3 w-3" />Pending Activation
                                  </span>
                                )}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-gray-400"><Receipt className="h-3 w-3" />Plan</dt>
                              <dd className="font-bold text-gray-900">£79/mo <span className="font-medium text-gray-400">Pro Tier, VAT incl.</span></dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="flex w-20 shrink-0 items-center gap-1.5 text-gray-400"><Calendar className="h-3 w-3" />Valid till</dt>
                              <dd className="font-semibold text-gray-700">
                                {sub?.currentPeriodEnd
                                  ? new Date(sub.currentPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                                  : "Not activated"}
                              </dd>
                            </div>
                          </dl>

                          <div className="mt-4 flex items-center justify-between gap-2">
                            <button
                              onClick={() => setSelectedOutletForRenew(outlet)}
                              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold transition-all cursor-pointer ${
                                needsPayment
                                  ? "bg-[#D3232A] text-white hover:bg-[#b01e23]"
                                  : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                              }`}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                              {!isSubActive ? "Pay Subscription" : isExpired ? "Renew Subscription" : "Extend Plan"}
                            </button>
                            {!isSubActive && !isExpired && (
                              <button
                                type="button"
                                title="Delete unpaid draft branch"
                                disabled={isDeletingOutlet}
                                onClick={async () => {
                                  if (confirm(`Are you sure you want to delete the unpaid draft branch "${outlet.name}"?`)) {
                                    try {
                                      await deleteOutlet(outlet.id).unwrap();
                                      await refreshBranches();
                                      refetch();
                                    } catch (err: any) {
                                      alert(err?.data?.message || err?.message || "Failed to delete outlet");
                                    }
                                  }
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-[#D3232A] transition-colors cursor-pointer"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {isCurrent ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                                <CheckCircle2 className="h-3.5 w-3.5" />Active
                              </span>
                            ) : isSubActive && !isExpired ? (
                              <button
                                onClick={() => setActiveBranch(outlet)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#D3232A] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                Manage Outlet <ArrowRight className="h-3 w-3" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    <div className="overflow-auto bg-[radial-gradient(circle_at_0%_50%,rgba(211,35,42,0.08),transparent_45%),radial-gradient(#cbd5e1_1.2px,transparent_1.2px)] [background-size:100%_100%,20px_20px] min-h-[400px] px-8 py-12 flex">
                      {(() => {
                        // Head office on the left, branches in a row to the right (two rows past 5 outlets),
                        // so the map grows sideways instead of down. Circle centres sit 40px below each cell top.
                        const CELL_H = 160;
                        const GAP_Y = 40;
                        const total = branchOutlets.length;
                        const rows = total > 5 ? 2 : 1;
                        const columns = Math.ceil(total / rows);
                        const headOffset = ((rows - 1) * (CELL_H + GAP_Y)) / 2;
                        return (
                          <div
                            className="m-auto flex w-max shrink-0 items-start transition-transform origin-left"
                            style={{ transform: `scale(${zoom})` }}
                          >
                            <div className="flex items-start" style={{ marginTop: headOffset }}>
                              {renderNode(headOutlet, true, "right")}
                              <div className="mt-10 h-0 w-6 shrink-0 border-t-2 border-dotted border-gray-300" />
                            </div>

                            {total === 0 ? (
                              <Link
                                href="/outlets/create"
                                className="group flex w-44 flex-col items-center text-center"
                              >
                                <span className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-white/60 text-slate-500 transition-colors group-hover:border-[#D3232A] group-hover:bg-white group-hover:text-[#D3232A]">
                                  <Plus className="h-6 w-6" />
                                </span>
                                <span className="mt-6 text-xs font-bold text-slate-700 group-hover:text-[#D3232A]">Add another branch</span>
                                <span className="text-[11px] font-medium text-slate-500">Expand your outlet network</span>
                              </Link>
                            ) : (
                              <div className="relative pl-10">
                                {rows > 1 && (
                                  <div
                                    className="absolute left-0 top-10 border-l-2 border-dotted border-gray-300"
                                    style={{ height: CELL_H + GAP_Y }}
                                  />
                                )}
                                <div
                                  className="grid grid-flow-col"
                                  style={{ gridTemplateRows: `repeat(${rows}, ${CELL_H}px)`, rowGap: GAP_Y }}
                                >
                                  {branchOutlets.map((outlet: any, i: number) => {
                                    const col = Math.floor(i / rows);
                                    const isLastInRow = i + rows >= total;
                                    return (
                                      <div key={outlet.id} className="relative">
                                        <div
                                          className="absolute top-10 border-t-2 border-dotted border-gray-300"
                                          style={{
                                            left: col === 0 ? "-2.5rem" : 0,
                                            width: col === 0 ? "calc(2.5rem + 50% - 48px)" : "calc(50% - 48px)",
                                          }}
                                        />
                                        {!isLastInRow && (
                                          <div
                                            className="absolute right-0 top-10 border-t-2 border-dotted border-gray-300"
                                            style={{ width: "calc(50% - 48px)" }}
                                          />
                                        )}
                                        {renderNode(outlet, false, columns > 1 && col === columns - 1 ? "left" : "right")}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Legend & zoom controls */}
                    <div className="flex items-center justify-between gap-4 border-t border-gray-100 bg-white px-5 py-3 text-[11px] font-medium text-gray-500">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Active branch</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Needs payment</span>
                        <span className="hidden sm:inline">Dotted line = branch connection</span>
                      </div>
                      <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-1 py-0.5">
                        <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                        <span className="w-10 text-center font-bold text-gray-700">{Math.round(zoom * 100)}%</span>
                        <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.4, +(z + 0.1).toFixed(1)))} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"><Plus className="h-3.5 w-3.5" /></button>
                        <button type="button" aria-label="Reset zoom" onClick={() => setZoom(1)} className="p-1.5 hover:bg-gray-100 rounded-lg cursor-pointer"><Maximize2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>

        {/* Cashfree Payment & Renewal Modal */}
        <SubscriptionRenewModal
          isOpen={!!selectedOutletForRenew}
          onClose={() => setSelectedOutletForRenew(null)}
          outlet={selectedOutletForRenew}
          onSuccess={() => {
            refetch();
            refreshBranches();
          }}
        />
      </DashboardLayout>
    </AuthGuard>
  );
}
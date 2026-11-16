"use client";

import React, { useState } from "react";
import {
  Store,
  Lock,
  ShieldCheck,
  Check,
  Loader2,
  ArrowRight,
  ChevronRight,
  Tag,
} from "lucide-react";
import { useBranch, Branch } from "@/lib/BranchContext";
import { 
  useInitiateOutletSubscriptionMutation, 
  useVerifyOutletPaymentMutation,
  useApplyCouponMutation
} from "@/redux/slices/subscriptionApiSlice";
import { openCashfreeCheckout } from "@/lib/cashfree";
import Link from "next/link";
import SubscriptionMonthSelector, { calculateSubscriptionPricing, formatGBP } from "./SubscriptionMonthSelector";

interface SubscriptionPaywallProps {
  targetBranch?: Branch | null;
}

export default function SubscriptionPaywall({ targetBranch }: SubscriptionPaywallProps) {
  const { branches, activeBranch, refreshBranches, setActiveBranch } = useBranch();
  const [initiateSubscription, { isLoading: isInitiating }] = useInitiateOutletSubscriptionMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyOutletPaymentMutation();
  const [applyCoupon, { isLoading: isApplyingCoupon }] = useApplyCouponMutation();

  const [months, setMonths] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState("");
  const [couponSuccess, setCouponSuccess] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: string;
    discountValue: number;
    message?: string;
  } | null>(null);

  // Determine which outlet to pay for
  // If targetBranch is provided, use that; otherwise activeBranch; otherwise first branch in list
  const branchToPay = targetBranch || (activeBranch?.id !== "all" ? activeBranch : null) || branches.find(b => b.id !== "all") || null;

  const hasOutlets = branches.filter(b => b.id !== "all").length > 0;
  const pricing = calculateSubscriptionPricing(months, undefined, undefined, appliedCoupon);

  const handlePayNow = async () => {
    if (!branchToPay) return;
    setErrorMessage("");
    setIsProcessing(true);

    try {
      const res = await initiateSubscription({
        outletId: branchToPay.id,
        planCode: "MONTHLY_STANDARD",
        months,
        couponCode: appliedCoupon?.code,
      }).unwrap();

      const { paymentSessionId, orderId } = res;

      // A coupon covering the whole amount is activated by the server with no gateway payment
      if (!paymentSessionId && !res.paidWithoutGateway) {
        throw new Error("Could not initialize Cashfree payment session.");
      }

      await openCashfreeCheckout({
        paymentSessionId,
        mode: process.env.NEXT_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox",
        onSuccess: async () => {
          try {
            await verifyPayment({ orderId }).unwrap();
            await refreshBranches();
            setActiveBranch(branchToPay);
          } catch (err) {
            console.error("Verification error:", err);
            await refreshBranches();
            setActiveBranch(branchToPay);
          } finally {
            setIsProcessing(false);
          }
        },
        onFailure: (err) => {
          console.warn("Payment dismissed or failed:", err);
          setErrorMessage(err?.message || "Payment was cancelled or could not be completed.");
          setIsProcessing(false);
        },
      });
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      const msg =
        err?.data?.error?.message ||
        err?.data?.message ||
        (typeof err?.data?.error === "string" ? err?.data?.error : null) ||
        err?.message ||
        "Failed to initiate payment. Please try again.";
      setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
      setIsProcessing(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!branchToPay) return;
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) return;
    setCouponError("");
    setCouponSuccess(false);

    try {
      const res = await applyCoupon({
        couponCode: cleanCode,
        outletId: branchToPay.id,
      }).unwrap();

      if ((res.discountValue ?? 0) >= 100 || (res.businessSubscription && !res.applied)) {
        setCouponSuccess(true);
        await refreshBranches();
        setActiveBranch(branchToPay);
      } else {
        setAppliedCoupon({
          code: cleanCode,
          discountType: res.discountType || "PERCENTAGE",
          discountValue: res.discountValue || 0,
          message: res.message,
        });
        setCouponSuccess(true);
      }
    } catch (err: any) {
      const msg =
        err?.data?.error?.message ||
        err?.data?.message ||
        (typeof err?.data?.error === "string" ? err?.data?.error : null) ||
        err?.message ||
        "Invalid coupon code. Please check and try again.";
      setCouponError(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponSuccess(false);
    setCouponError("");
  };

  // State A: User has NO outlets registered at all
  if (!hasOutlets) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-xl border border-gray-100 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-[#D3232A] mb-6 shadow-xs">
            <Store className="h-8 w-8" />
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-[#D3232A] mb-3">
            <Lock className="h-3.5 w-3.5" />
            No Outlets Registered
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 font-serif mb-3">
            Register Your Restaurant Outlet
          </h1>
          <p className="text-sm text-zinc-500 max-w-md font-medium leading-relaxed mb-8">
            To start using Alayn POS, kitchen displays, inventory telemetry, and live analytics, register your physical restaurant branch and activate your subscription.
          </p>
          <Link
            href="/outlets/create"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#D3232A] px-7 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-[#b01e23] transition-all hover:-translate-y-[1px]"
          >
            Register Outlet & Subscribe
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  // State B: User has registered outlet(s), but the active/selected one requires payment
  const isExpired = branchToPay?.subscription?.status === "EXPIRED";
  const isBusy = isProcessing || isInitiating || isVerifying;
  const branchAddress = [branchToPay?.address, branchToPay?.city].filter(Boolean).join(", ");

  const unlockedFeatures = [
    "Unlimited POS terminals and table QR",
    "Live kitchen display (KDS)",
    "Multi-batch inventory and expiry tracking",
    "AI menu and wastage insights",
    "Geofenced staff attendance and rostering",
    "Sales velocity and P&L analytics",
  ];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:py-6">
      <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* Context panel */}
        <aside className="flex flex-col bg-[#0B1221] p-6 text-white lg:p-8">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-200">
            <Lock className="h-3 w-3" />
            Subscription required
          </span>

          <h1 className="mt-4 text-2xl font-semibold tracking-tight">
            {isExpired ? "Renew branch subscription" : "Activate branch subscription"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Unlock POS billing, kitchen display and inventory for this outlet.
          </p>

          {branchToPay && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{branchToPay.name}</p>
                {branchAddress && <p className="truncate text-xs text-slate-400">{branchAddress}</p>}
              </div>
              <span
                className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  isExpired ? "bg-red-500/15 text-red-300" : "bg-amber-400/15 text-amber-300"
                }`}
              >
                {isExpired ? "Expired" : "Pending"}
              </span>
            </div>
          )}

          <ul className="mt-5 space-y-2.5">
            {unlockedFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-snug text-slate-300">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/outlets"
            className="mt-6 inline-flex w-fit items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-white lg:mt-auto lg:pt-6"
          >
            Manage all outlets
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </aside>

        {/* Checkout panel */}
        <section className="flex flex-col gap-4 p-6 lg:p-8">
          {errorMessage && (
            <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-[#D3232A]">
              {errorMessage}
            </div>
          )}

          <SubscriptionMonthSelector
            months={months}
            onChange={setMonths}
            currentPeriodEnd={branchToPay?.subscription?.currentPeriodEnd}
            disabled={isBusy || isApplyingCoupon}
            coupon={appliedCoupon}
          />

          {/* Coupon */}
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-emerald-800">
                <Tag className="h-3.5 w-3.5" />
                <span className="font-mono font-semibold uppercase tracking-wider">{appliedCoupon.code}</span>
                <span className="font-medium">
                  {appliedCoupon.discountType === "PERCENTAGE"
                    ? `${appliedCoupon.discountValue}% off`
                    : `£${appliedCoupon.discountValue} off`}
                </span>
              </div>
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="cursor-pointer text-xs font-medium text-emerald-800 underline-offset-2 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : showCoupon ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value.toUpperCase());
                    setCouponError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleApplyCoupon();
                  }}
                  placeholder="Promo code"
                  aria-label="Promo code"
                  autoFocus
                  className="block h-10 flex-1 rounded-lg border-0 bg-white px-3 font-mono text-xs font-semibold uppercase tracking-wider text-zinc-900 ring-1 ring-inset ring-slate-300 placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:ring-2 focus:ring-[#D3232A]"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  disabled={isApplyingCoupon || !couponInput.trim()}
                  className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-xs font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isApplyingCoupon && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Apply
                </button>
              </div>
              {couponError && <p role="alert" className="text-xs font-medium text-[#D3232A]">{couponError}</p>}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCoupon(true)}
              className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline"
            >
              <Tag className="h-3.5 w-3.5" />
              Have a promo code?
            </button>
          )}

          {/* Pay */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handlePayNow}
              disabled={isBusy || !branchToPay}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#D3232A] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#b01e23] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D3232A] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isBusy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting to Cashfree
                </>
              ) : (
                <>
                  Pay {formatGBP(pricing.grandTotal)}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Secure checkout via Cashfree. UPI, cards and netbanking.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

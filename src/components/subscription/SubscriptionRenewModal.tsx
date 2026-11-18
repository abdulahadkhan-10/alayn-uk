"use client";

import React, { useState } from "react";
import { useModalTransition } from "@/components/ui/TModal";
import {
  X,
  Check,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Building2,
  Calendar,
  Lock,
  ArrowRight,
  Tag,
} from "lucide-react";
import { 
  useInitiateOutletSubscriptionMutation, 
  useVerifyOutletPaymentMutation,
  useApplyCouponMutation
} from "@/redux/slices/subscriptionApiSlice";
import { openCashfreeCheckout } from "@/lib/cashfree";
import SubscriptionMonthSelector, { 
  calculateSubscriptionPricing, 
  calculateProjectedEndDate,
  formatGBP
} from "./SubscriptionMonthSelector";

interface SubscriptionRenewModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlet: {
    id: string;
    name: string;
    address?: string;
    city?: string;
    subscription?: {
      status?: string;
      currentPeriodEnd?: string;
      monthlyFeePence?: number;
    };
  } | null;
  onSuccess?: () => void;
}

export default function SubscriptionRenewModal({
  isOpen,
  onClose,
  outlet,
  onSuccess,
}: SubscriptionRenewModalProps) {
  const [initiateSubscription, { isLoading: isInitiating }] = useInitiateOutletSubscriptionMutation();
  const [verifyPayment, { isLoading: isVerifying }] = useVerifyOutletPaymentMutation();
  const [applyCoupon, { isLoading: isApplyingCoupon }] = useApplyCouponMutation();

  const [months, setMonths] = useState<number>(1);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
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
  const [paymentStep, setPaymentStep] = useState<"review" | "processing" | "success">("review");

  const { mounted, stateClass } = useModalTransition(isOpen);

  if (!mounted || !outlet) return null;

  const pricing = calculateSubscriptionPricing(months, undefined, undefined, appliedCoupon);
  const projectedEnd = calculateProjectedEndDate(months, outlet.subscription?.currentPeriodEnd);
  const now = new Date();
  const existingEnd = outlet.subscription?.currentPeriodEnd ? new Date(outlet.subscription.currentPeriodEnd) : null;
  const effectiveStartDate = existingEnd && existingEnd > now ? existingEnd : now;
  const daysDiff = Math.max(1, Math.round((projectedEnd.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)));
  const formattedEndDate = projectedEnd.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const handlePayNow = async () => {
    setErrorMessage("");
    setPaymentStep("processing");

    try {
      // 1. Initiate order on backend with selected duration in months and dynamic coupon
      const res = await initiateSubscription({
        outletId: outlet.id,
        planCode: "MONTHLY_STANDARD",
        months,
        couponCode: appliedCoupon?.code,
      }).unwrap();

      const { paymentSessionId, orderId } = res;

      // A coupon covering the whole amount is activated by the server with no gateway payment
      if (!paymentSessionId && !res.paidWithoutGateway) {
        throw new Error("Could not initialize Cashfree payment session.");
      }

      // 2. Open Cashfree Drop-in Checkout Modal
      await openCashfreeCheckout({
        paymentSessionId,
        mode: process.env.NEXT_PUBLIC_CASHFREE_MODE === "production" ? "production" : "sandbox",
        onSuccess: async () => {
          try {
            // 3. Fast-track server-side verification
            await verifyPayment({ orderId }).unwrap();
            setPaymentSuccess(true);
            setPaymentStep("success");
            if (onSuccess) onSuccess();
          } catch (err: any) {
            console.error("Verification error:", err);
            // Even if client call errors, Webhook guarantees activation; show success state
            setPaymentSuccess(true);
            setPaymentStep("success");
            if (onSuccess) onSuccess();
          }
        },
        onFailure: (err) => {
          console.warn("Cashfree payment dismissed or failed:", err);
          setErrorMessage(err?.message || "Payment was cancelled or could not be completed.");
          setPaymentStep("review");
        },
      });
    } catch (err: any) {
      console.error("Subscription initiation error:", err);
      const msg =
        err?.data?.error?.message ||
        err?.data?.message ||
        (typeof err?.data?.error === "string" ? err?.data?.error : null) ||
        err?.message ||
        "Failed to initiate payment. Please try again.";
      setErrorMessage(typeof msg === "string" ? msg : JSON.stringify(msg));
      setPaymentStep("review");
    }
  };

  const handleApplyCoupon = async () => {
    if (!outlet?.id) return;
    const cleanCode = couponInput.trim().toUpperCase();
    if (!cleanCode) return;
    setCouponError("");
    setCouponSuccess(false);

    try {
      const res = await applyCoupon({
        couponCode: cleanCode,
        outletId: outlet.id,
      }).unwrap();

      if ((res.discountValue ?? 0) >= 100 || (res.businessSubscription && !res.applied)) {
        // 100% Free VIP activation
        setCouponSuccess(true);
        setPaymentStep("success");
        onSuccess?.();
      } else {
        // Partial discount coupon applied
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

  const isSubActive = outlet.subscription?.status === "ACTIVE";
  const expiryDate = outlet.subscription?.currentPeriodEnd 
    ? new Date(outlet.subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    : null;

  const isBusy = paymentStep === "processing" || isInitiating || isVerifying;
  const locationLabel = outlet.city || outlet.address || "Physical location";

  const includedFeatures = [
    "Unlimited POS counters",
    "Live kitchen display (KDS)",
    "Multi-batch inventory",
    "AI menu costing assistant",
    "Staff geofence attendance",
    "24/7 priority support",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4">
      {/* Backdrop */}
      <div
        className={`t-modal-backdrop ${stateClass} fixed inset-0 bg-black/60 backdrop-blur-xs`}
        onClick={paymentStep === "processing" ? undefined : onClose}
      />

      {/* Modal Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isSubActive ? "Extend subscription" : "Activate subscription"}
        className={`t-modal ${stateClass} relative z-10 w-full ${
          paymentStep === "success" ? "max-w-md" : "max-w-3xl"
        } overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <button
          onClick={onClose}
          disabled={paymentStep === "processing"}
          aria-label="Close"
          className={`absolute right-3 top-3 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            paymentStep === "success"
              ? "bg-slate-100 text-slate-500 hover:bg-slate-200"
              : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white lg:bg-slate-100 lg:text-slate-500 lg:hover:bg-slate-200 lg:hover:text-slate-700"
          }`}
        >
          <X className="h-4 w-4" />
        </button>

        {paymentStep === "success" ? (
          <div className="space-y-4 p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900">Payment confirmed</h3>
            <p className="mx-auto max-w-sm text-sm leading-relaxed text-zinc-600">
              <strong className="font-semibold text-zinc-900">{outlet.name}</strong> is active for {months}{" "}
              {months === 1 ? "month" : "months"} ({daysDiff} days), valid until{" "}
              <strong className="font-semibold text-zinc-900">{formattedEndDate}</strong>.
            </p>
            <button
              onClick={onClose}
              className="h-11 w-full cursor-pointer rounded-xl bg-[#D3232A] text-sm font-semibold text-white transition-colors hover:bg-[#b01e23]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* Context panel */}
            <aside className="bg-[#0B1221] p-6 text-white">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-2 py-1 text-[11px] font-medium text-slate-200">
                {isSubActive ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Lock className="h-3 w-3" />}
                {isSubActive ? "Active branch" : "Subscription required"}
              </span>

              <h2 className="mt-3 text-xl font-semibold tracking-tight">
                {isSubActive ? "Extend subscription" : "Activate subscription"}
              </h2>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-200">
                  <Building2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{outlet.name}</p>
                  <p className="truncate text-xs text-slate-400">{locationLabel}</p>
                </div>
              </div>
              {expiryDate && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
                  <Calendar className="h-3 w-3 text-emerald-400" />
                  Valid till <span className="font-medium text-slate-200">{expiryDate}</span>
                </p>
              )}

              <ul className="mt-4 space-y-2">
                {includedFeatures.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-[13px] text-slate-300">
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" strokeWidth={2.5} />
                    {feature}
                  </li>
                ))}
              </ul>
            </aside>

            {/* Checkout panel */}
            <section className="flex flex-col gap-4 p-6">
              {errorMessage && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-[#D3232A]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <SubscriptionMonthSelector
                months={months}
                onChange={setMonths}
                currentPeriodEnd={outlet.subscription?.currentPeriodEnd}
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
                  onClick={handlePayNow}
                  disabled={isBusy}
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
        )}
      </div>
    </div>
  );
}

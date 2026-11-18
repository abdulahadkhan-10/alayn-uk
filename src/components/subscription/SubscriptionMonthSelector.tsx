"use client";

import React from "react";
import { CalendarCheck, Check, Tag } from "lucide-react";

interface SubscriptionMonthSelectorProps {
  months: number;
  onChange: (months: number) => void;
  baseMonthlyFee?: number; // default 79 (GBP, VAT included)
  yearlyFee?: number; // default 600 (GBP, VAT included)
  vatRatePercent?: number; // UK VAT, default 20
  currentPeriodEnd?: string | null;
  disabled?: boolean;
  coupon?: {
    code: string;
    discountType: string;
    discountValue: number;
  } | null;
}

// Listed prices already include VAT
export const MONTHLY_FEE_GBP = 79;
export const YEARLY_FEE_GBP = 600;
export const VAT_RATE_PERCENT = 20;

export const formatGBP = (amount: number) =>
  `£${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const BILLING_OPTIONS = [
  { months: 1, label: "Monthly", subtitle: "Billed every month" },
  { months: 12, label: "Yearly", subtitle: "Billed once a year", badge: "Best value" },
];

// Each full 12 months is billed at the yearly rate; any remaining months at the monthly rate.
// Fees are VAT-inclusive, so VAT is the portion contained in the amount payable.
export function calculateSubscriptionPricing(
  months: number,
  baseMonthlyFee: number = MONTHLY_FEE_GBP,
  vatRatePercent: number = VAT_RATE_PERCENT,
  coupon?: { discountType: string; discountValue: number } | null,
  yearlyFee: number = YEARLY_FEE_GBP
) {
  const safeMonths = Math.max(1, Math.min(36, months || 1));
  const rawBaseTotal = Math.floor(safeMonths / 12) * yearlyFee + (safeMonths % 12) * baseMonthlyFee;
  let discountPounds = 0;
  if (coupon) {
    if (coupon.discountType === "PERCENTAGE") {
      discountPounds = Math.round(((rawBaseTotal * coupon.discountValue) / 100) * 100) / 100;
    } else {
      discountPounds = Math.min(rawBaseTotal, coupon.discountValue);
    }
  }
  const grandTotal = Math.round(Math.max(0, rawBaseTotal - discountPounds) * 100) / 100;
  const vatTotal = Math.round((grandTotal - grandTotal / (1 + vatRatePercent / 100)) * 100) / 100;
  const baseTotal = Math.round((grandTotal - vatTotal) * 100) / 100;

  return {
    months: safeMonths,
    rawBaseTotal,
    discountPounds,
    baseTotal,
    vatTotal,
    grandTotal,
    baseTotalPence: Math.round(baseTotal * 100),
    vatTotalPence: Math.round(vatTotal * 100),
    grandTotalPence: Math.round(grandTotal * 100),
  };
}

export function addCalendarMonths(startDate: Date, months: number): Date {
  const result = new Date(startDate.getTime());
  const originalDate = result.getDate();
  result.setMonth(result.getMonth() + months);
  // Handle month-end boundary conditions (e.g., Jan 31 + 1 month -> Feb 28/29)
  if (result.getDate() !== originalDate) {
    result.setDate(0);
  }
  return result;
}

export function calculateProjectedEndDate(months: number, currentPeriodEnd?: string | null): Date {
  const safeMonths = Math.max(1, Math.min(36, months || 1));
  const now = new Date();
  const existingEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const startDate = existingEnd && existingEnd > now ? existingEnd : now;

  return addCalendarMonths(startDate, safeMonths);
}

export default function SubscriptionMonthSelector({
  months,
  onChange,
  baseMonthlyFee = MONTHLY_FEE_GBP,
  yearlyFee = YEARLY_FEE_GBP,
  vatRatePercent = VAT_RATE_PERCENT,
  currentPeriodEnd,
  disabled = false,
  coupon = null,
}: SubscriptionMonthSelectorProps) {
  const pricing = calculateSubscriptionPricing(months, baseMonthlyFee, vatRatePercent, coupon, yearlyFee);
  const projectedEnd = calculateProjectedEndDate(months, currentPeriodEnd);

  const handlePresetSelect = (m: number) => {
    if (disabled) return;
    onChange(m);
  };

  const now = new Date();
  const existingEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;
  const effectiveStartDate = existingEnd && existingEnd > now ? existingEnd : now;
  const daysDiff = Math.max(1, Math.round((projectedEnd.getTime() - effectiveStartDate.getTime()) / (1000 * 60 * 60 * 24)));

  const formattedEndDate = projectedEnd.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isExtending = currentPeriodEnd && new Date(currentPeriodEnd) > new Date();
  const termLabel = months === 12 ? "1 year" : `${months} ${months === 1 ? "month" : "months"}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Billing cycle</span>
        <span className="text-[11px] font-medium text-zinc-500">All prices include VAT</span>
      </div>

      {/* Monthly / Yearly toggle */}
      <div role="radiogroup" aria-label="Billing cycle" className="grid grid-cols-2 gap-2.5">
        {BILLING_OPTIONS.map((option) => {
          const isSelected = months === option.months;
          const price = option.months === 12 ? yearlyFee : baseMonthlyFee;
          const savings = option.months === 12 ? baseMonthlyFee * 12 - yearlyFee : 0;
          return (
            <button
              key={option.months}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => handlePresetSelect(option.months)}
              className={`flex min-h-[84px] flex-col rounded-xl border px-3.5 py-3 text-left transition-colors duration-150 cursor-pointer select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D3232A] ${
                isSelected
                  ? "border-[#D3232A] bg-red-50/50 ring-1 ring-[#D3232A]"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-zinc-900">{option.label}</span>
                  {option.badge && (
                    <span className="rounded bg-[#D3232A] px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-white">
                      {option.badge}
                    </span>
                  )}
                </span>
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    isSelected ? "border-[#D3232A] bg-[#D3232A] text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
              </span>
              <span className="mt-1.5 flex items-baseline gap-0.5 tabular-nums">
                <span className="text-2xl font-semibold leading-none tracking-tight text-zinc-900">£{price}</span>
                <span className="text-xs font-medium text-zinc-500">{option.months === 12 ? "/yr" : "/mo"}</span>
              </span>
              <span className="mt-1 text-[11px] font-medium text-zinc-500">
                {savings > 0 ? `Save £${savings} vs monthly` : option.subtitle}
              </span>
            </button>
          );
        })}
      </div>

      {/* Projected validity */}
      <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-zinc-600">
        <span className="flex items-center gap-2">
          <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <span>
            {isExtending ? "Extends service until" : "Active until"}{" "}
            <strong className="font-semibold text-zinc-900">{formattedEndDate}</strong>
          </span>
        </span>
        <span className="font-medium tabular-nums text-zinc-500">{daysDiff} days</span>
      </div>

      {/* Price summary */}
      <div className="space-y-1.5 border-t border-slate-200 pt-3">
        {pricing.discountPounds > 0 && coupon && (
          <>
            <div className="flex justify-between text-xs text-zinc-600">
              <span>Subscription ({termLabel})</span>
              <span className="tabular-nums">{formatGBP(pricing.rawBaseTotal)}</span>
            </div>
            <div className="flex justify-between text-xs font-medium text-emerald-700">
              <span className="flex items-center gap-1.5">
                <Tag className="h-3 w-3" />
                Coupon ({coupon.code})
              </span>
              <span className="tabular-nums">-{formatGBP(pricing.discountPounds)}</span>
            </div>
          </>
        )}
        <div className="flex items-end justify-between">
          <div>
            <span className="block text-sm font-semibold text-zinc-900">Total due today</span>
            <span className="block text-[11px] text-zinc-500">
              {termLabel}, includes {formatGBP(pricing.vatTotal)} VAT ({vatRatePercent}%)
            </span>
          </div>
          <span className="text-2xl font-semibold leading-none tracking-tight text-zinc-900 tabular-nums">
            {formatGBP(pricing.grandTotal)}
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { Banknote, Check, CreditCard, Plus, X } from "lucide-react";
import {
  MAX_SPLIT_PAYMENTS,
  PAYMENT_METHODS,
  PaymentMethodCode,
  SplitLine,
  formatPence,
  isOnlineMethod,
  newSplitLine,
  penceToInput,
  rebalanceAutoLine,
  poundsToPence,
  summarizeSplit,
} from "@/lib/splitPayment";

const METHOD_META: Record<PaymentMethodCode, { label: string; icon: React.ElementType }> = {
  CASH: { label: "Cash", icon: Banknote },
  CARD: { label: "Card", icon: CreditCard },
};

interface SplitPaymentEditorProps {
  /** Amount the payments must add up to, in pence */
  duePence: number;
  lines: SplitLine[];
  onChange: (lines: SplitLine[]) => void;
}

/** Start a split: the cashier types the first part, the second follows the remaining balance */
export function initialSplitLines(duePence: number, firstMethod: PaymentMethodCode = "CASH"): SplitLine[] {
  const second: PaymentMethodCode = firstMethod === "CARD" ? "CASH" : "CARD";
  return [newSplitLine(firstMethod), newSplitLine(second, duePence, true)];
}

export default function SplitPaymentEditor({ duePence, lines, onChange }: SplitPaymentEditorProps) {
  const summary = summarizeSplit(lines, duePence);

  // The bill can change while the modal is open (coupon, service charge) — keep the auto part in step
  useEffect(() => {
    const rebalanced = rebalanceAutoLine(lines, duePence);
    if (rebalanced !== lines) onChange(rebalanced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duePence]);

  const update = (key: string, patch: Partial<SplitLine>) => {
    onChange(rebalanceAutoLine(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)), duePence));
  };

  const addLine = () => {
    if (lines.length >= MAX_SPLIT_PAYMENTS) return;
    const used = new Set(lines.map((l) => l.method));
    const method = PAYMENT_METHODS.find((m) => !used.has(m)) || "CASH";
    // The new part takes over covering the remainder; parts already shown keep their amounts
    const fixed = lines.map((l) => ({ ...l, auto: false }));
    onChange(rebalanceAutoLine([...fixed, newSplitLine(method, undefined, true)], duePence));
  };

  const removeLine = (key: string) => {
    onChange(rebalanceAutoLine(lines.filter((l) => l.key !== key), duePence));
  };

  const allocatedPct = duePence > 0 ? Math.min(100, Math.round((summary.allocatedPence / duePence) * 100)) : 0;
  const remainingTone =
    summary.remainingPence === 0 ? "text-emerald-700" : summary.remainingPence > 0 ? "text-rose-600" : "text-amber-700";

  return (
    <div className="space-y-2.5">
      {lines.map((line, index) => {
        const amountPence = poundsToPence(line.amountText);
        const amountInvalid = line.amountText !== "" && (amountPence === null || amountPence <= 0);
        const online = isOnlineMethod(line.method);
        const canFill = summary.remainingPence > 0 && !line.auto;

        return (
          <div key={line.key} className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div role="group" aria-label={`Payment ${index + 1} method`} className="flex rounded-lg bg-slate-100 p-0.5 shrink-0">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = METHOD_META[m].icon;
                  const selected = line.method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update(line.key, { method: m, verified: false })}
                      className={`px-2 py-1.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer ${
                        selected ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${selected ? "text-emerald-400" : ""}`} />
                      {METHOD_META[m].label}
                    </button>
                  );
                })}
              </div>

              <div className="relative flex-1 min-w-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">£</span>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Payment ${index + 1} amount in pounds`}
                  aria-invalid={amountInvalid}
                  placeholder="0.00"
                  value={line.amountText}
                  onChange={(e) => update(line.key, { amountText: e.target.value, auto: false, verified: false })}
                  onBlur={() => {
                    // Show what will be charged: "185" → "185.00"
                    if (amountPence !== null && amountPence > 0) update(line.key, { amountText: penceToInput(amountPence) });
                  }}
                  className={`w-full pl-6 pr-2 py-2 text-sm font-bold tabular-nums text-right bg-white border rounded-lg text-slate-900 focus:outline-none transition ${
                    amountInvalid ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-slate-800"
                  }`}
                />
              </div>

              {lines.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remove payment ${index + 1}`}
                  onClick={() => removeLine(line.key)}
                  className="w-7 h-7 shrink-0 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {(canFill || line.auto) && (
              <div className="flex justify-end -mt-1">
                {line.auto ? (
                  <span className="text-[10px] font-medium text-slate-400">Auto-filled with the remaining balance</span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      update(line.key, {
                        amountText: penceToInput((amountPence || 0) + summary.remainingPence),
                        verified: false,
                      })
                    }
                    className="text-[11px] font-semibold text-slate-700 underline decoration-dotted underline-offset-2 hover:text-slate-950 cursor-pointer"
                  >
                    Add remaining {formatPence(summary.remainingPence)}
                  </button>
                )}
              </div>
            )}

            {/* Card money arrives outside the till: the cashier confirms it reached the account */}
            {online && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label={`${METHOD_META[line.method].label} reference`}
                  placeholder="Approval code (optional)"
                  value={line.reference}
                  maxLength={64}
                  onChange={(e) => update(line.key, { reference: e.target.value })}
                  className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-slate-800 transition placeholder:font-sans placeholder:text-slate-400"
                />
                <button
                  type="button"
                  aria-pressed={line.verified}
                  disabled={amountPence === null || amountPence <= 0}
                  onClick={() => update(line.key, { verified: !line.verified })}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    line.verified
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-amber-300 text-amber-800 hover:bg-amber-50"
                  }`}
                >
                  {line.verified ? <Check className="w-3.5 h-3.5" /> : null}
                  {line.verified ? "Received" : `Mark ${amountPence ? formatPence(amountPence) : ""} received`}
                </button>
              </div>
            )}

          </div>
        );
      })}

      {lines.length < MAX_SPLIT_PAYMENTS && (
        <button
          type="button"
          onClick={addLine}
          className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center justify-center gap-1 transition cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add payment method
        </button>
      )}

      {/* Allocation summary */}
      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2" aria-live="polite">
        <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${summary.remainingPence < 0 ? "bg-amber-500" : summary.remainingPence === 0 ? "bg-emerald-500" : "bg-slate-800"}`}
            style={{ width: `${summary.remainingPence < 0 ? 100 : allocatedPct}%` }}
          />
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Payable</span>
            <span className="text-xs font-bold tabular-nums text-slate-900">{formatPence(duePence)}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Allocated</span>
            <span className="text-xs font-bold tabular-nums text-slate-900">{formatPence(summary.allocatedPence)}</span>
          </div>
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {summary.remainingPence < 0 ? "Over by" : "Remaining"}
            </span>
            <span className={`text-xs font-bold tabular-nums ${remainingTone}`}>
              {summary.remainingPence === 0 ? "£0.00 ✓" : formatPence(Math.abs(summary.remainingPence))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

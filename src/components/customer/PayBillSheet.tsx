"use client";

import React, { useState } from "react";
import { Banknote, Check, CreditCard, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import BottomSheet from "./BottomSheet";
import { formatPounds, type BillPaymentMethod } from "./menuFormat";

interface PayBillSheetProps {
  open: boolean;
  onClose: () => void;
  amountDuePence: number;
  tableNumber?: number;
  orderNumber?: string;
  /** Resolves true once the restaurant has the request */
  onRequestBill: (method: BillPaymentMethod) => Promise<boolean>;
}

const OPTIONS: { value: BillPaymentMethod; title: string; detail: string; icon: React.ElementType }[] = [
  { value: "CARD", title: "Card", detail: "Pay at the counter", icon: CreditCard },
  { value: "CASH", title: "Cash", detail: "Pay at the counter", icon: Banknote },
];

/**
 * The diner is done: they pick how to pay the table's whole bill. Card and cash are both paid at the
 * counter, where they collect the printed bill from the cashier, who confirms the payment.
 */
export default function PayBillSheet(props: PayBillSheetProps) {
  const { open, onClose, amountDuePence, tableNumber, orderNumber, onRequestBill } = props;
  const options = OPTIONS;
  // Nothing is picked for them: tapping straight through must never tell the cashier how the diner will pay
  const [method, setMethod] = useState<BillPaymentMethod | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<BillPaymentMethod | null>(null);
  const chosen = options.some((o) => o.value === method) ? method : null;
  const where = tableNumber ? `Table ${tableNumber}` : `order ${orderNumber || ""}`.trim();

  const submit = async () => {
    if (sending || !chosen) return;
    setSending(true);
    try {
      if (await onRequestBill(chosen)) setSent(chosen);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title="Bill requested"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="h-12 w-full rounded-xl bg-(--espresso) text-[15px] font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#243556] active:scale-[0.98]"
          >
            Done
          </button>
        }
      >
        <div className="mt-2 flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#15803D] text-white">
            <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <p className="mt-5 text-[15px] leading-relaxed text-(--muted)">Now go to the counter and tell the cashier</p>
          <p className="mt-2 rounded-2xl bg-[#F4F5F8] px-5 py-3 font-heading text-xl font-bold text-(--espresso)">
            &ldquo;Bill for {where}, please&rdquo;
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-(--muted)">
            {`They'll print your bill for ${formatPounds(amountDuePence, { exact: true })} and take your ${sent === "CARD" ? "card" : "cash"} payment.`}
          </p>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Pay bill"
      description={`${tableNumber ? `Table ${tableNumber} · ` : ""}${formatPounds(amountDuePence, { exact: true })} including taxes`}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={sending || !chosen}
          aria-busy={sending}
          className={cn(
            "flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-(--amber) px-5 text-base font-semibold text-white",
            "transition-[transform,background-color] duration-150 ease-out hover:bg-[#A91A24] active:scale-[0.98]",
            sending ? "disabled:cursor-wait disabled:opacity-80" : "disabled:cursor-not-allowed disabled:bg-zinc-300",
            "disabled:active:scale-100",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--amber)"
          )}
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {sending ? "Sending…" : !chosen ? "Choose how you'll pay" : "Request bill"}
        </button>
      }
    >
      <div className="mt-4 space-y-5">
        <div role="radiogroup" aria-label="How would you like to pay?" className={cn("grid gap-2.5", "grid-cols-2")}>
          {options.map(({ value, title, detail, icon: Icon }) => {
            const checked = chosen === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={checked}
                onClick={() => setMethod(value)}
                className={cn(
                  "flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-[border-color,background-color]",
                  checked ? "border-(--espresso) bg-[#F4F5F8] ring-1 ring-(--espresso)" : "border-zinc-200 hover:border-zinc-300",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--espresso)"
                )}
              >
                <Icon className={cn("h-6 w-6", checked ? "text-(--espresso)" : "text-zinc-500")} aria-hidden="true" />
                <span className="text-[15px] font-semibold text-(--espresso)">{title}</span>
                <span className="text-[12px] leading-tight text-(--muted)">{detail}</span>
              </button>
            );
          })}
        </div>

        {!chosen ? null : (
          <p className="rounded-2xl bg-[#F4F5F8] px-4 py-3 text-[13px] leading-relaxed text-(--muted)">
            We&apos;ll let the staff know. Then go to the counter, ask for the bill for {where}, and pay by {chosen === "CARD" ? "card" : "cash"}. You&apos;ll get a printed bill.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

import { baseApi } from "../store/baseApi";
import { paramsToSearch, type ReportParams } from "@/lib/reportQuery";

// Shapes copied from alayn-backend src/modules/reports/aggregate.ts and report.service.ts.
// Money is integer pence throughout; format it only when showing it.

export type ReportChannel = "TABLE" | "QR" | "COUNTER" | "DELIVERY";

export interface ReportTotals {
  netSalesPence: number;
  orders: number;
  avgOrderPence: number;
  discountPence: number;
  taxPence: number;
  serviceChargePence: number;
  cancelledOrders: number;
  cancelledPence: number;
  wastePence: number;
  itemsSold: number;
}

export interface ReportFigures {
  netSalesPence: number;
  orders: number;
}

/** `key` is an identifier for the row only (categories use a lowercased name); show `label`. */
export interface ReportBreakdownRow {
  key: string;
  label: string;
  current: ReportFigures;
  previous: ReportFigures | null;
  changePct: number | null;
  sharePct: number;
}

export interface ReportItemRow {
  menuItemId: string;
  name: string;
  category: string;
  qty: number;
  salesPence: number;
  prevQty: number | null;
  prevSalesPence: number | null;
  changePct: number | null;
}

export interface ReportTrendBucket {
  label: string;
  start: string;
  netSalesPence: number;
  orders: number;
  wastePence: number;
}

export interface ReportData {
  period: { start: string; end: string; label: string };
  comparison: { start: string; end: string; label: string; compareLabel: string } | null;
  totals: {
    current: ReportTotals;
    previous: ReportTotals | null;
    changePct: Partial<Record<keyof ReportTotals, number | null>>;
  };
  trend: { granularity: "hour" | "day" | "week" | "month"; current: ReportTrendBucket[]; previous: ReportTrendBucket[] };
  channels: ReportBreakdownRow[];
  payments: ReportBreakdownRow[];
  categories: ReportBreakdownRow[];
  outlets: ReportBreakdownRow[];
  hours: ReportBreakdownRow[];
  weekdays: ReportBreakdownRow[];
  /** netSalesPence holds the waste cost and orders the number of entries */
  waste: ReportBreakdownRow[];
  items: ReportItemRow[];
  highlights: string[];
  notes: string[];
  scope: { outletNames: string[]; businessName: string };
}

/** Categories come per outlet, so one name can appear several times with different ids. */
export interface ReportOptions {
  outlets: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  channels: { key: ReportChannel; label: string }[];
  earliestSale: string | null;
}

/** Result of a test report email. `reason` says why nothing was sent: email isn't set up on the server, or sending failed. */
export interface TestReportEmailResult {
  sent: boolean;
  reason?: "not_configured" | "failed";
}

/** One emailed report schedule. `outletId: null` means every outlet. */
export interface ReportSchedule {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  enabled: boolean;
  recipients: string[];
  outletId: string | null;
}

// Shape copied from alayn-backend src/modules/reports/removals.ts
export interface RemovalTotals {
  removals: number;
  quantity: number;
  amountPence: number;
}

export interface RemovedItemsReport {
  period: { label: string };
  /** afterServed: the food went to the table and was then taken off the bill */
  totals: RemovalTotals & { afterServedRemovals: number; afterServedPence: number };
  byPerson: (RemovalTotals & { key: string; name: string; role: string })[];
  byReason: (RemovalTotals & { reason: string })[];
  rows: {
    id: string;
    at: string;
    orderNumber: string;
    tableNumber: number | null;
    outletName: string;
    itemName: string;
    quantity: number;
    amountPence: number;
    reason: string;
    itemStage: string;
    removedByName: string;
    removedByRole: string;
  }[];
  truncated: boolean;
}

/**
 * Several outlets need the "all" outlet header plus the chosen ids; one outlet is sent as the
 * header alone; none chosen leaves baseApi's current branch header in place.
 */
export function reportRequest(params: ReportParams): { query: string; outletHeader?: string } {
  const outlets = params.outlets ?? [];
  if (outlets.length > 1) return { query: paramsToSearch(params), outletHeader: "all" };
  const query = paramsToSearch({ ...params, outlets: undefined });
  return outlets.length === 1 ? { query, outletHeader: outlets[0] } : { query };
}

export const reportsApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getReport: builder.query<ReportData, ReportParams>({
      query: (params) => {
        const { query, outletHeader } = reportRequest(params);
        return {
          url: `/reports${query ? `?${query}` : ""}`,
          headers: outletHeader ? { "x-outlet-id": outletHeader } : undefined,
        };
      },
      transformResponse: (response: { data: ReportData }) => response.data,
    }),
    getRemovedItemsReport: builder.query<RemovedItemsReport, ReportParams>({
      query: (params) => {
        const { query, outletHeader } = reportRequest(params);
        return {
          url: `/reports/removed-items${query ? `?${query}` : ""}`,
          headers: outletHeader ? { "x-outlet-id": outletHeader } : undefined,
        };
      },
      transformResponse: (response: { data: RemovedItemsReport }) => response.data,
    }),
    getReportOptions: builder.query<ReportOptions, void>({
      query: () => ({ url: "/reports/options" }),
      transformResponse: (response: { data: ReportOptions }) => response.data,
    }),
    getReportSchedule: builder.query<ReportSchedule[], void>({
      query: () => ({ url: "/reports/schedule" }),
      transformResponse: (response: { data: ReportSchedule[] }) => response.data,
      providesTags: ["ReportSchedule"],
    }),
    saveReportSchedule: builder.mutation<ReportSchedule[], ReportSchedule>({
      query: (body) => ({ url: "/reports/schedule", method: "PUT", body }),
      transformResponse: (response: { data: ReportSchedule[] }) => response.data,
      invalidatesTags: ["ReportSchedule"],
    }),
    sendTestReportEmail: builder.mutation<TestReportEmailResult, { outletId: string | null }>({
      query: (body) => ({ url: "/reports/schedule/test", method: "POST", body }),
      transformResponse: (response: { data: TestReportEmailResult }) => response.data,
    }),
  }),
});

export const {
  useGetReportQuery,
  useGetReportOptionsQuery,
  useGetRemovedItemsReportQuery,
  useGetReportScheduleQuery,
  useSaveReportScheduleMutation,
  useSendTestReportEmailMutation,
} = reportsApiSlice;

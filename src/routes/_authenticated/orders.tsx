import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScrollText, Trash2, Download, Loader2, Filter, X, CalendarDays } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { PageBackground } from "@/components/PageBackground";
import { getOrdersFn, deleteOrderFn, updateOrderFn } from "@/lib/api.functions";
import { getStoredSession } from "@/lib/session";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { numberToIndianWords } from "@/lib/numberToWords";

type OrderItem = {
  particulars: string;
  pickRate: string;
  qty: string;
  ratePerMtr: string;
  amount: number;
};

type SavedOrder = {
  _id: string;
  invoiceNo: string;
  date: string;
  partyName: string;
  partyGstin?: string;
  hsnCode?: string;
  deliveryDate?: string;
  deliveryDay?: string;
  deliveryTime?: string;
  items?: OrderItem[];
  subtotal?: number;
  cgst?: string;
  sgst?: string;
  cgstAmt?: number;
  sgstAmt?: number;
  grandTotal: number;
  savedAt: string;
  actualDeliveryDate?: string;
  actualDeliveryDay?: string;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseYmd(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function todayYmd() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type DeliveryStatus = { label: string; tone: "pending" | "ontime" | "delayed" | "early" };

function deliveryStatus(o: SavedOrder): DeliveryStatus {
  if (!o.actualDeliveryDate) return { label: "Pending", tone: "pending" };
  const actual = parseYmd(o.actualDeliveryDate);
  const expected = o.deliveryDate ? parseYmd(o.deliveryDate) : null;
  if (!actual || !expected) return { label: "Delivered", tone: "ontime" };
  const a = actual.getTime();
  const e = expected.getTime();
  if (a === e) return { label: "Delivered – On Time", tone: "ontime" };
  if (a > e) return { label: "Delivered – Delayed", tone: "delayed" };
  return { label: "Delivered – Early", tone: "early" };
}

const statusClass: Record<DeliveryStatus["tone"], string> = {
  pending: "bg-muted text-muted-foreground",
  ontime: "bg-primary/15 text-primary",
  delayed: "bg-destructive/15 text-destructive",
  early: "bg-secondary text-secondary-foreground",
};

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Saved Orders — Sri Sakthi Vinayaka Tex" },
      { name: "description", content: "Browse saved orders and invoices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrdersPage,
});

function downloadOrderPdf(o: SavedOrder) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Sri Sakthi Vinayaka Tex", 40, 38);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "1/96 B, Pillayar Kovil Thottam, Pattakkaranpalayam, Seenapuram (Po), Perundurai - 638 057",
    40,
    55,
  );
  doc.text("Cell: 85310 29009  |  GSTIN: 33CIUPS1710B1ZG  |  State Code: 33", 40, 70);

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("TAX INVOICE", W / 2, 115, { align: "center" });

  // Meta
  let y = 140;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Invoice No: `, 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(`#${o.invoiceNo}`, 110, y);
  doc.setFont("helvetica", "bold");
  doc.text(`Date: `, 320, y);
  doc.setFont("helvetica", "normal");
  doc.text(o.date || "-", 360, y);

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.text(`Party: `, 40, y);
  doc.setFont("helvetica", "normal");
  doc.text(o.partyName || "-", 110, y);
  if (o.partyGstin) {
    doc.setFont("helvetica", "bold");
    doc.text(`GSTIN: `, 320, y);
    doc.setFont("helvetica", "normal");
    doc.text(o.partyGstin, 360, y);
  }

  y += 18;
  if (o.hsnCode) {
    doc.setFont("helvetica", "bold");
    doc.text(`HSN: `, 40, y);
    doc.setFont("helvetica", "normal");
    doc.text(o.hsnCode, 110, y);
  }
  if (o.deliveryDate) {
    doc.setFont("helvetica", "bold");
    doc.text(`Delivery: `, 320, y);
    doc.setFont("helvetica", "normal");
    const del = [o.deliveryDate, o.deliveryDay, o.deliveryTime].filter(Boolean).join(" · ");
    doc.text(del, 375, y);
  }

  // Items table
  const items = o.items ?? [];
  autoTable(doc, {
    startY: y + 16,
    head: [["Particulars", "Pick Rate", "Qty (Mtr)", "Rate/Mtr", "Amount (Rs.)"]],
    body:
      items.length > 0
        ? items.map((it) => [
            it.particulars || "-",
            it.pickRate || "-",
            it.qty || "-",
            it.ratePerMtr || "-",
            (it.amount ?? 0).toFixed(2),
          ])
        : [["No items", "", "", "", ""]],
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  // Totals
  // @ts-expect-error autotable lastAutoTable
  let ty = doc.lastAutoTable.finalY + 20;
  const rightX = W - 40;
  const labelX = W - 220;

  const line = (label: string, val: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, labelX, ty);
    doc.text(val, rightX, ty, { align: "right" });
    ty += 16;
  };

  if (o.subtotal !== undefined) line("Subtotal:", o.subtotal.toFixed(2));
  if (o.cgstAmt !== undefined) line(`CGST (${o.cgst}%):`, o.cgstAmt.toFixed(2));
  if (o.sgstAmt !== undefined) line(`SGST (${o.sgst}%):`, o.sgstAmt.toFixed(2));
  ty += 4;
  doc.setDrawColor(200);
  doc.line(labelX, ty - 8, rightX, ty - 8);
  line("Grand Total:", `Rs. ${o.grandTotal.toLocaleString("en-IN")}`, true);

  ty += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  const words = numberToIndianWords(o.grandTotal);
  const split = doc.splitTextToSize(`Amount in words: ${words}`, W - 80);
  doc.text(split, 40, ty);

  doc.save(`Invoice-${o.invoiceNo}-${o.partyName || "order"}.pdf`);
}

function OrdersPage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const session = getStoredSession();
      const orders = await getOrdersFn({ data: session });
      setOrders(
        orders.map((r): SavedOrder => ({
          _id: r._id,
          invoiceNo: r.invoice_no,
          date: r.invoice_date ?? "",
          partyName: r.party_name ?? "",
          partyGstin: r.party_gstin ?? undefined,
          hsnCode: r.hsn_code ?? undefined,
          deliveryDate: r.delivery_date ?? undefined,
          deliveryDay: r.delivery_day ?? undefined,
          deliveryTime: r.delivery_time ?? undefined,
          items: (r.items as OrderItem[]) ?? [],
          subtotal: r.subtotal ? Number(r.subtotal) : undefined,
          cgst: r.cgst ?? undefined,
          sgst: r.sgst ?? undefined,
          cgstAmt: r.cgst_amt ? Number(r.cgst_amt) : undefined,
          sgstAmt: r.sgst_amt ? Number(r.sgst_amt) : undefined,
          grandTotal: Number(r.grand_total),
          savedAt: r.created_at,
          actualDeliveryDate: r.actual_delivery_date ?? undefined,
          actualDeliveryDay: r.actual_delivery_day ?? undefined,
        })),
      );
    } catch (e) {
      console.error("Failed to load orders:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    await deleteOrderFn({ data: { id } });
    setOrders((prev) => prev.filter((o) => o._id !== id));
  };

  const markDelivered = async (id: string) => {
    const date = todayYmd();
    const day = DAY_NAMES[(parseYmd(date) as Date).getDay()];
    await updateOrderFn({
      data: { id, data: { actual_delivery_date: date, actual_delivery_day: day } },
    });
    setOrders((prev) =>
      prev.map((o) =>
        o._id === id ? { ...o, actualDeliveryDate: date, actualDeliveryDay: day } : o,
      ),
    );
  };

  type FilterType = "all" | "week" | "month" | "day" | "range";
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [pendingType, setPendingType] = useState<FilterType>("all");
  const [pendingDay, setPendingDay] = useState<string>("");
  const [pendingFrom, setPendingFrom] = useState<string>("");
  const [pendingTo, setPendingTo] = useState<string>("");
  const [appliedDay, setAppliedDay] = useState<string>("");
  const [appliedFrom, setAppliedFrom] = useState<string>("");
  const [appliedTo, setAppliedTo] = useState<string>("");

  const filteredOrders = useMemo(() => {
    if (filterType === "all") return orders;
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const endOfDay = (d: Date) => startOfDay(d) + 86400000 - 1;
    const parseDate = (s: string) => {
      // supports "YYYY-MM-DD" and ISO timestamps
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return new Date(s);
    };
    let from = -Infinity;
    let to = Infinity;
    if (filterType === "week") {
      // complete previous week (Mon–Sun)
      const dow = (now.getDay() + 6) % 7; // 0 = Monday
      const thisMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);
      const lastMonday = new Date(
        thisMonday.getFullYear(),
        thisMonday.getMonth(),
        thisMonday.getDate() - 7,
      );
      const lastSunday = new Date(
        thisMonday.getFullYear(),
        thisMonday.getMonth(),
        thisMonday.getDate() - 1,
      );
      from = startOfDay(lastMonday);
      to = endOfDay(lastSunday);
    } else if (filterType === "month") {
      // complete previous calendar month
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      from = startOfDay(first);
      to = endOfDay(last);
    } else if (filterType === "day" && appliedDay) {
      const d = parseDate(appliedDay);
      from = startOfDay(d);
      to = endOfDay(d);
    } else if (filterType === "range") {
      if (appliedFrom) from = startOfDay(parseDate(appliedFrom));
      if (appliedTo) to = endOfDay(parseDate(appliedTo));
    }
    return orders.filter((o) => {
      const src = o.date || o.savedAt;
      if (!src) return false;
      const t = parseDate(src).getTime();
      if (Number.isNaN(t)) return false;
      return t >= from && t <= to;
    });
  }, [orders, filterType, appliedDay, appliedFrom, appliedTo]);

  const applyFilter = () => {
    setFilterType(pendingType);
    setAppliedDay(pendingDay);
    setAppliedFrom(pendingFrom);
    setAppliedTo(pendingTo);
  };
  const clearFilter = () => {
    setPendingType("all");
    setPendingDay("");
    setPendingFrom("");
    setPendingTo("");
    setFilterType("all");
    setAppliedDay("");
    setAppliedFrom("");
    setAppliedTo("");
  };

  const filterLabel = useMemo(() => {
    if (filterType === "all") return "All orders";
    if (filterType === "week") {
      const now = new Date();
      const dow = (now.getDay() + 6) % 7;
      const lastMonday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 7);
      const lastSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow - 1);
      const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
      return `Last week (${f(lastMonday)} – ${f(lastSunday)})`;
    }
    if (filterType === "month") {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return `Last month (${prev.toLocaleDateString("en-IN", { month: "long", year: "numeric" })})`;
    }
    if (filterType === "day" && appliedDay) {
      const d = new Date(appliedDay);
      return `On ${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
    }
    if (filterType === "range") {
      const from = appliedFrom
        ? new Date(appliedFrom).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "Start";
      const to = appliedTo
        ? new Date(appliedTo).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "End";
      return `${from} to ${to}`;
    }
    return "Selected period";
  }, [filterType, appliedDay, appliedFrom, appliedTo]);

  return (
    <PageTransition>
      <PageBackground image="orders" />
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3"
        >
          <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-soft">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Saved Orders</h1>
            <p className="text-sm text-muted-foreground">
              Showing {filteredOrders.length} of {orders.length} order
              {orders.length === 1 ? "" : "s"}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 rounded-2xl border border-border/60 bg-card shadow-soft p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" /> Filter
              </label>
              <select
                value={pendingType}
                onChange={(e) => setPendingType(e.target.value as FilterType)}
                className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Orders</option>
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="day">Particular Date</option>
                <option value="range">Custom Date Range</option>
              </select>
            </div>

            {pendingType === "day" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  value={pendingDay}
                  onChange={(e) => setPendingDay(e.target.value)}
                  className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            )}

            {pendingType === "range" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <input
                    type="date"
                    value={pendingFrom}
                    onChange={(e) => setPendingFrom(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <input
                    type="date"
                    value={pendingTo}
                    onChange={(e) => setPendingTo(e.target.value)}
                    className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={applyFilter}
                className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-soft"
              >
                Apply
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={clearFilter}
                className="h-10 px-4 rounded-lg border border-border bg-background text-sm font-medium flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </motion.button>
            </div>
          </div>
        </motion.div>

        {!loading && orders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 flex items-center justify-between rounded-2xl border border-border/60 bg-gradient-to-r from-primary/10 to-primary/5 p-4 shadow-soft"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-soft">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{filterLabel}</p>
                <p className="font-display text-xl font-bold text-foreground">
                  {filteredOrders.length} order{filteredOrders.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Total of {orders.length} saved order{orders.length === 1 ? "" : "s"}
            </p>
          </motion.div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No orders saved yet. Create one from the New Order tab.
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
            No orders found for the selected date range.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground text-left">
                <tr>
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold">Party</th>
                  <th className="p-3 font-semibold">Delivery</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Total (₹)</th>
                  <th className="p-3 w-28 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o, i) => (
                  <motion.tr
                    key={o._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={i % 2 ? "bg-muted/40" : ""}
                  >
                    <td className="p-3 font-semibold text-primary">#{o.invoiceNo}</td>
                    <td className="p-3">{o.date}</td>
                    <td className="p-3">
                      {o.partyName || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-xs">
                      {o.deliveryDate ? (
                        <>
                          {o.deliveryDate}
                          {o.deliveryDay && (
                            <span className="text-muted-foreground"> · {o.deliveryDay}</span>
                          )}
                          {o.deliveryTime && (
                            <span className="text-muted-foreground"> · {o.deliveryTime}</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-3 text-xs">
                      {(() => {
                        const st = deliveryStatus(o);
                        return (
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[st.tone]}`}
                            >
                              {st.label}
                            </span>
                            {o.actualDeliveryDate ? (
                              <span className="text-muted-foreground">
                                {o.actualDeliveryDate}
                                {o.actualDeliveryDay && ` · ${o.actualDeliveryDay}`}
                              </span>
                            ) : (
                              <motion.button
                                whileHover={{ scale: 1.04 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => markDelivered(o._id)}
                                className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                Mark Delivered
                              </motion.button>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {o.grandTotal.toLocaleString("en-IN")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-1">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => downloadOrderPdf(o)}
                          className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-primary/10"
                          aria-label="Download PDF"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </motion.button>
                        <button
                          onClick={() => remove(o._id)}
                          className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                          aria-label="Delete order"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

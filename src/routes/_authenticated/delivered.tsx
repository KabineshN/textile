import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Truck, Download, Loader2, PackageCheck, CalendarDays } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";
import { PageBackground } from "@/components/PageBackground";
import { getOrdersFn } from "@/lib/api.functions";
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

type DeliveryStatus = { label: string; tone: "ontime" | "delayed" | "early" };

function deliveryStatus(o: SavedOrder): DeliveryStatus {
  const actual = o.actualDeliveryDate ? parseYmd(o.actualDeliveryDate) : null;
  const expected = o.deliveryDate ? parseYmd(o.deliveryDate) : null;
  if (!actual || !expected) return { label: "Delivered", tone: "ontime" };
  const a = actual.getTime();
  const e = expected.getTime();
  if (a === e) return { label: "Delivered – On Time", tone: "ontime" };
  if (a > e) return { label: "Delivered – Delayed", tone: "delayed" };
  return { label: "Delivered – Early", tone: "early" };
}

const statusClass: Record<DeliveryStatus["tone"], string> = {
  ontime: "bg-primary/15 text-primary",
  delayed: "bg-destructive/15 text-destructive",
  early: "bg-secondary text-secondary-foreground",
};

export const Route = createFileRoute("/_authenticated/delivered")({
  head: () => ({
    meta: [
      { title: "Delivered Orders — Sri Sakthi Vinayaka Tex" },
      { name: "description", content: "Browse all delivered orders." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeliveredOrdersPage,
});

function downloadOrderPdf(o: SavedOrder) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

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

function DeliveredOrdersPage() {
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const session = getStoredSession();
      const allOrders = await getOrdersFn({ data: session });
      const deliveredOrders = allOrders.filter((o) => o.actual_delivery_date);
      deliveredOrders.sort(
        (a, b) =>
          new Date(b.actual_delivery_date || 0).getTime() -
          new Date(a.actual_delivery_date || 0).getTime(),
      );
      setOrders(
        deliveredOrders.map((r): SavedOrder => ({
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
      console.error("Failed to load delivered orders:", e);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const totalQty = orders.reduce((sum, o) => {
      const q = (o.items ?? []).reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
      return sum + q;
    }, 0);
    const totalAmount = orders.reduce((s, o) => s + (o.grandTotal || 0), 0);
    const onTime = orders.filter((o) => deliveryStatus(o).tone === "ontime").length;
    const delayed = orders.filter((o) => deliveryStatus(o).tone === "delayed").length;
    const early = orders.filter((o) => deliveryStatus(o).tone === "early").length;
    return { totalQty, totalAmount, onTime, delayed, early };
  }, [orders]);

  return (
    <PageTransition>
      <PageBackground image="delivered" />
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3"
        >
          <div className="h-11 w-11 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-soft">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold">Delivered Orders</h1>
            <p className="text-sm text-muted-foreground">
              {orders.length} delivered order{orders.length === 1 ? "" : "s"}
            </p>
          </div>
        </motion.div>

        {!loading && orders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground">Total Qty (Mtr)</p>
              <p className="font-display text-xl font-bold tabular-nums">
                {totals.totalQty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 to-primary/5 p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground">Total Amount (₹)</p>
              <p className="font-display text-xl font-bold tabular-nums">
                {totals.totalAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground">On Time</p>
              <p className="font-display text-xl font-bold text-primary tabular-nums">
                {totals.onTime}
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
              <p className="text-xs font-medium text-muted-foreground">Delayed</p>
              <p className="font-display text-xl font-bold text-destructive tabular-nums">
                {totals.delayed}
              </p>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading delivered orders…
          </div>
        ) : orders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground flex flex-col items-center gap-3"
          >
            <PackageCheck className="h-10 w-10 text-muted-foreground/50" />
            <p>
              No delivered orders yet. Mark an order as delivered in the Orders module to see it
              here.
            </p>
          </motion.div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground text-left">
                <tr>
                  <th className="p-3 font-semibold">Invoice #</th>
                  <th className="p-3 font-semibold">Order Date</th>
                  <th className="p-3 font-semibold">Party</th>
                  <th className="p-3 font-semibold">Products</th>
                  <th className="p-3 font-semibold text-right">Qty (Mtr)</th>
                  <th className="p-3 font-semibold">Delivered On</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Total (₹)</th>
                  <th className="p-3 w-20 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const items = o.items ?? [];
                  const qty = items.reduce((s, it) => s + (parseFloat(it.qty) || 0), 0);
                  const products =
                    items.length > 0 ? items.map((it) => it.particulars || "-").join(", ") : "—";
                  return (
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
                      <td className="p-3 max-w-[220px] truncate" title={products}>
                        {products}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {qty.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs">
                        {o.actualDeliveryDate ? (
                          <>
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                              {o.actualDeliveryDate}
                            </span>
                            {o.actualDeliveryDay && (
                              <span className="text-muted-foreground">{o.actualDeliveryDay}</span>
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
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClass[st.tone]}`}
                            >
                              {st.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        {o.grandTotal.toLocaleString("en-IN")}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center">
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
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageTransition>
  );
}

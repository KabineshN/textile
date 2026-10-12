import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Printer, Save, Sparkles, Loader2 } from "lucide-react";
import { numberToIndianWords } from "@/lib/numberToWords";
import { getLatestOrderFn, createOrderFn, getCurrentUserFn } from "@/lib/api.functions";
import { getStoredSession } from "@/lib/session";

type Item = {
  id: string;
  particulars: string;
  pickRate: string;
  qty: string;
  ratePerMtr: string;
};

const newItem = (): Item => ({
  id: crypto.randomUUID(),
  particulars: "",
  pickRate: "",
  qty: "",
  ratePerMtr: "",
});

export function InvoiceForm() {
  const [invoiceNo, setInvoiceNo] = useState("0");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [partyName, setPartyName] = useState("");
  const [partyGstin, setPartyGstin] = useState("");
  const [hsnCode, setHsnCode] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [cgst, setCgst] = useState("2.5");
  const [sgst, setSgst] = useState("2.5");
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load next invoice number from the latest saved order in the backend
  useEffect(() => {
    (async () => {
      try {
        const session = getStoredSession();
        const last = await getLatestOrderFn({ data: session });
        if (last) {
          const n = parseInt(last.invoice_no, 10);
          if (!isNaN(n)) setInvoiceNo(String(n + 1));
        }
      } catch (e) {
        console.error("Failed to load latest invoice:", e);
      }
    })();
  }, []);

  const deliveryDay = useMemo(() => {
    if (!deliveryDate) return "";
    const d = new Date(deliveryDate);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { weekday: "long" });
  }, [deliveryDate]);

  const rows = useMemo(
    () =>
      items.map((it) => {
        const q = parseFloat(it.qty) || 0;
        const r = parseFloat(it.ratePerMtr) || 0;
        return { ...it, amount: q * r };
      }),
    [items],
  );

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);
  const cgstAmt = (subtotal * (parseFloat(cgst) || 0)) / 100;
  const sgstAmt = (subtotal * (parseFloat(sgst) || 0)) / 100;
  const totalWithTax = subtotal + cgstAmt + sgstAmt;
  const roundOff = Math.round(totalWithTax) - totalWithTax;
  const grandTotal = Math.round(totalWithTax);

  const update = (id: string, key: keyof Item, val: string) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [key]: val } : it)));
  const removeItem = (id: string) =>
    setItems((prev) => (prev.length === 1 ? prev : prev.filter((it) => it.id !== id)));

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const user = await getCurrentUserFn({ data: getStoredSession() });
      if (!user) throw new Error("Not signed in");
      await createOrderFn({
        data: {
          user_id: user.id,
          invoice_no: invoiceNo,
          invoice_date: date || null,
          party_name: partyName || null,
          party_gstin: partyGstin || null,
          hsn_code: hsnCode || null,
          delivery_date: deliveryDate || null,
          delivery_day: deliveryDay || null,
          delivery_time: deliveryTime || null,
          items: rows,
          subtotal,
          cgst,
          sgst,
          cgst_amt: cgstAmt,
          sgst_amt: sgstAmt,
          grand_total: grandTotal,
          actual_delivery_date: null,
          actual_delivery_day: null,
        },
      });

      const nextNo = String((parseInt(invoiceNo, 10) || 0) + 1);
      setInvoiceNo(nextNo);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      {/* Hero */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 rounded-3xl bg-gradient-hero p-8 md:p-12 text-primary-foreground shadow-elegant relative overflow-hidden"
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary-glow/20 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <Sparkles className="h-4 w-4" />
            <span>Loom to Ledger · Digital Order Book</span>
          </div>
          <h1 className="mt-3 text-4xl md:text-6xl font-display font-bold leading-tight">
            Sri Sakthi Vinayaka Tex
          </h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base opacity-90">
            1/96 B, Pillayar Kovil Thottam, Pattakkaranpalayam, Seenapuram (Po), Perundurai - 638
            057. Erode Dist. · Cell: 85310 29009
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs md:text-sm">
            <span className="rounded-full bg-primary-foreground/10 px-3 py-1 backdrop-blur">
              GSTIN: 33CIUPS1710B1ZG
            </span>
            <span className="rounded-full bg-primary-foreground/10 px-3 py-1 backdrop-blur">
              STATE CODE: 33
            </span>
            <span className="rounded-full bg-primary-foreground/10 px-3 py-1 backdrop-blur">
              UDYAM-TN-07-0082197
            </span>
          </div>
        </div>
      </motion.header>

      {/* Invoice Card */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="rounded-3xl bg-card p-6 md:p-10 shadow-elegant border border-border/60"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <span className="inline-block bg-gradient-primary text-primary-foreground px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest">
              TAX INVOICE
            </span>
            <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold">
              New Order Entry
            </h2>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Invoice No.
            </div>
            <div className="text-3xl font-display font-bold text-primary">#{invoiceNo || "—"}</div>
          </div>
        </div>

        {/* Meta grid */}
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          <Field label="Invoice No.">
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className={fieldCls}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldCls}
            />
          </Field>
          <Field label="Party Name">
            <input
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
              placeholder="Customer / Buyer"
              className={fieldCls}
            />
          </Field>
          <Field label="Party GSTIN">
            <input
              value={partyGstin}
              onChange={(e) => setPartyGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 33ABCDE1234F1Z5"
              className={fieldCls}
            />
          </Field>
          <Field label="HSN Code">
            <input
              value={hsnCode}
              onChange={(e) => setHsnCode(e.target.value)}
              placeholder="e.g. 5208"
              className={fieldCls}
            />
          </Field>
          <Field label="Delivery Date">
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className={fieldCls}
            />
          </Field>
          <Field label="Delivery Day">
            <input
              value={deliveryDay}
              readOnly
              placeholder="Auto from date"
              className={`${fieldCls} bg-muted/40`}
            />
          </Field>
          <Field label="Delivery Time">
            <input
              type="time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className={fieldCls}
            />
          </Field>
        </div>

        {/* Line items */}
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Order Particulars</h3>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setItems((p) => [...p, newItem()])}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-soft hover:bg-primary-glow transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Item
          </motion.button>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="p-3 font-semibold">Particulars</th>
                <th className="p-3 font-semibold w-28">Pick Rate</th>
                <th className="p-3 font-semibold w-28">Qty (Mtr)</th>
                <th className="p-3 font-semibold w-32">Rate / Mtr</th>
                <th className="p-3 font-semibold w-32 text-right">Amount (₹)</th>
                <th className="p-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((it, idx) => (
                  <motion.tr
                    key={it.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    className={idx % 2 ? "bg-muted/40" : ""}
                  >
                    <td className="p-2">
                      <input
                        value={it.particulars}
                        onChange={(e) => update(it.id, "particulars", e.target.value)}
                        placeholder="Fabric / Yarn description"
                        className={rowInput}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={it.pickRate}
                        onChange={(e) => update(it.id, "pickRate", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        inputMode="decimal"
                        value={it.qty}
                        onChange={(e) => update(it.id, "qty", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        inputMode="decimal"
                        value={it.ratePerMtr}
                        onChange={(e) => update(it.id, "ratePerMtr", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                    <td className="p-2 text-right font-semibold text-primary tabular-nums">
                      {it.amount.toFixed(2)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl bg-gradient-subtle border border-border/60 p-5"
          >
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Amount in words
            </div>
            <div className="font-display text-lg italic text-foreground min-h-[2.5rem]">
              {numberToIndianWords(grandTotal) || "—"}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">Payment terms: within 45 days</div>
          </motion.div>

          <div className="rounded-2xl bg-card border border-border p-5 space-y-2 text-sm">
            <TotalRow label="Total Amount Before Tax" value={subtotal} />
            <div className="flex items-center gap-3">
              <span className="flex-1 text-muted-foreground">Add: CGST</span>
              <input
                value={cgst}
                onChange={(e) => setCgst(e.target.value)}
                className="w-14 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
              <span className="w-28 text-right tabular-nums">{cgstAmt.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-1 text-muted-foreground">Add: SGST</span>
              <input
                value={sgst}
                onChange={(e) => setSgst(e.target.value)}
                className="w-14 rounded border border-input bg-background px-2 py-1 text-right text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
              <span className="w-28 text-right tabular-nums">{sgstAmt.toFixed(2)}</span>
            </div>
            <TotalRow label="Round Off" value={roundOff} muted />
            <div className="border-t border-border pt-3 mt-3 flex items-center justify-between">
              <span className="font-display text-lg font-semibold">Grand Total</span>
              <motion.span
                key={grandTotal}
                initial={{ scale: 1.15, color: "var(--primary-glow)" }}
                animate={{ scale: 1, color: "var(--primary)" }}
                transition={{ duration: 0.35 }}
                className="font-display text-2xl font-bold tabular-nums"
              >
                ₹ {grandTotal.toLocaleString("en-IN")}
              </motion.span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3 justify-end">
          {error && <span className="text-sm text-destructive mr-auto">{error}</span>}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold shadow-soft hover:shadow-glow transition-shadow disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Order"}
          </motion.button>
        </div>
      </motion.section>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-8 text-center text-xs text-muted-foreground"
      >
        Handwoven records, digitally preserved. · Sri Sakthi Vinayaka Tex ©{" "}
        {new Date().getFullYear()}
      </motion.p>
    </div>
  );
}

const fieldCls =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-ring/30";
const rowInput =
  "w-full rounded-md border border-border bg-background px-2 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function TotalRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

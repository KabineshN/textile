import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, Save, Sparkles, Printer, Loader2 } from "lucide-react";
import { createLoomFn, getCurrentUserFn } from "@/lib/api.functions";
import { getStoredSession } from "@/lib/session";

type WarpRow = { id: string; sizingName: string; dcNo: string; beamNo: string; meter: string };
type WeftCol = { id: string; color: string; ents: string; perMeter: string; totalKgs: string };
type YarnRow = { id: string; date: string; dcNo: string; values: string[] };

const uid = () => crypto.randomUUID();
const newWarp = (): WarpRow => ({ id: uid(), sizingName: "", dcNo: "", beamNo: "", meter: "" });
const newWeft = (): WeftCol => ({ id: uid(), color: "", ents: "", perMeter: "", totalKgs: "" });
const newYarn = (cols: number): YarnRow => ({
  id: uid(),
  date: "",
  dcNo: "",
  values: Array(cols).fill(""),
});

export function LoomDetailsForm() {
  // Header
  const [loomNo, setLoomNo] = useState("");
  const [name, setName] = useState("");
  const [designNo, setDesignNo] = useState("");
  const [counts, setCounts] = useState("");
  const [totalEnd, setTotalEnd] = useState("");
  const [colors, setColors] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [reed, setReed] = useState("");
  const [pick, setPick] = useState("");
  const [width, setWidth] = useState("");
  const [orderMeter, setOrderMeter] = useState("");
  const [crimp, setCrimp] = useState("");
  const [fabricMeters, setFabricMeters] = useState("");

  // Warp rows
  const [warp, setWarp] = useState<WarpRow[]>(Array.from({ length: 6 }, () => newWarp()));

  // Weft columns
  const [weft, setWeft] = useState<WeftCol[]>([
    { id: uid(), color: "", ents: "", perMeter: "", totalKgs: "" },
    { id: uid(), color: "", ents: "", perMeter: "", totalKgs: "" },
    { id: uid(), color: "", ents: "", perMeter: "", totalKgs: "" },
  ]);

  // Yarn incoming rows (values length must match weft.length)
  const [yarn, setYarn] = useState<YarnRow[]>([newYarn(3)]);

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // keep yarn values length in sync with weft columns
  useEffect(() => {
    setYarn((prev) =>
      prev.map((row) => {
        const values = [...row.values];
        while (values.length < weft.length) values.push("");
        values.length = weft.length;
        return { ...row, values };
      }),
    );
  }, [weft.length]);

  // Auto-calculate Width = Total End / Reed (skip empty / invalid / zero reed)
  useEffect(() => {
    const end = parseFloat(totalEnd);
    const r = parseFloat(reed);
    if (totalEnd.trim() === "" || reed.trim() === "") return;
    if (!isFinite(end) || !isFinite(r) || r === 0) return;
    setWidth((end / r).toFixed(2));
  }, [totalEnd, reed]);

  // Auto-calculate Fabric Meters = Order Meter × (1 − Crimp / 100)
  useEffect(() => {
    const om = parseFloat(orderMeter);
    const c = parseFloat(crimp);
    if (orderMeter.trim() === "" || crimp.trim() === "") return;
    if (!isFinite(om) || !isFinite(c)) return;
    setFabricMeters((om * (1 - c / 100)).toFixed(2));
  }, [orderMeter, crimp]);

  const updateWarp = (id: string, k: keyof WarpRow, v: string) =>
    setWarp((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const updateWeft = (id: string, k: keyof WeftCol, v: string) =>
    setWeft((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const updateYarn = (id: string, k: "date" | "dcNo", v: string) =>
    setYarn((p) => p.map((r) => (r.id === id ? { ...r, [k]: v } : r)));
  const updateYarnValue = (id: string, idx: number, v: string) =>
    setYarn((p) =>
      p.map((r) =>
        r.id === id ? { ...r, values: r.values.map((x, i) => (i === idx ? v : x)) } : r,
      ),
    );

  // Auto-calculate Per Meter = ((((Total End / Reed) + 3) × Pick) / 1690) / Count
  const perMeterCalc = useMemo(() => {
    const end = parseFloat(totalEnd);
    const r = parseFloat(reed);
    const p = parseFloat(pick);
    const c = parseFloat(counts);
    if (![end, r, p, c].every(isFinite)) return null;
    if (r === 0 || c === 0) return null;
    const v = ((end / r + 3) * p) / 1690 / c;
    return isFinite(v) ? v : null;
  }, [totalEnd, reed, pick, counts]);

  const weftTotalKgs = useMemo(
    () => weft.reduce((s, w) => s + (parseFloat(w.totalKgs) || 0), 0),
    [weft],
  );
  const yarnTotals = useMemo(
    () =>
      weft.map((_, colIdx) =>
        yarn.reduce((s, r) => s + (parseFloat(r.values[colIdx] || "0") || 0), 0),
      ),
    [yarn, weft],
  );

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      const user = await getCurrentUserFn({ data: getStoredSession() });
      if (!user) throw new Error("Not signed in");
      await createLoomFn({
        data: {
          user_id: user.id,
          loom_no: loomNo || null,
          name: name || null,
          design_no: designNo || null,
          counts: counts || null,
          total_end: totalEnd || null,
          colors: colors || null,
          delivery_date: deliveryDate || null,
          reed: reed || null,
          pick: pick || null,
          width: width || null,
          order_meter: orderMeter || null,
          crimp: crimp || null,
          fabric_meters: fabricMeters || null,
          warp,
          weft,
          yarn,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save loom");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:py-16">
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-10 rounded-3xl bg-gradient-hero p-8 md:p-12 text-primary-foreground shadow-elegant relative overflow-hidden"
      >
        <div className="relative">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <Sparkles className="h-4 w-4" />
            <span>Loom Register · Warp · Weft · Yarn</span>
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl font-display font-bold">Loom Details</h1>
          <p className="mt-3 max-w-2xl text-sm md:text-base opacity-90">
            Digitised loom card for production tracking — design, sizing, weft requirement and yarn
            incoming.
          </p>
        </div>
      </motion.header>

      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="rounded-3xl bg-card p-6 md:p-10 shadow-elegant border border-border/60 space-y-10"
      >
        {/* Top meta */}
        <div>
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <h2 className="font-display text-2xl font-semibold">Loom Card</h2>
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground tracking-wider">Loom No.</div>
              <div className="text-3xl font-display font-bold text-primary">#{loomNo || "—"}</div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <Field label="Loom No">
              <input
                value={loomNo}
                onChange={(e) => setLoomNo(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Gini Synthetics"
                className={fieldCls}
              />
            </Field>
            <Field label="Design No">
              <input
                value={designNo}
                onChange={(e) => setDesignNo(e.target.value)}
                placeholder="e.g. M-YD-6350-A16"
                className={fieldCls}
              />
            </Field>
            <Field label="Counts">
              <input
                value={counts}
                onChange={(e) => setCounts(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Total End">
              <input
                value={totalEnd}
                onChange={(e) => setTotalEnd(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Colors">
              <input
                value={colors}
                onChange={(e) => setColors(e.target.value)}
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
            <Field label="Reed">
              <input value={reed} onChange={(e) => setReed(e.target.value)} className={fieldCls} />
            </Field>
            <Field label="Pick">
              <input value={pick} onChange={(e) => setPick(e.target.value)} className={fieldCls} />
            </Field>
            <Field label="Width">
              <input
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Order Meter">
              <input
                value={orderMeter}
                onChange={(e) => setOrderMeter(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Crimp">
              <input
                value={crimp}
                onChange={(e) => setCrimp(e.target.value)}
                className={fieldCls}
              />
            </Field>
            <Field label="Fabric Meters">
              <input
                value={fabricMeters}
                onChange={(e) => setFabricMeters(e.target.value)}
                className={fieldCls}
              />
            </Field>
          </div>
        </div>

        {/* Warp */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl font-semibold">Warp</h3>
            <button
              onClick={() => setWarp((p) => [...p, newWarp()])}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-soft hover:bg-primary-glow transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Row
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <th className="p-3 font-semibold w-12">#</th>
                  <th className="p-3 font-semibold">Sizing Name</th>
                  <th className="p-3 font-semibold">DC No</th>
                  <th className="p-3 font-semibold">Beam No</th>
                  <th className="p-3 font-semibold">Meter</th>
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {warp.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={i % 2 ? "bg-muted/40" : ""}
                    >
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2">
                        <input
                          value={r.sizingName}
                          onChange={(e) => updateWarp(r.id, "sizingName", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={r.dcNo}
                          onChange={(e) => updateWarp(r.id, "dcNo", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={r.beamNo}
                          onChange={(e) => updateWarp(r.id, "beamNo", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          inputMode="decimal"
                          value={r.meter}
                          onChange={(e) => updateWarp(r.id, "meter", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() =>
                            setWarp((p) => (p.length === 1 ? p : p.filter((x) => x.id !== r.id)))
                          }
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10"
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
        </div>

        {/* Weft Requirement */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl font-semibold">Weft Requirement</h3>
            <button
              onClick={() => setWeft((p) => [...p, newWeft()])}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-soft hover:bg-primary-glow transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Color
            </button>
          </div>
          <p className="mb-3 rounded-xl border border-border/60 bg-secondary/60 px-4 py-2 text-xs md:text-sm font-medium text-muted-foreground">
            Per Meter = ((((Total End / Reed) + 3) × Pick) / 1690) / Count
          </p>
          <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-2xl border border-border/60 bg-background/60 p-4">
            <Field label="Total End">
              <input
                inputMode="decimal"
                value={totalEnd}
                onChange={(e) => setTotalEnd(e.target.value)}
                placeholder="e.g. 2740"
                className={fieldCls}
              />
            </Field>
            <Field label="Reed">
              <input
                inputMode="decimal"
                value={reed}
                onChange={(e) => setReed(e.target.value)}
                placeholder="e.g. 56"
                className={fieldCls}
              />
            </Field>
            <Field label="Pick">
              <input
                inputMode="decimal"
                value={pick}
                onChange={(e) => setPick(e.target.value)}
                placeholder="e.g. 52"
                className={fieldCls}
              />
            </Field>
            <Field label="Count">
              <input
                inputMode="decimal"
                value={counts}
                onChange={(e) => setCounts(e.target.value)}
                placeholder="e.g. 20"
                className={fieldCls}
              />
            </Field>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <th className="p-3 font-semibold w-40">Field</th>
                  <th className="p-3 font-semibold"></th>
                  {weft.map((w, i) => (
                    <th key={w.id} className="p-3 font-semibold">
                      Col {i + 1}
                    </th>
                  ))}
                  <th className="p-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 font-medium text-muted-foreground">Colors</td>
                  <td className="p-2">
                    <input className={rowInput} />
                  </td>
                  {weft.map((w) => (
                    <td key={w.id} className="p-2">
                      <input
                        value={w.color}
                        onChange={(e) => updateWeft(w.id, "color", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                  ))}
                  <td className="p-2"></td>
                </tr>
                <tr className="bg-muted/40">
                  <td className="p-2 font-medium text-muted-foreground">Ents</td>
                  <td className="p-2">
                    <input className={rowInput} />
                  </td>
                  {weft.map((w) => (
                    <td key={w.id} className="p-2">
                      <input
                        value={w.ents}
                        onChange={(e) => updateWeft(w.id, "ents", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                  ))}
                  <td className="p-2"></td>
                </tr>
                <tr>
                  <td className="p-2 font-medium text-muted-foreground">Per Meter</td>
                  <td className="p-2 text-center font-semibold text-primary tabular-nums">
                    {perMeterCalc !== null ? (
                      perMeterCalc.toFixed(4)
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {weft.map((w) => (
                    <td key={w.id} className="p-2">
                      <input
                        inputMode="decimal"
                        value={w.perMeter}
                        onChange={(e) => updateWeft(w.id, "perMeter", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                  ))}
                  <td className="p-2"></td>
                </tr>
                <tr className="bg-muted/40">
                  <td className="p-2 font-medium text-muted-foreground">Total Kgs</td>
                  <td className="p-2">
                    <input className={rowInput} />
                  </td>
                  {weft.map((w) => (
                    <td key={w.id} className="p-2">
                      <input
                        inputMode="decimal"
                        value={w.totalKgs}
                        onChange={(e) => updateWeft(w.id, "totalKgs", e.target.value)}
                        className={rowInput}
                      />
                    </td>
                  ))}
                  <td className="p-2 text-right font-semibold text-primary tabular-nums">
                    {weftTotalKgs.toFixed(3)}
                  </td>
                </tr>
                <tr>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  {weft.map((w) => (
                    <td key={w.id} className="p-2 text-center">
                      <button
                        onClick={() =>
                          setWeft((p) => (p.length === 1 ? p : p.filter((x) => x.id !== w.id)))
                        }
                        className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  ))}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Yarn Incoming */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-xl font-semibold">Yarn Incoming Details</h3>
            <button
              onClick={() => setYarn((p) => [...p, newYarn(weft.length)])}
              className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-sm font-medium shadow-soft hover:bg-primary-glow transition-colors"
            >
              <Plus className="h-4 w-4" /> Add Entry
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr className="text-left">
                  <th className="p-3 font-semibold w-36">Date</th>
                  <th className="p-3 font-semibold w-28">DC No</th>
                  {weft.map((w, i) => (
                    <th key={w.id} className="p-3 font-semibold">
                      {w.color || `Col ${i + 1}`}
                    </th>
                  ))}
                  <th className="p-3 w-12"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence initial={false}>
                  {yarn.map((r, i) => (
                    <motion.tr
                      key={r.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, x: -20 }}
                      className={i % 2 ? "bg-muted/40" : ""}
                    >
                      <td className="p-2">
                        <input
                          type="date"
                          value={r.date}
                          onChange={(e) => updateYarn(r.id, "date", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          value={r.dcNo}
                          onChange={(e) => updateYarn(r.id, "dcNo", e.target.value)}
                          className={rowInput}
                        />
                      </td>
                      {r.values.map((v, idx) => (
                        <td key={idx} className="p-2">
                          <input
                            inputMode="decimal"
                            value={v}
                            onChange={(e) => updateYarnValue(r.id, idx, e.target.value)}
                            className={rowInput}
                          />
                        </td>
                      ))}
                      <td className="p-2 text-center">
                        <button
                          onClick={() =>
                            setYarn((p) => (p.length === 1 ? p : p.filter((x) => x.id !== r.id)))
                          }
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
                <tr className="border-t border-border font-semibold">
                  <td className="p-3" colSpan={2}>
                    Total
                  </td>
                  {yarnTotals.map((t, i) => (
                    <td key={i} className="p-3 text-primary tabular-nums">
                      {t.toFixed(3)}
                    </td>
                  ))}
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 justify-end pt-2">
          {error && <span className="text-sm text-destructive mr-auto">{error}</span>}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-5 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-primary text-primary-foreground px-6 py-2.5 text-sm font-semibold shadow-soft hover:shadow-glow transition-shadow disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving…" : saved ? "Saved!" : "Save Loom Details"}
          </motion.button>
        </div>
      </motion.section>
    </div>
  );
}

const fieldCls =
  "w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-ring/30";
const rowInput =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-sm outline-none focus:border-primary focus:bg-background transition-colors";

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

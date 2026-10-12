import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Save,
  Loader2,
  Users,
  CalendarClock,
  FileText,
  Download,
  Pencil,
  X,
  Check,
  History,
  Search,
} from "lucide-react";
import {
  getWorkersFn,
  createWorkerFn,
  updateWorkerFn,
  deleteWorkerFn,
  getAttendanceFn,
  createAttendanceFn,
  deleteAttendanceFn,
  getCurrentUserFn,
} from "@/lib/api.functions";
import { getStoredSession } from "@/lib/session";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type Worker = {
  _id: string;
  employee_id: string | null;
  name: string;
  phone: string | null;
  role: string | null;
  hourly_rate: number;
  active: boolean;
};

type Attendance = {
  _id: string;
  worker_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  hours: number;
  hourly_rate: number;
  pay: number;
  notes: string | null;
};

type Tab = "workers" | "attendance" | "reports" | "history";

function computeHours(inT: string, outT: string): number {
  if (!inT || !outT) return 0;
  const [ih, im] = inT.split(":").map(Number);
  const [oh, om] = outT.split(":").map(Number);
  let mins = oh * 60 + om - (ih * 60 + im);
  if (mins < 0) mins += 24 * 60; // overnight shift
  return Math.round((mins / 60) * 100) / 100;
}

function formatTime12(t: string | null | undefined): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return "—";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function to12Parts(t: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!t) return { hour: "", minute: "", period: "AM" };
  const [hStr, mStr] = t.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return { hour: "", minute: "", period: "AM" };
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { hour: String(h12), minute: String(m).padStart(2, "0"), period };
}

function to24(hour: string, minute: string, period: "AM" | "PM"): string {
  if (!hour || !minute) return "";
  let h = Number(hour) % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

function TimePicker12({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parts = to12Parts(value);
  const update = (patch: Partial<{ hour: string; minute: string; period: "AM" | "PM" }>) => {
    const next = { ...parts, ...patch };
    onChange(to24(next.hour || "12", next.minute || "00", next.period));
  };
  const selectCls = "min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm";
  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="Hour"
        value={parts.hour}
        onChange={(e) => update({ hour: e.target.value })}
        className={selectCls}
      >
        <option value="">HH</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">:</span>
      <select
        aria-label="Minute"
        value={parts.minute}
        onChange={(e) => update({ minute: e.target.value })}
        className={selectCls}
      >
        <option value="">MM</option>
        {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0")).map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={parts.period}
        onChange={(e) => update({ period: e.target.value as "AM" | "PM" })}
        className={selectCls}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}

export function AttendanceModule() {
  const [tab, setTab] = useState<Tab>("attendance");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = getStoredSession();
      const user = await getCurrentUserFn({ data: session });
      if (!user) {
        setError("Not signed in");
        setLoading(false);
        return;
      }
      const [w, a] = await Promise.all([
        getWorkersFn({ data: session }),
        getAttendanceFn({ data: session }),
      ]);
      setWorkers(w);
      setAttendance(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="font-display text-3xl font-bold text-primary">Attendance & Payroll</h1>
        <p className="text-sm text-muted-foreground">
          Track worker check-in / check-out, auto-calculate hours and pay.
        </p>
      </motion.div>

      <div className="mb-6 inline-flex rounded-full bg-secondary p-1 shadow-soft">
        {(
          [
            { id: "attendance", label: "Attendance", icon: CalendarClock },
            { id: "workers", label: "Workers", icon: Users },
            { id: "reports", label: "Reports", icon: FileText },
            { id: "history", label: "History", icon: History },
          ] as { id: Tab; label: string; icon: typeof Users }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === id && (
              <motion.span
                layoutId="attn-tab"
                className="absolute inset-0 rounded-full bg-primary shadow-soft"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative">{label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : tab === "workers" ? (
            <WorkersTab workers={workers} reload={load} setError={setError} />
          ) : tab === "attendance" ? (
            <AttendanceTab
              workers={workers}
              attendance={attendance}
              reload={load}
              setError={setError}
            />
          ) : tab === "reports" ? (
            <ReportsTab workers={workers} attendance={attendance} />
          ) : (
            <HistoryTab workers={workers} attendance={attendance} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------ Workers Tab ------------------------------ */

function WorkersTab({
  workers,
  reload,
  setError,
}: {
  workers: Worker[];
  reload: () => Promise<void>;
  setError?: (err: string | null) => void;
}) {
  const [form, setForm] = useState({
    employee_id: "",
    name: "",
    phone: "",
    role: "",
    hourly_rate: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({
    employee_id: "",
    name: "",
    phone: "",
    role: "",
    hourly_rate: "",
  });

  const addWorker = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const user = await getCurrentUserFn({ data: getStoredSession() });
      if (!user) return;
      await createWorkerFn({
        data: {
          user_id: user.id,
          employee_id: form.employee_id.trim() || null,
          name: form.name.trim(),
          phone: form.phone || null,
          role: form.role || null,
          hourly_rate: Number(form.hourly_rate) || 0,
          active: true,
        },
      });
      setForm({ employee_id: "", name: "", phone: "", role: "", hourly_rate: "" });
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to add worker");
    }
    setSaving(false);
    await reload();
  };

  const startEdit = (w: Worker) => {
    setEditingId(w._id);
    setEdit({
      employee_id: w.employee_id || "",
      name: w.name,
      phone: w.phone || "",
      role: w.role || "",
      hourly_rate: String(w.hourly_rate),
    });
  };

  const saveEdit = async (id: string) => {
    try {
      await updateWorkerFn({
        data: {
          id,
          data: {
            employee_id: edit.employee_id.trim() || null,
            name: edit.name,
            phone: edit.phone || null,
            role: edit.role || null,
            hourly_rate: Number(edit.hourly_rate) || 0,
          },
        },
      });
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to update worker");
    }
    setEditingId(null);
    await reload();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this worker? Their attendance records will also be removed.")) return;
    try {
      await deleteWorkerFn({ data: { id } });
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to delete worker");
    }
    await reload();
  };

  const toggleActive = async (w: Worker) => {
    try {
      await updateWorkerFn({ data: { id: w._id, data: { active: !w.active } } });
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to update worker status");
    }
    await reload();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-semibold">Add Worker</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Worker ID (e.g. W001)"
            value={form.employee_id}
            onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
          />
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <input
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Role (e.g. Weaver)"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          <input
            type="number"
            step="0.01"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Hourly rate (₹)"
            value={form.hourly_rate}
            onChange={(e) => setForm({ ...form, hourly_rate: e.target.value })}
          />
        </div>
        <button
          onClick={addWorker}
          disabled={saving || !form.name.trim()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add worker
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3 text-right">Rate/hr</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No workers yet — add your first worker above.
                </td>
              </tr>
            )}
            {workers.map((w) => {
              const editing = editingId === w._id;
              return (
                <motion.tr
                  key={w._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-border/60"
                >
                  {editing ? (
                    <>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-input bg-background px-2 py-1"
                          placeholder="ID"
                          value={edit.employee_id}
                          onChange={(e) => setEdit({ ...edit, employee_id: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-input bg-background px-2 py-1"
                          value={edit.name}
                          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-input bg-background px-2 py-1"
                          value={edit.role}
                          onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          className="w-full rounded border border-input bg-background px-2 py-1"
                          value={edit.phone}
                          onChange={(e) => setEdit({ ...edit, phone: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          className="w-full rounded border border-input bg-background px-2 py-1 text-right"
                          value={edit.hourly_rate}
                          onChange={(e) => setEdit({ ...edit, hourly_rate: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-xs text-muted-foreground">—</span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => saveEdit(w._id)}
                          className="mr-1 inline-flex items-center rounded-md bg-primary/10 p-1.5 text-primary hover:bg-primary/20"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center rounded-md bg-secondary p-1.5 hover:bg-secondary/70"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium tabular-nums text-muted-foreground">
                        {w.employee_id || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">{w.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.role || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{w.phone || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        ₹ {Number(w.hourly_rate).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(w)}
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            w.active
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {w.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => startEdit(w)}
                          className="mr-1 inline-flex items-center rounded-md bg-secondary p-1.5 hover:bg-secondary/70"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => del(w._id)}
                          className="inline-flex items-center rounded-md bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </>
                  )}
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------- Attendance Tab ---------------------------- */

function AttendanceTab({
  workers,
  attendance,
  reload,
  setError,
}: {
  workers: Worker[];
  attendance: Attendance[];
  reload: () => Promise<void>;
  setError?: (err: string | null) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [workerId, setWorkerId] = useState<string>("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedWorker = workers.find((w) => w._id === workerId);
  const hours = useMemo(() => computeHours(checkIn, checkOut), [checkIn, checkOut]);
  const pay = useMemo(
    () => (selectedWorker ? Math.round(hours * Number(selectedWorker.hourly_rate) * 100) / 100 : 0),
    [hours, selectedWorker],
  );

  useEffect(() => {
    if (!workerId && workers.length > 0) setWorkerId(workers[0]._id);
  }, [workers, workerId]);

  const save = async () => {
    if (!workerId || !selectedWorker) return;
    setSaving(true);
    try {
      const user = await getCurrentUserFn({ data: getStoredSession() });
      if (!user) return;
      await createAttendanceFn({
        data: {
          user_id: user.id,
          worker_id: workerId,
          date,
          check_in: checkIn || null,
          check_out: checkOut || null,
          hours,
          hourly_rate: Number(selectedWorker.hourly_rate),
          pay,
          notes: notes || null,
        },
      });
      setCheckIn("");
      setCheckOut("");
      setNotes("");
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to save attendance");
    }
    setSaving(false);
    await reload();
  };

  const del = async (id: string) => {
    if (!confirm("Delete this attendance record?")) return;
    try {
      await deleteAttendanceFn({ data: { id } });
    } catch (e) {
      setError?.(e instanceof Error ? e.message : "Failed to delete attendance");
    }
    await reload();
  };

  // Today's list
  const todaysList = attendance.filter((a) => a.date === date);
  const workerName = (id: string) => workers.find((w) => w._id === id)?.name ?? "—";
  const workerCode = (id: string) => workers.find((w) => w._id === id)?.employee_id ?? "—";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-semibold">Mark Attendance</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-8">
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Worker</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {workers.length === 0 && <option value="">Add a worker first</option>}
              {workers
                .filter((w) => w.active)
                .map((w) => (
                  <option key={w._id} value={w._id}>
                    {w.employee_id ? `[${w.employee_id}] ` : ""}
                    {w.name} — ₹{Number(w.hourly_rate).toFixed(2)}/hr
                  </option>
                ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Check-in</label>
            <TimePicker12 value={checkIn} onChange={setCheckIn} />
          </div>
          <div className="md:col-span-4">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Check-out
            </label>
            <TimePicker12 value={checkOut} onChange={setCheckOut} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Hours" value={hours.toFixed(2)} />
          <Stat label="Rate/hr" value={`₹ ${(selectedWorker?.hourly_rate ?? 0).toFixed(2)}`} />
          <Stat label="Pay" value={`₹ ${pay.toFixed(2)}`} highlight />
          <div className="flex items-end">
            <button
              onClick={save}
              disabled={saving || !workerId || hours <= 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-soft transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border/60 bg-secondary/40 px-4 py-2 text-sm font-medium">
          Attendance on {date} — {todaysList.length} record{todaysList.length === 1 ? "" : "s"}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Worker ID</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3">In</th>
              <th className="px-4 py-3">Out</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Rate</th>
              <th className="px-4 py-3 text-right">Pay</th>
              <th className="px-4 py-3">Notes</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {todaysList.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">
                  No attendance recorded for this date.
                </td>
              </tr>
            )}
            {todaysList.map((a) => (
              <tr key={a._id} className="border-t border-border/60">
                <td className="px-4 py-3 font-medium tabular-nums text-muted-foreground">
                  {workerCode(a.worker_id)}
                </td>
                <td className="px-4 py-3 font-medium">{workerName(a.worker_id)}</td>
                <td className="px-4 py-3 tabular-nums">{formatTime12(a.check_in)}</td>
                <td className="px-4 py-3 tabular-nums">{formatTime12(a.check_out)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{Number(a.hours).toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  ₹ {Number(a.hourly_rate).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                  ₹ {Number(a.pay).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.notes || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => del(a._id)}
                    className="inline-flex items-center rounded-md bg-destructive/10 p-1.5 text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-background"
      }`}
    >
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-display text-lg ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

/* ------------------------------ Reports Tab ------------------------------ */

type Period = "week" | "month" | "day" | "range" | "all";

function shiftDays(d: string, n: number) {
  const dt = new Date(d + "T00:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

function ReportsTab({ workers, attendance }: { workers: Worker[]; attendance: Attendance[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<Period>("month");
  const [day, setDay] = useState(today);
  const [rangeFrom, setRangeFrom] = useState(today.slice(0, 8) + "01");
  const [rangeTo, setRangeTo] = useState(today);
  const [workerId, setWorkerId] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { from, to, periodLabel } = useMemo(() => {
    if (period === "week")
      return { from: shiftDays(today, -6), to: today, periodLabel: "Last 7 days" };
    if (period === "month")
      return { from: shiftDays(today, -29), to: today, periodLabel: "Last 30 days" };
    if (period === "day") return { from: day, to: day, periodLabel: day };
    if (period === "range")
      return { from: rangeFrom, to: rangeTo, periodLabel: `${rangeFrom} → ${rangeTo}` };
    return { from: "0000-01-01", to: "9999-12-31", periodLabel: "All time" };
  }, [period, day, rangeFrom, rangeTo, today]);

  const matchedWorkerIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      workers
        .filter(
          (w) =>
            (w.employee_id ?? "").toLowerCase().includes(q) || w.name.toLowerCase().includes(q),
        )
        .map((w) => w._id),
    );
  }, [search, workers]);

  const filtered = useMemo(
    () =>
      attendance.filter(
        (a) =>
          a.date >= from &&
          a.date <= to &&
          (workerId === "all" || a.worker_id === workerId) &&
          (!matchedWorkerIds || matchedWorkerIds.has(a.worker_id)),
      ),
    [attendance, from, to, workerId, matchedWorkerIds],
  );

  const perWorker = useMemo(() => {
    const map = new Map<string, { hours: number; pay: number; days: number }>();
    for (const a of filtered) {
      const cur = map.get(a.worker_id) || { hours: 0, pay: 0, days: 0 };
      cur.hours += Number(a.hours);
      cur.pay += Number(a.pay);
      cur.days += 1;
      map.set(a.worker_id, cur);
    }
    return Array.from(map.entries()).map(([id, v]) => ({
      id,
      code: workers.find((w) => w._id === id)?.employee_id ?? "—",
      name: workers.find((w) => w._id === id)?.name ?? "—",
      ...v,
    }));
  }, [filtered, workers]);

  const totalHours = perWorker.reduce((s, w) => s + w.hours, 0);
  const totalPay = perWorker.reduce((s, w) => s + w.pay, 0);

  const downloadSlip = (workerRow: {
    id: string;
    name: string;
    hours: number;
    pay: number;
    days: number;
  }) => {
    const w = workers.find((x) => x._id === workerRow.id);
    const rows = filtered
      .filter((a) => a.worker_id === workerRow.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("SRI SAKTHI VINAYAKA TEX", 14, 18);
    doc.setFontSize(11);
    doc.text("Payment Slip", 14, 26);
    doc.setFontSize(10);
    if (w?.employee_id) doc.text(`Worker ID: ${w.employee_id}`, 14, 36);
    doc.text(`Worker: ${workerRow.name}`, 14, w?.employee_id ? 42 : 36);
    if (w?.role) doc.text(`Role: ${w.role}`, 14, w?.employee_id ? 48 : 42);
    doc.text(
      `Period: ${from} to ${to}`,
      14,
      w?.employee_id ? (w?.role ? 54 : 48) : w?.role ? 48 : 42,
    );
    doc.text(`Rate/hr: Rs. ${Number(w?.hourly_rate ?? 0).toFixed(2)}`, 120, 36);

    autoTable(doc, {
      startY: 64,
      head: [["Date", "In", "Out", "Hours", "Rate", "Pay", "Notes"]],
      body: rows.map((a) => [
        a.date,
        a.check_in ? formatTime12(a.check_in) : "-",
        a.check_out ? formatTime12(a.check_out) : "-",
        Number(a.hours).toFixed(2),
        Number(a.hourly_rate).toFixed(2),
        Number(a.pay).toFixed(2),
        a.notes || "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [34, 89, 55] },
    });

    const finalY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    doc.setFontSize(11);
    doc.text(`Total days: ${workerRow.days}`, 14, finalY);
    doc.text(`Total hours: ${workerRow.hours.toFixed(2)}`, 14, finalY + 6);
    doc.setFontSize(13);
    doc.text(`Total Pay: Rs. ${workerRow.pay.toFixed(2)}`, 14, finalY + 16);

    doc.save(`payslip-${workerRow.name.replace(/\s+/g, "_")}-${from}_to_${to}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Search by Worker ID / Name
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. EMP001 or Ravi"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Worker</label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All workers</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.employee_id ? `${w.employee_id} — ` : ""}
                  {w.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All time</option>
              <option value="week">Weekly (last 7 days)</option>
              <option value="month">Monthly (last 30 days)</option>
              <option value="day">Particular date</option>
              <option value="range">Date range</option>
            </select>
          </div>

          {period === "day" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}
          {period === "range" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  From date
                </label>
                <input
                  type="date"
                  value={rangeFrom}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  To date
                </label>
                <input
                  type="date"
                  value={rangeTo}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </>
          )}
          <div className="flex items-end">
            <button
              onClick={() => {
                setPeriod("month");
                setSearch("");
                setWorkerId("all");
                setDay(today);
                setRangeFrom(today.slice(0, 8) + "01");
                setRangeTo(today);
              }}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-secondary"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{periodLabel}</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Records" value={String(filtered.length)} />
          <Stat label="Workers" value={String(perWorker.length)} />
          <Stat label="Total hours" value={totalHours.toFixed(2)} />
          <Stat label="Total pay" value={`₹ ${totalPay.toFixed(2)}`} highlight />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border/60 bg-secondary/40 px-4 py-2 text-sm font-medium">
          Per-worker totals
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Worker ID</th>
              <th className="px-4 py-3">Worker</th>
              <th className="px-4 py-3 text-right">Days</th>
              <th className="px-4 py-3 text-right">Hours</th>
              <th className="px-4 py-3 text-right">Pay</th>
              <th className="px-4 py-3 text-right">Slip</th>
            </tr>
          </thead>
          <tbody>
            {perWorker.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  No attendance in the selected period.
                </td>
              </tr>
            )}
            {perWorker.map((r) => (
              <tr key={r.id} className="border-t border-border/60">
                <td className="px-4 py-3 font-medium tabular-nums text-muted-foreground">
                  {r.code}
                </td>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.days}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.hours.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-primary">
                  ₹ {r.pay.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => downloadSlip(r)}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary hover:bg-primary/20"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ History Tab ------------------------------ */

function HistoryTab({ workers, attendance }: { workers: Worker[]; attendance: Attendance[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");

  // records for the selected date, keyed by worker_id
  const recordsByWorker = useMemo(() => {
    const map = new Map<string, Attendance>();
    for (const a of attendance) {
      if (a.date === date) map.set(a.worker_id, a);
    }
    return map;
  }, [attendance, date]);

  const q = search.trim().toLowerCase();
  const rows = useMemo(() => {
    return workers
      .filter((w) => w.active)
      .filter(
        (w) =>
          !q || w.name.toLowerCase().includes(q) || (w.employee_id ?? "").toLowerCase().includes(q),
      )
      .map((w) => {
        const rec = recordsByWorker.get(w._id);
        return {
          id: w._id,
          code: w.employee_id || "—",
          name: w.name,
          role: w.role || "—",
          present: !!rec,
          checkIn: rec?.check_in ?? null,
          checkOut: rec?.check_out ?? null,
          hours: rec ? Number(rec.hours) : 0,
        };
      })
      .sort((a, b) => {
        // Present first, then by name
        if (a.present !== b.present) return a.present ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [workers, recordsByWorker, q]);

  const presentCount = rows.filter((r) => r.present).length;
  const absentCount = rows.length - presentCount;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-semibold">Attendance History</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Search by Worker ID / Name
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. W001 or Ravi"
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Date" value={date} />
          <Stat label="Workers" value={String(rows.length)} />
          <Stat label="Present" value={String(presentCount)} />
          <Stat label="Absent" value={String(absentCount)} highlight />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="border-b border-border/60 bg-secondary/40 px-4 py-2 text-sm font-medium">
          Attendance on {date}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Worker ID</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Check-in</th>
                <th className="px-4 py-3">Check-out</th>
                <th className="px-4 py-3 text-right">Hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                    No workers found for this date / search.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-border/60"
                >
                  <td className="px-4 py-3 font-medium tabular-nums text-muted-foreground">
                    {r.code}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.present
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          r.present ? "bg-primary" : "bg-destructive"
                        }`}
                      />
                      {r.present ? "Present" : "Absent"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{date}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.present ? formatTime12(r.checkIn) : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.present ? formatTime12(r.checkOut) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.present ? r.hours.toFixed(2) : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

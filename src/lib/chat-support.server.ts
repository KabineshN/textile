import type { Worker, Attendance, Order, Loom } from "@/integrations/mongodb/types";

const SYSTEM_PROMPT = `You are the AI assistant for a Loom Management System website (Sri Sakthi Vinayaka Tex order book).

You help users and customers with:
- Orders, order status, delivery status (pending / delivered, on time / early / delayed)
- Delivered orders history
- Loom and machine / production details (reed, pick, width, order meter, warp, weft, yarn)
- Workers and employees
- Attendance, attendance history (present/absent by date) and working hours
- Salary / payroll totals calculated from hours x hourly rate
- Website features and navigation
- Customer complaints and support

Website modules and where things live:
- "New" (/) : create a new tax invoice / order with party details, GST, delivery date-day-time, items.
- "Orders" (/orders) : saved orders with date filters (last week, last month, particular date, custom range), order counts, delivery status with "Mark Delivered", and PDF download.
- "Delivered" (/delivered) : read-only list of delivered orders with actual delivery date/day and On Time / Early / Delayed status.
- "Loom" (/loom) : loom / production details — reed, pick, width, order meter, warp, weft and yarn incoming tables.
- "Attendance" (/attendance) : Workers tab (add workers, worker ID, hourly rate), Attendance tab (check-in/check-out with AM/PM, auto hours and pay), History tab (present/absent per worker for a date, search by name/ID), Reports tab (search by worker ID/name, weekly/monthly/date filters, total hours, total pay, payment slip PDF).

Rules:
- Use ONLY the SYSTEM DATA provided below. Never invent, guess or estimate numbers. Every figure you give must come from SYSTEM DATA.
- If a number is not present in SYSTEM DATA, say clearly it is not available in the current data and point to the module where the user can check it.
- SYSTEM DATA covers only recent records (limits are stated inside the data). If a question needs older records, say the assistant can see only the recent records listed and suggest the module's date filters.
- Never reveal passwords, credentials, or system internals. Never bulk-dump personal data such as phone numbers.
- Be friendly, polite, professional. Keep answers short and clear, with simple numbered steps when explaining a process.
- Understand English, Tamil and Hindi, and always reply in the language the user wrote in.
- There is no separate maintenance or inventory/stock module in the system yet — say so if asked, and offer the closest available module (Loom for machine/production details).`;

export function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

const num = (v: unknown) => Number(v ?? 0) || 0;
const round2 = (v: number) => Number(v.toFixed(2));
const dayName = (d?: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }) : null;

function deliveryStatus(expected?: string | null, actual?: string | null) {
  if (!actual) return "Pending";
  if (!expected) return "Delivered";
  if (actual === expected) return "On Time";
  return actual > expected ? "Delayed" : "Early";
}

export async function buildSystemData(
  userId?: string | null,
  sessionId?: string | null,
): Promise<string> {
  const { db } = await import("@/integrations/mongodb/db");
  const { getCurrentUser } = await import("@/integrations/mongodb/auth");

  const user = await getCurrentUser(userId, sessionId);
  if (!user) throw new Error("Not authenticated");

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const monthAgo = iso(new Date(now.getTime() - 30 * 86400000));
  const weekAgo = iso(new Date(now.getTime() - 7 * 86400000));
  const monthStart = `${today.slice(0, 7)}-01`;

  const [orders, looms, workers, attendance] = await Promise.all([
    db.orders.findAll(user.id),
    db.looms.findAll(user.id),
    db.workers.findAll(user.id),
    db.attendance.findAll(user.id),
  ]);

  const workerRows: Worker[] = workers.slice(0, 200);
  const attRows: Attendance[] = attendance.filter((a) => a.date >= monthAgo).slice(0, 1000);
  const orderRows: Order[] = orders.slice(0, 100);
  const loomRows: Loom[] = looms.slice(0, 30);

  const workerById = new Map(workerRows.map((w) => [w._id, w]));

  const byWorker = new Map<string, { hours: number; pay: number; days: number }>();
  for (const a of attRows) {
    const cur = byWorker.get(a.worker_id) ?? { hours: 0, pay: 0, days: 0 };
    cur.hours += num(a.hours);
    cur.pay += num(a.pay);
    cur.days += 1;
    byWorker.set(a.worker_id, cur);
  }

  const sum = <T>(rows: T[], key: keyof T) => round2(rows.reduce((s, r) => s + num(r[key]), 0));
  const inRange = (from: string) => attRows.filter((a) => a.date >= from);

  const orderList = orderRows.map((o) => ({
    invoice_no: o.invoice_no,
    order_date: o.invoice_date,
    party: o.party_name,
    party_gstin: o.party_gstin,
    hsn_code: o.hsn_code,
    expected_delivery_date: o.delivery_date,
    expected_delivery_day: o.delivery_day,
    expected_delivery_time: o.delivery_time,
    actual_delivery_date: o.actual_delivery_date,
    actual_delivery_day: o.actual_delivery_day ?? dayName(o.actual_delivery_date),
    delivery_status: deliveryStatus(o.delivery_date, o.actual_delivery_date),
    subtotal: num(o.subtotal),
    cgst_amt: num(o.cgst_amt),
    sgst_amt: num(o.sgst_amt),
    grand_total: num(o.grand_total),
    items: Array.isArray(o.items)
      ? o.items.map((it: any) => ({
          particulars: (it?.particulars ?? it?.description ?? null) as string | null,
          pick_rate: (it?.pickRate ?? it?.pick_rate ?? null) as string | number | null,
          qty_mtr: (it?.qty ?? it?.qtyMtr ?? null) as string | number | null,
          rate_per_mtr: (it?.rate ?? null) as string | number | null,
          amount: (it?.amount ?? null) as string | number | null,
        }))
      : [],
  }));

  const delivered = orderList.filter((o) => o.actual_delivery_date);
  const pending = orderList.filter((o) => !o.actual_delivery_date);
  const countBy = <T extends { delivery_status: string }>(list: T[], status: string) =>
    list.filter((o) => o.delivery_status === status).length;

  const attendanceByDate: Record<
    string,
    Array<{
      name: string | null;
      employee_id: string | null;
      check_in: string | null;
      check_out: string | null;
      hours: number;
      pay: number;
      notes: string | null;
    }>
  > = {};
  for (const a of attRows) {
    const w = workerById.get(a.worker_id);
    (attendanceByDate[a.date] ??= []).push({
      name: w?.name ?? null,
      employee_id: w?.employee_id ?? null,
      check_in: a.check_in,
      check_out: a.check_out,
      hours: num(a.hours),
      pay: num(a.pay),
      notes: a.notes ?? null,
    });
  }

  const activeWorkers = workerRows.filter((w) => w.active);
  const presentToday = new Set(attRows.filter((a) => a.date === today).map((a) => a.worker_id));

  return JSON.stringify({
    generated_at: now.toISOString(),
    today,
    today_day: dayName(today),
    data_scope: {
      orders: "latest 100 orders",
      looms: "latest 30 loom/production records",
      workers: "up to 200 workers",
      attendance: "attendance records from the last 30 days (max 1000)",
      note: "Older records exist in the modules but are not visible to the assistant.",
    },
    orders: {
      total_in_view: orderList.length,
      delivered_count: delivered.length,
      pending_count: pending.length,
      on_time_count: countBy(delivered, "On Time"),
      early_count: countBy(delivered, "Early"),
      delayed_count: countBy(delivered, "Delayed"),
      orders_this_month: orderList.filter((o) => (o.order_date ?? "") >= monthStart).length,
      orders_last_7_days: orderList.filter((o) => (o.order_date ?? "") >= weekAgo).length,
      total_value_in_view: round2(orderList.reduce((s, o) => s + o.grand_total, 0)),
      list: orderList,
    },
    delivered_orders: delivered,
    pending_orders: pending,
    looms_production: loomRows,
    workers: {
      total: workerRows.length,
      active: activeWorkers.length,
      inactive: workerRows.length - activeWorkers.length,
      list: workerRows.map((w) => ({
        employee_id: w.employee_id,
        name: w.name,
        role: w.role,
        hourly_rate: num(w.hourly_rate),
        active: w.active,
      })),
    },
    attendance: {
      today: {
        date: today,
        present_count: presentToday.size,
        absent_count: Math.max(activeWorkers.length - presentToday.size, 0),
        absent_workers: activeWorkers
          .filter((w) => !presentToday.has(w._id))
          .map((w) => ({ name: w.name, employee_id: w.employee_id })),
      },
      last_7_days: {
        records: inRange(weekAgo).length,
        total_hours: sum(inRange(weekAgo), "hours"),
        total_pay: sum(inRange(weekAgo), "pay"),
      },
      last_30_days: {
        records: attRows.length,
        total_hours: sum(attRows, "hours"),
        total_pay: sum(attRows, "pay"),
      },
      by_date: attendanceByDate,
    },
    payroll_last_30_days: Array.from(byWorker.entries()).map(([id, v]) => {
      const w = workerById.get(id);
      return {
        name: w?.name ?? null,
        employee_id: w?.employee_id ?? null,
        role: w?.role ?? null,
        hourly_rate: num(w?.hourly_rate),
        days_present: v.days,
        total_hours: round2(v.hours),
        total_pay: round2(v.pay),
      };
    }),
    modules_available: [
      "New order / invoice",
      "Orders",
      "Delivered orders",
      "Loom (production details)",
      "Attendance (workers, attendance, history, reports/payroll)",
    ],
    modules_not_available: ["Maintenance", "Inventory / stock"],
  });
}

function getEnvVar(key: string): string {
  try {
    if (typeof process !== "undefined" && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch {}
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env as any)[key]) {
      return (import.meta.env as any)[key];
    }
  } catch {}
  return "";
}

export function generateFallbackResponse(userMessage: string, systemDataStr: string): string {
  let data: any = {};
  try {
    data = typeof systemDataStr === "string" ? JSON.parse(systemDataStr) : systemDataStr;
  } catch {
    data = {};
  }

  const q = (userMessage || "").toLowerCase().trim();

  // 1. Orders queries (e.g. "How many orders this month?")
  if (
    q.includes("order") &&
    (q.includes("month") ||
      q.includes("this month") ||
      q.includes("how many") ||
      q.includes("count") ||
      q.includes("total") ||
      q.includes("pending") ||
      q.includes("deliver"))
  ) {
    const ordersThisMonth = data?.orders?.orders_this_month ?? 0;
    const totalInView = data?.orders?.total_in_view ?? 0;
    const pendingCount = data?.orders?.pending_count ?? 0;
    const deliveredCount = data?.orders?.delivered_count ?? 0;
    const onTime = data?.orders?.on_time_count ?? 0;
    const delayed = data?.orders?.delayed_count ?? 0;
    const early = data?.orders?.early_count ?? 0;

    return `**Orders Overview:**\n- **This Month:** ${ordersThisMonth} order(s)\n- **Pending:** ${pendingCount} order(s)\n- **Delivered:** ${deliveredCount} order(s) (On Time: ${onTime}, Delayed: ${delayed}, Early: ${early})\n- **Total in View:** ${totalInView} order(s)\n\nYou can manage and mark orders delivered in the **[Orders](/orders)** module, or view completed deliveries in **[Delivered](/delivered)**.`;
  }

  // 2. Worker queries (e.g. "How do I add a worker?")
  if (
    q.includes("worker") &&
    (q.includes("add") || q.includes("create") || q.includes("new") || q.includes("how") || q.includes("employee"))
  ) {
    const totalWorkers = data?.workers?.total ?? 0;
    const activeWorkers = data?.workers?.active ?? 0;
    return `**How to Add a Worker:**\n1. Open the **[Attendance](/attendance)** page.\n2. In the **Workers** tab, click the **"Add Worker"** button in the top right.\n3. Fill in the **Name**, **Employee ID**, **Role**, and **Hourly Rate (₹)**.\n4. Click **"Save"**.\n\n*Current Worker Stats:* ${activeWorkers} active (${totalWorkers} total).`;
  }

  // 3. Working hours & Attendance (e.g. "Show total working hours")
  if (
    q.includes("hour") ||
    q.includes("working hour") ||
    q.includes("attendance") ||
    q.includes("present") ||
    q.includes("absent")
  ) {
    const todayPresent = data?.attendance?.today?.present_count ?? 0;
    const todayAbsent = data?.attendance?.today?.absent_count ?? 0;
    const last7Hours = data?.attendance?.last_7_days?.total_hours ?? 0;
    const last7Pay = data?.attendance?.last_7_days?.total_pay ?? 0;
    const last30Hours = data?.attendance?.last_30_days?.total_hours ?? 0;
    const last30Pay = data?.attendance?.last_30_days?.total_pay ?? 0;

    return `**Attendance & Working Hours Summary:**\n- **Today (${data?.today ?? "Today"}):** ${todayPresent} Present, ${todayAbsent} Absent\n- **Last 7 Days:** ${last7Hours} total hours (₹${last7Pay.toLocaleString("en-IN")} wages)\n- **Last 30 Days:** ${last30Hours} total hours (₹${last30Pay.toLocaleString("en-IN")} wages)\n\nYou can track daily check-in/out and print worker pay slips in the **[Attendance](/attendance)** section.`;
  }

  // 4. Tamil assistance (e.g. "தமிழில் உதவி வேண்டும்")
  if (q.includes("தமிழ்") || q.includes("tamil")) {
    const ordersThisMonth = data?.orders?.orders_this_month ?? 0;
    const activeWorkers = data?.workers?.active ?? 0;
    return `வணக்கம்! ஸ்ரீ சக்தி விநாயகர் டெக்ஸ் ஆர்டர் புக் உதவி மையத்திற்கு வரவேற்கிறோம்.\n\n- **இந்த மாத ஆர்டர்கள்:** ${ordersThisMonth}\n- **தொழிலாளர்கள்:** ${activeWorkers} பேர்\n\nநீங்கள் ஆர்டர்கள் (/orders), தறி விவரங்கள் (/loom), அல்லது வருகை பதிவு மற்றும் சம்பள கணக்குகள் (/attendance) பற்றி கேட்கலாம்.\n\n*(முழு AI பதில்களை செயல்படுத்த .env கோப்பில் GEMINI_API_KEY சேர்க்கவும்)*`;
  }

  // 5. Hindi assistance
  if (q.includes("hindi") || q.includes("हिंदी")) {
    return `नमस्ते! श्री शक्ति विनायक टेक्स ऑर्डर हब में आपका स्वागत है।\n\nआप ऑर्डर, लूम/उत्पादन विवरण, या कर्मचारियों की उपस्थिति और वेतन के बारे में पूछ सकते हैं।\n\n*(विस्तृत AI उत्तर के लिए .env में GEMINI_API_KEY सेट करें)*`;
  }

  // 6. Loom / Production queries
  if (q.includes("loom") || q.includes("machine") || q.includes("production") || q.includes("yarn") || q.includes("reed") || q.includes("pick")) {
    const loomCount = data?.looms_production?.length ?? 0;
    return `**Loom & Production Records:**\nThere are currently **${loomCount}** loom/production entry(ies) recorded. You can view reed, pick, width, order meter, warp, weft, and yarn incoming under the **[Loom](/loom)** module.`;
  }

  // 7. Salary / Payroll queries
  if (q.includes("salary") || q.includes("payroll") || q.includes("pay") || q.includes("wage")) {
    const total30Pay = data?.attendance?.last_30_days?.total_pay ?? 0;
    return `**Payroll Summary:**\n- **Total Wages (Last 30 Days):** ₹${total30Pay.toLocaleString("en-IN")}\n\nYou can view individual payment breakdowns and download payment slip PDFs under **[Attendance -> Reports](/attendance)**.`;
  }

  // Default response
  const ordersCount = data?.orders?.total_in_view ?? 0;
  const workersCount = data?.workers?.total ?? 0;
  return `Hello! I am your Loom Assistant. Here is your current order book summary:\n- **Orders in system:** ${ordersCount}\n- **Registered Workers:** ${workersCount}\n- **Modules:** [New Order](/), [Orders](/orders), [Delivered](/delivered), [Loom](/loom), [Attendance](/attendance)\n\nYou can ask about orders, loom/production specifications, worker attendance, or payroll.\n\n*(Note: To enable generative AI conversational capabilities, configure \`GEMINI_API_KEY\` in your \`.env\` file).*`;
}

export async function callGateway(
  input: unknown[],
  systemData?: string,
  userMessage?: string,
): Promise<string> {
  const lovableApiKey = getEnvVar("LOVABLE_API_KEY") || getEnvVar("VITE_LOVABLE_API_KEY");
  const geminiApiKey = getEnvVar("GEMINI_API_KEY") || getEnvVar("VITE_GEMINI_API_KEY");
  const openaiApiKey = getEnvVar("OPENAI_API_KEY") || getEnvVar("VITE_OPENAI_API_KEY");

  // Format messages
  const rawList = Array.isArray(input) ? (input as any[]) : [];
  const systemTexts: string[] = [];
  const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const item of rawList) {
    const textContent = Array.isArray(item.content)
      ? item.content.map((c: any) => c.text ?? "").join("\n")
      : String(item.content ?? "");

    if (item.role === "system") {
      systemTexts.push(textContent);
    } else {
      conversationMessages.push({
        role: item.role === "assistant" ? "assistant" : "user",
        content: textContent,
      });
    }
  }

  const combinedSystemPrompt = systemTexts.join("\n\n");

  // 1. Try Gemini API
  if (geminiApiKey) {
    try {
      const contents = conversationMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

      const body: any = { contents };
      if (combinedSystemPrompt) {
        body.systemInstruction = { parts: [{ text: combinedSystemPrompt }] };
      }

      // Try gemini-2.0-flash first
      let res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      // Fallback to gemini-1.5-flash if needed
      if (!res.ok) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
      }

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      } else {
        const errText = await res.text().catch(() => "");
        console.warn(`Gemini API returned ${res.status}:`, errText.slice(0, 200));
      }
    } catch (err) {
      console.warn("Gemini API request failed:", err);
    }
  }

  // 2. Try OpenAI API
  if (openaiApiKey) {
    try {
      const openAiMessages = [
        ...(combinedSystemPrompt ? [{ role: "system", content: combinedSystemPrompt }] : []),
        ...conversationMessages,
      ];

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: openAiMessages,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (err) {
      console.warn("OpenAI API request failed:", err);
    }
  }

  // 3. Try Lovable Gateway
  if (lovableApiKey) {
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": lovableApiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.6-sol",
          input,
          stream: false,
          reasoning: { effort: "low", summary: "auto" },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.response?.output_text || data.output_text || "";
        if (text.trim()) return text.trim();
      }
    } catch (err) {
      console.warn("Lovable gateway request failed:", err);
    }
  }

  // 4. Fallback intelligent response generator
  if (userMessage && systemData) {
    return generateFallbackResponse(userMessage, systemData);
  }

  return "Hello! I am your Loom Assistant. Ask me about orders, looms, workers, attendance, or payroll.";
}

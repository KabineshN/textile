export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Worker = {
  _id: string;
  employee_id: string | null;
  name: string;
  phone: string | null;
  role: string | null;
  hourly_rate: number;
  active: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type Attendance = {
  _id: string;
  worker_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  hours: number;
  hourly_rate: number;
  pay: number;
  notes: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type Loom = {
  _id: string;
  loom_no: string | null;
  name: string | null;
  design_no: string | null;
  counts: string | null;
  total_end: string | null;
  colors: string | null;
  delivery_date: string | null;
  reed: string | null;
  pick: string | null;
  width: string | null;
  order_meter: string | null;
  crimp: string | null;
  fabric_meters: string | null;
  warp: Json[];
  weft: Json[];
  yarn: Json[];
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type Order = {
  _id: string;
  invoice_no: string;
  invoice_date: string | null;
  party_name: string | null;
  party_gstin: string | null;
  hsn_code: string | null;
  delivery_date: string | null;
  delivery_day: string | null;
  delivery_time: string | null;
  items: Json[];
  subtotal: number | null;
  cgst: string | null;
  sgst: string | null;
  cgst_amt: number | null;
  sgst_amt: number | null;
  grand_total: number;
  actual_delivery_date?: string | null;
  actual_delivery_day?: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  _id: string;
  content: string;
  role: string;
  user_id: string;
  created_at: string;
};

export type Profile = {
  _id: string;
  display_name: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

export type UserRole = {
  _id: string;
  user_id: string;
  role: "admin" | "user";
  created_at: string;
};

export type AppRole = "admin" | "user";

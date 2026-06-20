import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://qwbckutxfmhnwfkljjpd.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3YmNrdXR4Zm1obndma2xqanBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODIzMTIsImV4cCI6MjA5Mjk1ODMxMn0.tPAuqU4w2WrxhXnOGbmbCAydGLzszg1BtjkTVDPwfKU";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const jwtSecret =
  process.env.APP_JWT_SECRET ||
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  "smart-vip-kocluk-auth-login";

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

function send(res, status, body) {
  res.status(status).json(body);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", jwtSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function maybeSingle(query) {
  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw error;
  }
  return data || null;
}

async function findStudentId(user) {
  const userId = String(user.id || "");
  const email = normalizeEmail(user.email);

  if (userId) {
    const byUserId = await maybeSingle(
      supabase.from("students").select("id").eq("user_id", userId).limit(1),
    );
    if (byUserId?.id) return byUserId.id;

    const byPlatformUserId = await maybeSingle(
      supabase
        .from("students")
        .select("id")
        .eq("platform_user_id", userId)
        .limit(1),
    );
    if (byPlatformUserId?.id) return byPlatformUserId.id;
  }

  if (!email) return undefined;

  let query = supabase
    .from("students")
    .select("id, user_id, updated_at")
    .ilike("email", email)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (user.institution_id) {
    query = query.eq("institution_id", user.institution_id);
  }

  let { data, error } = await query;
  if (error) throw error;

  if ((!data || data.length === 0) && user.institution_id) {
    const fallback = await supabase
      .from("students")
      .select("id, user_id, updated_at")
      .ilike("email", email)
      .order("updated_at", { ascending: false })
      .limit(5);
    data = fallback.data;
    error = fallback.error;
    if (error) throw error;
  }

  if (!data || data.length === 0) return undefined;

  const linkedToUser = data.find((student) => String(student.user_id) === userId);
  if (linkedToUser?.id) return linkedToUser.id;

  const linked = data.find((student) => student.user_id);
  return linked?.id || data[0]?.id;
}

async function findCoachId(email) {
  if (!email) return undefined;

  const exact = await maybeSingle(
    supabase.from("coaches").select("id").eq("email", email).limit(1),
  );
  if (exact?.id) return exact.id;

  const insensitive = await maybeSingle(
    supabase.from("coaches").select("id").ilike("email", email).limit(1),
  );
  return insensitive?.id;
}

function toClientUser(user, { studentId, coachId } = {}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    studentId,
    coachId,
    institutionId: user.institution_id || undefined,
    package: user.package || undefined,
    startDate: user.start_date || undefined,
    endDate: user.end_date || undefined,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 204, {});
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !password) {
      return send(res, 400, { error: "E-posta ve şifre zorunludur." });
    }

    const user = await maybeSingle(
      supabase.from("users").select("*").ilike("email", email).limit(1),
    );

    if (!user || String(user.password_hash || "") !== password) {
      return send(res, 401, { error: "E-posta veya şifre hatalı." });
    }

    if (user.is_active === false) {
      return send(res, 403, { error: "Hesabınız askıya alınmış." });
    }

    const role = String(user.role || "");
    const studentId = role === "student" ? await findStudentId(user) : undefined;
    const coachId =
      role === "coach" || role === "teacher" ? await findCoachId(email) : undefined;
    const clientUser = toClientUser(user, { studentId, coachId });
    const now = Math.floor(Date.now() / 1000);
    const token = signJwt({
      sub: String(user.id),
      email,
      role,
      institutionId: clientUser.institutionId,
      studentId,
      coachId,
      iat: now,
      exp: now + 60 * 60 * 24 * 7,
    });

    return send(res, 200, { user: clientUser, token });
  } catch (error) {
    console.error("auth-login failed", error);
    return send(res, 500, {
      error: "Giriş sunucusunda hata oluştu.",
      detail: error?.message,
    });
  }
}

import * as cookie from "cookie";

const { parse, serialize } = cookie.default ?? cookie;

const SESSION_COOKIE = "jd_admin";

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 8_000_000) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

export function setAdminCookie(res, session) {
  const value = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  res.setHeader("Set-Cookie", serialize(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  }));
}

export function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  }));
}

export function getAdminSession(req) {
  const cookies = parse(req.headers.cookie || "");
  const raw = cookies[SESSION_COOKIE];
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function requireAdmin(req, res) {
  const session = getAdminSession(req);
  if (!session) {
    json(res, 401, { error: "Unauthorized." });
    return null;
  }
  return session;
}

export async function supabaseRequest(path, options = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env is not configured.");

  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase request failed with ${response.status}.`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function recordToRow(record) {
  return {
    order_key: record.orderKey,
    picked_up: record.pickedUp,
    picked_up_at: record.pickedUpAt,
    picked_up_by: record.pickedUpBy,
    checklist: record.checklist,
    photo_url: record.photoUrl,
    notes: record.notes,
    updated_at: record.updatedAt,
  };
}

export function rowToRecord(row) {
  return {
    orderKey: row.order_key,
    pickedUp: Boolean(row.picked_up),
    pickedUpAt: row.picked_up_at,
    pickedUpBy: row.picked_up_by,
    checklist: row.checklist,
    photoUrl: row.photo_url,
    notes: row.notes || "",
    updatedAt: row.updated_at,
  };
}

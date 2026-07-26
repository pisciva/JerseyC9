import { json } from "./_shared.js";

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  const adminAccessCode = normalizeCode(process.env.ADMIN_ACCESS_CODE);

  json(res, 200, {
    adminAccessCodeConfigured: Boolean(process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_CODES_JSON),
    adminSingleCodeConfigured: Boolean(process.env.ADMIN_ACCESS_CODE),
    adminCodeMapConfigured: Boolean(process.env.ADMIN_CODES_JSON),
    adminAccessCodeLength: adminAccessCode.length,
    adminAccessCodeMatchesExpected: adminAccessCode === "scimutdanlucu",
    supabaseUrlConfigured: Boolean(process.env.SUPABASE_URL),
    supabaseKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    blobTokenConfigured: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    nodeEnv: process.env.NODE_ENV || null,
  });
}

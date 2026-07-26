import { json, readBody, setAdminCookie } from "./_shared.js";

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

function resolveAdmin(code) {
  const singleCode = normalizeCode(process.env.ADMIN_ACCESS_CODE);
  if (singleCode && code === singleCode) {
    return { name: "Committee", codeLabel: "shared" };
  }

  const codeMapRaw = process.env.ADMIN_CODES_JSON;
  if (codeMapRaw) {
    let codeMap = {};
    try {
      codeMap = JSON.parse(codeMapRaw);
    } catch {
      codeMap = {};
    }
    const adminName = codeMap[code];
    if (adminName) {
      return { name: adminName, codeLabel: adminName };
    }
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readBody(req);
    const code = normalizeCode(body.code);
    const admin = resolveAdmin(code);

    if (!admin) {
      json(res, 401, { error: "Invalid access code." });
      return;
    }

    const session = { ...admin, loginAt: new Date().toISOString() };
    setAdminCookie(res, session);
    json(res, 200, { session });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : "Invalid request." });
  }
}

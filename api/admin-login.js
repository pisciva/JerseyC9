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

function readQueryCode(req) {
  try {
    const url = new URL(req.url || "", "https://local.invalid");
    return normalizeCode(url.searchParams.get("code"));
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  try {
    const body = await readBody(req);
    const headerCode = normalizeCode(req.headers["x-admin-code"]);
    const queryCode = readQueryCode(req);
    const bodyCode = normalizeCode(body.code);
    const code = bodyCode || headerCode || queryCode;
    const admin = resolveAdmin(code);

    if (!admin) {
      json(res, 401, {
        error: "Invalid access code.",
        debug: {
          bodyCodeLength: bodyCode.length,
          headerCodeLength: headerCode.length,
          queryCodeLength: queryCode.length,
          receivedCodeLength: code.length,
          envCodeLength: normalizeCode(process.env.ADMIN_ACCESS_CODE).length,
          receivedCodeMatchesExpected: code === "scimutdanlucu",
          envCodeMatchesExpected: normalizeCode(process.env.ADMIN_ACCESS_CODE) === "scimutdanlucu",
        },
      });
      return;
    }

    const session = { ...admin, loginAt: new Date().toISOString() };
    setAdminCookie(res, session);
    json(res, 200, { session });
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : "Invalid request." });
  }
}

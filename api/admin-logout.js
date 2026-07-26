import { clearAdminCookie, json } from "./_shared.js";

export default function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  clearAdminCookie(res);
  json(res, 200, { ok: true });
}

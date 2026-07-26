import {
  json,
  readBody,
  recordToRow,
  requireAdmin,
  rowToRecord,
  supabaseRequest,
} from "./_shared.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const rows = await supabaseRequest("distribution_records?select=*", { method: "GET" });
      json(res, 200, { records: rows.map(rowToRecord) });
      return;
    }

    if (req.method === "POST") {
      const session = requireAdmin(req, res);
      if (!session) return;

      const record = await readBody(req);
      const existingRows = await supabaseRequest(
        `distribution_records?order_key=eq.${encodeURIComponent(record.orderKey)}&select=*`,
        { method: "GET" }
      );
      const existing = existingRows[0] ? rowToRecord(existingRows[0]) : null;

      if (existing?.pickedUp && existing.pickedUpAt) {
        json(res, 409, { error: "This learner has already been marked as picked up.", record: existing });
        return;
      }

      const normalized = {
        ...record,
        pickedUpBy: record.pickedUpBy || session.name,
        updatedAt: new Date().toISOString(),
      };

      const rows = await supabaseRequest("distribution_records?on_conflict=order_key", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(recordToRow(normalized)),
      });

      json(res, 200, { record: rowToRecord(rows[0]) });
      return;
    }

    json(res, 405, { error: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Distribution API failed.";
    json(res, 500, { error: message });
  }
}

import { put } from "@vercel/blob";
import { json, readBody, requireAdmin } from "./_shared.js";

function dataUrlToBuffer(dataUrl) {
  const match = /^data:(.+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64"),
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed." });
    return;
  }

  const session = requireAdmin(req, res);
  if (!session) return;

  try {
    const body = await readBody(req);
    const orderKey = String(body.orderKey || "").replace(/[^a-zA-Z0-9-_]/g, "");
    const image = String(body.image || "");
    if (!orderKey || !image) throw new Error("orderKey and image are required.");

    const { contentType, buffer } = dataUrlToBuffer(image);
    const extension = contentType.includes("png") ? "png" : "jpg";
    const filename = `distribution/${orderKey}-${Date.now()}.${extension}`;
    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    json(res, 200, { url: blob.url, uploadedBy: session.name });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : "Upload failed." });
  }
}

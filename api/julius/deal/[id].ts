import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getDealById } from "../../../src/api/julius";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing deal id" });
  }

  const deal = await getDealById(id);

  if (!deal) {
    return res.status(404).json({ error: "Deal not found" });
  }

  res.status(200).json(deal);
}
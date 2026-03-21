const JULIUS_BASE = "https://api.julius.ai/shared";

export async function getDealById(id: string) {
  const res = await fetch(`${JULIUS_BASE}/deal/${id}`);

  if (!res.ok) throw new Error("Failed to fetch deal");

  return res.json();
}

export async function getAllDeals() {
  const res = await fetch(`${JULIUS_BASE}/deals`);

  if (!res.ok) throw new Error("Failed to fetch deals");

  return res.json();
}

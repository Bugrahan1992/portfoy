// Backend ile konuşan yardımcılar. Aynı origin olduğu için yol göreceli (/api/...).
export async function fetchMarket() {
  const r = await fetch("/api/market");
  if (!r.ok) throw new Error("market_unavailable");
  return r.json(); // { usd, eur, gramAltin, bist100, cds, updatedAt }
}

export async function fetchFund(code) {
  const r = await fetch("/api/tefas/" + encodeURIComponent(code));
  return r.json(); // { code, price, date } veya { price: null }
}

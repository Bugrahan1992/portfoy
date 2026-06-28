// Piyasa verileri (USD, EUR, gram altın, BIST100).
// BİRİNCİL KAYNAK: GenelPara — GERÇEK ZAMANLI, API anahtarı/kayıt gerektirmez, JSON.
//   https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR
//   https://api.genelpara.com/json/?list=altin&sembol=GA   (GA = gram altın)
// Sunucu tarafından çekilir → tarayıcıda CORS sorunu olmaz.
// YEDEK: GenelPara cevap vermezse Truncgil denenir.
import { getCached, setCached } from "../cache.js";

const TTL = 1000 * 60 * 3; // 3 dk önbellek (gerçek zamanlıya yakın, ama kaynağı yormadan)

function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (s.includes(",")) s = s.replace(",", "."); // 14,23
  const n = parseFloat(s); // 43.5028 gibi nokta-ondalık zaten doğru
  return isFinite(n) ? n : null;
}
function satis(node) {
  if (node == null) return null;
  if (typeof node === "object") return num(node.satis ?? node.alis ?? node.fiyat ?? node.last);
  return num(node);
}

async function gp(list, sembol) {
  const url = `https://api.genelpara.com/json/?list=${list}&sembol=${sembol}`;
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
  if (!r.ok) throw new Error("genelpara_" + r.status);
  const j = await r.json();
  return j && j.data ? j.data : j; // bazı sürümlerde { data: {...} } sarmalı var
}

// Yedek kaynak: Truncgil (saatlik)
async function truncgil() {
  const r = await fetch("https://finans.truncgil.com/v3/today.json", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("truncgil_" + r.status);
  const d = await r.json();
  const pick = (regexes) => { for (const k of Object.keys(d)) if (regexes.some((re) => re.test(k))) return d[k]; return null; };
  return {
    usd: satis(pick([/^usd$/i, /dolar/i])),
    eur: satis(pick([/^eur$/i, /euro/i])),
    gramAltin: satis(pick([/gram.?alt/i, /^gra$/i])),
    bist100: satis(pick([/bist.?100/i, /xu100/i])),
  };
}

export async function getMarket() {
  const cached = getCached("market");
  if (cached) return cached;

  let usd = null, eur = null, gramAltin = null, bist100 = null, source = "genelpara";

  try { const d = await gp("doviz", "USD,EUR"); usd = satis(d.USD); eur = satis(d.EUR); } catch (e) {}
  try { const a = await gp("altin", "GA"); gramAltin = satis(a.GA); } catch (e) {}
  try { const b = await gp("borsa", "XU100"); bist100 = satis(b.XU100 ?? b["XU100"]); } catch (e) {}

  // GenelPara'dan kritik alanlar gelmediyse Truncgil ile tamamla
  if (usd == null || gramAltin == null) {
    try {
      const t = await truncgil();
      if (usd == null) usd = t.usd;
      if (eur == null) eur = t.eur;
      if (gramAltin == null) gramAltin = t.gramAltin;
      if (bist100 == null) bist100 = t.bist100;
      source = usd != null && source === "genelpara" ? "genelpara+truncgil" : "truncgil";
    } catch (e) {}
  }

  const out = { usd, eur, gramAltin, bist100, updatedAt: new Date().toISOString(), source };
  setCached("market", out, TTL);
  return out;
}

// Hata ayıklama: GenelPara ham döviz cevabını gösterir.
export async function getMarketRaw() {
  const r = await fetch("https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR", { headers: { "User-Agent": "Mozilla/5.0" } });
  return r.json();
}

// Piyasa verileri (USD, EUR, gram altın, BIST100).
//
// DÖVİZ & ALTIN — BİRİNCİL: GenelPara (gerçek zamanlı, anahtarsız JSON):
//   https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR
//   https://api.genelpara.com/json/?list=altin&sembol=GA   (GA = gram altın)
//   YEDEK: GenelPara yanıt vermezse Truncgil denenir.
//   NOT: GenelPara'da geçerli list değerleri yalnızca doviz/altin/kripto/emtia'dır;
//   "borsa"/"endeks" YOKTUR (400 döner). Bu yüzden BIST100 GenelPara'dan çekilemez.
//
// BIST100 — Yahoo Finance (anahtarsız, XU100.IS): regularMarketPrice alanı.
//   https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS
//
// Hepsi sunucu tarafından çekilir → tarayıcıda CORS sorunu olmaz.
import { getCached, setCached } from "../cache.js";

const TTL = 1000 * 60 * 3; // 3 dk önbellek (gerçek zamanlıya yakın, ama kaynağı yormadan)

function num(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
  else if (s.includes(",")) s = s.replace(",", "."); // 14,23
  const n = parseFloat(s); // 46.6603 gibi nokta-ondalık zaten doğru
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
  return j && j.data ? j.data : j; // { data: {...} } sarmalını aç
}

// BIST100 — Yahoo Finance chart ucu (anahtarsız).
async function yahooBist100() {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/XU100.IS?interval=1d&range=1d";
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
  if (!r.ok) throw new Error("yahoo_" + r.status);
  const j = await r.json();
  const meta = j?.chart?.result?.[0]?.meta;
  return num(meta?.regularMarketPrice ?? meta?.chartPreviousClose);
}

// Yedek kaynak: Truncgil (döviz/altın için; BIST100 burada YOKTUR).
async function truncgil() {
  const r = await fetch("https://finans.truncgil.com/v3/today.json", { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("truncgil_" + r.status);
  const d = await r.json();
  const pick = (regexes) => { for (const k of Object.keys(d)) if (regexes.some((re) => re.test(k))) return d[k]; return null; };
  return {
    usd: satis(pick([/^usd$/i, /dolar/i])),
    eur: satis(pick([/^eur$/i, /euro/i])),
    gramAltin: satis(pick([/gram.?alt/i, /^gra$/i])),
  };
}

export async function getMarket() {
  const cached = getCached("market");
  if (cached) return cached;

  let usd = null, eur = null, gramAltin = null, bist100 = null, source = "genelpara";

  // Döviz & altın: GenelPara
  try { const d = await gp("doviz", "USD,EUR"); usd = satis(d.USD); eur = satis(d.EUR); } catch (e) {}
  try { const a = await gp("altin", "GA"); gramAltin = satis(a.GA); } catch (e) {}

  // GenelPara'dan döviz/altın gelmediyse Truncgil ile tamamla
  if (usd == null || gramAltin == null) {
    try {
      const t = await truncgil();
      if (usd == null) usd = t.usd;
      if (eur == null) eur = t.eur;
      if (gramAltin == null) gramAltin = t.gramAltin;
      source = source === "genelpara" ? "genelpara+truncgil" : "truncgil";
    } catch (e) {}
  }

  // BIST100: Yahoo Finance (GenelPara'da endeks yok)
  try { bist100 = await yahooBist100(); } catch (e) {}

  const out = { usd, eur, gramAltin, bist100, updatedAt: new Date().toISOString(), source };
  setCached("market", out, TTL);
  return out;
}

// Hata ayıklama: GenelPara ham döviz cevabını gösterir.
export async function getMarketRaw() {
  const r = await fetch("https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR", { headers: { "User-Agent": "Mozilla/5.0" } });
  return r.json();
}

// Piyasa verileri (USD, EUR, gram altın, BIST100).
//
// KAYNAK STRATEJİSİ (çok katmanlı — biri engellenirse diğeri devreye girer):
//   1) GenelPara  — gerçek zamanlı, anahtarsız, TR perakende satış fiyatları.
//        Yalnızca doviz/altin/kripto/emtia listeleri vardır (borsa/endeks YOK).
//   2) Truncgil   — döviz/altın için yedek.
//   3) Yahoo Finance — USDTRY=X, EURTRY=X, GC=F (ons altın), XU100.IS (BIST100).
//        ÖNEMLİ: Render gibi yurt dışı veri merkezlerinde GenelPara ve Truncgil
//        IP engeline takılabiliyor (USD/EUR/altın null dönüyordu); Yahoo oradan
//        erişilebildiği için döviz/altın yedeği ve BIST100 kaynağı olarak şart.
//
// Hepsi sunucu tarafından çekilir → tarayıcıda CORS sorunu olmaz.
import { getCached, setCached } from "../cache.js";

const TTL = 1000 * 60 * 3; // 3 dk önbellek
const TROY_OUNCE_GRAMS = 31.1034768; // 1 ons = 31.1034768 gram (altın ons→gram çevrimi)

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

// Tüm dış isteklere ortak: zaman aşımı (kaynak yavaşsa endpoint asılı kalmasın).
function getJson(url) {
  return fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  }).then((r) => {
    if (!r.ok) throw new Error("http_" + r.status);
    return r.json();
  });
}

async function gp(list, sembol) {
  const j = await getJson(`https://api.genelpara.com/json/?list=${list}&sembol=${sembol}`);
  return j && j.data ? j.data : j; // { data: {...} } sarmalını aç
}

// Yahoo Finance chart ucundan tek sembolün güncel fiyatı (anahtarsız).
async function yahooQuote(symbol) {
  const j = await getJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  );
  const meta = j?.chart?.result?.[0]?.meta;
  return num(meta?.regularMarketPrice ?? meta?.chartPreviousClose);
}

// Yedek kaynak: Truncgil (döviz/altın; BIST100 burada YOKTUR).
async function truncgil() {
  const d = await getJson("https://finans.truncgil.com/v3/today.json");
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

  let usd = null, eur = null, gramAltin = null, bist100 = null;
  const sources = [];

  // 1) Döviz & altın: GenelPara
  try {
    const d = await gp("doviz", "USD,EUR");
    usd = satis(d.USD); eur = satis(d.EUR);
  } catch (e) {}
  try {
    const a = await gp("altin", "GA");
    gramAltin = satis(a.GA);
  } catch (e) {}
  if (usd != null || eur != null || gramAltin != null) sources.push("genelpara");

  // 2) Eksik döviz/altın için Truncgil
  if (usd == null || eur == null || gramAltin == null) {
    try {
      const t = await truncgil();
      if (usd == null) usd = t.usd;
      if (eur == null) eur = t.eur;
      if (gramAltin == null) gramAltin = t.gramAltin;
      if (t.usd != null || t.eur != null || t.gramAltin != null) sources.push("truncgil");
    } catch (e) {}
  }

  // 3) Yahoo: BIST100 (her zaman) + hâlâ eksik döviz/altın yedeği
  //    (Render gibi ortamlarda GenelPara/Truncgil engelliyse devreye girer).
  try {
    bist100 = await yahooQuote("XU100.IS");
    if (bist100 != null) sources.push("yahoo");
  } catch (e) {}

  if (usd == null || eur == null || gramAltin == null) {
    try {
      const [uy, ey, goldOz] = await Promise.all([
        usd == null ? yahooQuote("USDTRY=X").catch(() => null) : Promise.resolve(null),
        eur == null ? yahooQuote("EURTRY=X").catch(() => null) : Promise.resolve(null),
        gramAltin == null ? yahooQuote("GC=F").catch(() => null) : Promise.resolve(null),
      ]);
      if (usd == null && uy != null) usd = uy;
      if (eur == null && ey != null) eur = ey;
      // Gram altın TRY = (ons altın USD / 31.1035) × USDTRY (2 ondalığa yuvarla)
      if (gramAltin == null && goldOz != null && usd != null) {
        gramAltin = Math.round(((goldOz / TROY_OUNCE_GRAMS) * usd) * 100) / 100;
      }
      if ((uy != null || ey != null || goldOz != null) && !sources.includes("yahoo")) {
        sources.push("yahoo");
      }
    } catch (e) {}
  }

  const out = {
    usd,
    eur,
    gramAltin,
    bist100,
    updatedAt: new Date().toISOString(),
    source: sources.join("+") || "none",
  };
  setCached("market", out, TTL);
  return out;
}

// Hata ayıklama: GenelPara ham döviz cevabını gösterir.
export async function getMarketRaw() {
  const r = await fetch("https://api.genelpara.com/json/?list=doviz&sembol=USD,EUR", {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  return r.json();
}

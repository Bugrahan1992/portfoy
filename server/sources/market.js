// Piyasa verileri (USD, EUR, gram altın, BIST100).
// Kaynak: Truncgil Finans — API anahtarı/kayıt gerektirmez, JSON döner.
// Sunucu tarafından çekildiği için CORS sorunu yoktur.
import { getCached, setCached } from "../cache.js";

const URL_V3 = "https://finans.truncgil.com/v3/today.json";
const TTL = 1000 * 60 * 15; // 15 dk

// "1.234,56" gibi TR formatlı string'i veya sayıyı number'a çevirir.
function toNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  // TR formatı: nokta binlik, virgül ondalık
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// Bir alanın değeri sayı/string ya da {Selling/Satış/Buying/Alış} objesi olabilir.
function readVal(node) {
  if (node == null) return null;
  if (typeof node === "number" || typeof node === "string") return toNum(node);
  if (typeof node === "object") {
    const cand =
      node.Selling ?? node["Satış"] ?? node.satis ?? node.selling ??
      node.Buying ?? node["Alış"] ?? node.alis ?? node.Value ?? node.value;
    if (cand != null) return toNum(cand);
    const first = Object.values(node).find((x) => typeof x === "number" || typeof x === "string");
    return first != null ? toNum(first) : null;
  }
  return null;
}

// Anahtar isimleri sürümle değişebildiği için tolere ederek arıyoruz.
function pick(obj, regexes) {
  for (const k of Object.keys(obj)) {
    if (regexes.some((r) => r.test(k))) return obj[k];
  }
  return null;
}

export async function getMarket() {
  const cached = getCached("market");
  if (cached) return cached;

  const r = await fetch(URL_V3, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!r.ok) throw new Error("truncgil_http_" + r.status);
  const data = await r.json();

  const out = {
    usd: readVal(pick(data, [/^usd$/i, /dolar/i])),
    eur: readVal(pick(data, [/^eur$/i, /euro/i])),
    gramAltin: readVal(pick(data, [/gram.?alt/i, /^gra$/i, /gram-altin/i])),
    bist100: readVal(pick(data, [/bist.?100/i, /xu100/i, /borsa.?istanbul/i])),
    updatedAt: data["Update_Date"] || data["Güncelleme Tarihi"] || new Date().toISOString(),
    source: "truncgil",
  };

  setCached("market", out, TTL);
  return out;
}

// Hata ayıklama: kaynaktan gelen ham JSON'u olduğu gibi döndürür.
// Alan adları beklenenden farklıysa /api/market/raw ile görüp parser'ı düzeltebilirsin.
export async function getMarketRaw() {
  const r = await fetch(URL_V3, { headers: { "User-Agent": "Mozilla/5.0" } });
  return r.json();
}

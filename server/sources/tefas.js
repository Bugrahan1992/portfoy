// TEFAS fon fiyatı.
// NOT: TEFAS Nisan 2026'da altyapısını Next.js'e taşıdı ve eski
// /api/DB/BindHistoryInfo uçlarını kaldırdı. Yeni uç:
//   https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir   (fiyat/pay/büyüklük)
// TEFAS dakikada ~6 istek sınırı uygular; bu yüzden gün boyu önbelleğe alıyoruz.
//
// Bu modül "en iyi çaba" mantığıyla çalışır: fiyatı bulursa döndürür,
// bulamazsa { price: null } döner ve uygulama o kalemi elle bırakır.
// Resmi uç gelecekte yine değişirse, alttaki FALLBACK (Fonoloji) notuna bak.
import { getCached, setCached } from "../cache.js";

const BASE = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";
const TTL = 1000 * 60 * 60 * 6; // 6 saat (fiyatlar günde bir güncellenir)

function toNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

// Gelen kayıttan fiyat alanını esnek biçimde bulur (FIYAT / price / SONFIYAT ...).
function readPrice(row) {
  if (!row || typeof row !== "object") return null;
  for (const k of Object.keys(row)) {
    if (/^(fiyat|price|sonfiyat|birimpayde[gğ]eri)$/i.test(k)) {
      const n = toNum(row[k]);
      if (n != null) return n;
    }
  }
  return null;
}

export async function getFundPrice(code) {
  code = (code || "").toUpperCase().trim();
  if (!code) return { code, price: null, error: "no_code" };

  const cacheKey = "tefas:" + code;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.tefas.gov.tr/FonAnaliz.aspx",
    "X-Requested-With": "XMLHttpRequest",
  };

  // Yeni uç farklı parametre adları kabul edebildiği için birkaç olasılığı deniyoruz.
  const attempts = [
    `${BASE}?fonkod=${code}`,
    `${BASE}?fonKod=${code}`,
    `${BASE}?fontip=YAT&fonkod=${code}`,
    `${BASE}?kind=YAT&fundCode=${code}`,
  ];

  let price = null;
  for (const url of attempts) {
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) continue;
      const data = await r.json();
      const list = Array.isArray(data) ? data : data.data || data.fonlar || data.result || [];
      const row =
        (Array.isArray(list) ? list : []).find(
          (x) => (x.FONKODU || x.fonKodu || x.code || x.kod || "").toUpperCase() === code
        ) || (Array.isArray(list) ? list[0] : null);
      price = readPrice(row);
      if (price != null) break;
    } catch (e) {
      // sıradaki denemeye geç
    }
  }

  const out = { code, price, date: new Date().toISOString().slice(0, 10), source: "tefas" };
  if (price != null) setCached(cacheKey, out, TTL);
  else out.error = "not_found";
  return out;
}

/*
  FALLBACK — eğer resmi uç çalışmazsa (boş/410 dönerse):
  Fonoloji ücretsiz JSON API'sine geçebilirsin (kişisel kullanım için yeterli):
    1) fonoloji.com/api-docs adresinden ücretsiz anahtar al.
    2) Bu fonksiyonu kullan:

  export async function getFundPrice(code) {
    const key = process.env.FONOLOJI_KEY;
    const r = await fetch(`https://api.fonoloji.com/v1/funds/${code}/nav?limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const d = await r.json();
    const last = d?.nav?.[0];
    return { code, price: last?.price ?? null, date: last?.date, source: "fonoloji" };
  }
*/

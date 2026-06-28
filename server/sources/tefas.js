// TEFAS fon fiyatı — bakımlı @firstthumb/tefas-api kütüphanesi ile.
// Bu kütüphane TEFAS'ın 2026 yeni JSON API'sini kullanır (HTML scraping yok),
// Node.js'te doğrudan çalışır. Biz son ~12 günün verisini isteyip en güncel
// fiyatı alıyoruz ve fon başına 6 saat önbelliyoruz (TEFAS'ın dakikada ~6
// istek sınırına takılmamak için).
import { TefasClient } from "@firstthumb/tefas-api";
import { getCached, setCached } from "../cache.js";

const TTL = 1000 * 60 * 60 * 6; // 6 saat
const client = new TefasClient();

function toNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function ymd(d) { return d.toISOString().slice(0, 10); }
function readPrice(row) {
  return toNum(row.price ?? row.fiyat ?? row.nav ?? row.value ?? row.FIYAT);
}
function rowTime(row) {
  const d = new Date(row.date ?? row.tarih ?? row.Date);
  const t = d.getTime();
  return isFinite(t) ? t : 0;
}

export async function getFundPrice(code) {
  code = (code || "").toUpperCase().trim();
  if (!code) return { code, price: null, error: "no_code" };

  const ck = "tefas:" + code;
  const cached = getCached(ck);
  if (cached) return cached;

  try {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 12);

    const resp = await client.getFund(ymd(start), ymd(end), code);
    const rows = (resp && resp.results) || resp?.data || [];

    if (Array.isArray(rows) && rows.length) {
      // en güncel tarihli kaydı seç
      let latest = rows[0];
      for (const r of rows) if (rowTime(r) >= rowTime(latest)) latest = r;
      const price = readPrice(latest);
      if (price != null) {
        const out = { code, price, date: ymd(new Date(rowTime(latest) || Date.now())), source: "tefas" };
        setCached(ck, out, TTL);
        return out;
      }
    }
    return { code, price: null, error: "not_found" };
  } catch (e) {
    return { code, price: null, error: "fetch_failed", detail: String(e?.message || e) };
  }
}

// Sağlık kontrolü: örnek bir fonu çeker (uç çalışıyor mu?).
export async function getSample(sampleCode = "IPB") {
  return getFundPrice(sampleCode);
}

// TEFAS fon fiyatları — TÜM LİSTEYİ GÜNDE BİR ÇEKME yaklaşımı.
//
// TEFAS'ın yeni resmi ucu tek istekte o günün tüm fon listesini (kod + fiyat) verir:
//   https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir
// Bu yüzden fonları tek tek sormak yerine listeyi bir kez çekip 6 saat önbellekte
// tutuyoruz; sonra her kodu bu listeden okuyoruz. Böylece TEFAS'ın dakikada ~6
// istek sınırına da takılmıyoruz.
//
// NOT: Bu yeni ucun tam parametre adları resmi olarak belgelenmedi; aşağıda birkaç
// olası biçim deneniyor. Yayına aldıktan sonra /api/tefas-list adresini açıp
// "count" değerine bak: 0'dan büyükse liste geliyor demektir. 0 ise (uç yine
// değişmiş olabilir) ilgili kalemleri elle güncellersin; kalıcı çözüm için
// dosyanın altındaki FALLBACK (Fonoloji) notuna bak.
import { getCached, setCached } from "../cache.js";

const BASE = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";
const LIST_TTL = 1000 * 60 * 60 * 6; // 6 saat

function toNum(v) {
  if (typeof v === "number") return isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/[^\d.,-]/g, "");
  if (s.includes(".") && s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
function readCode(row) {
  for (const k of ["FONKODU", "fonKodu", "fonkodu", "code", "kod", "FonKodu"]) {
    if (row[k]) return String(row[k]).toUpperCase().trim();
  }
  return "";
}
function readPrice(row) {
  for (const k of ["FIYAT", "fiyat", "price", "SONFIYAT", "birimPayDegeri", "BIRIMPAYDEGERI"]) {
    if (row[k] != null) { const n = toNum(row[k]); if (n != null) return n; }
  }
  return null;
}
function ddmmyyyy(d) { const p = (n) => String(n).padStart(2, "0"); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; }

async function fetchListForDate(dateStr) {
  const headers = {
    "User-Agent": "Mozilla/5.0",
    Accept: "application/json, text/plain, */*",
    Referer: "https://www.tefas.gov.tr/",
    "X-Requested-With": "XMLHttpRequest",
  };
  const tries = [
    { url: `${BASE}?fontip=YAT&tarih=${dateStr}`, opt: { headers } },
    { url: `${BASE}?fontip=YAT&bastarih=${dateStr}&bittarih=${dateStr}`, opt: { headers } },
    { url: BASE, opt: { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ fontip: "YAT", tarih: dateStr }) } },
    { url: BASE, opt: { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body: `fontip=YAT&tarih=${dateStr}` } },
  ];
  for (const t of tries) {
    try {
      const r = await fetch(t.url, t.opt);
      if (!r.ok) continue;
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.data || data.fonlar || data.result || [];
      if (Array.isArray(arr) && arr.length) return arr;
    } catch (e) { /* sıradaki biçimi dene */ }
  }
  return null;
}

// Tüm fon listesini (kod -> fiyat) getirir, önbelleğe alır.
export async function getFundList() {
  const cached = getCached("tefas:list");
  if (cached) return cached;

  let arr = null;
  // Bugün veri yoksa (akşam yayınlanır) birkaç gün geriye dön
  for (let i = 0; i < 5 && !arr; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    arr = await fetchListForDate(ddmmyyyy(d));
  }

  const map = {};
  if (arr) {
    for (const row of arr) {
      const code = readCode(row);
      const price = readPrice(row);
      if (code && price != null) map[code] = price;
    }
  }
  const out = { map, date: new Date().toISOString().slice(0, 10), count: Object.keys(map).length };
  if (out.count > 0) setCached("tefas:list", out, LIST_TTL);
  return out;
}

export async function getFundPrice(code) {
  code = (code || "").toUpperCase().trim();
  if (!code) return { code, price: null, error: "no_code" };
  const list = await getFundList();
  if (list.map[code] != null) return { code, price: list.map[code], source: "tefas", date: list.date };
  return { code, price: null, error: list.count ? "not_in_list" : "list_empty" };
}

/*
  FALLBACK — resmi uç boş dönerse (/api/tefas-list count: 0):
  Fonoloji ücretsiz JSON API'sine geçebilirsin (kişisel kullanım için yeterli):
    1) fonoloji.com/api-docs adresinden ücretsiz anahtar al.
    2) getFundPrice'ı şu şekilde değiştir:

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

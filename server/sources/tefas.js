// TEFAS fon fiyatı — TEFAS'ın 2026 yeni resmi JSON API'si ile (HTML scraping yok).
//
// NEDEN @firstthumb/tefas-api KALDIRILDI:
//   O kütüphane (v2.0.0) hâlâ eski POST /api/DB/BindHistoryInfo ucunu kullanıyor.
//   TEFAS 2026'da altyapısını Next.js'e taşıdı ve bu ucu kapattı (artık 404
//   "ERR-006 Method not found or disabled!" dönüyor) — bu yüzden kütüphane her
//   fon için 'fund not found' veriyordu. Çözüm: yeni resmi uca doğrudan istek.
//
// YENİ UÇ (canlı test edildi):
//   POST https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir
//   Gövde JSON: { fonTipi, fonKodu, basTarih:"YYYYMMDD", bitTarih:"YYYYMMDD",
//                 basSira, bitSira, dil, ... }
//   Cevap: { resultList: [{ fonKodu, fonUnvan, tarih, fiyat, ... }], ... }
//   Şema referansı: github.com/mirzazad/pytefas (yeni uçları kullanan istemci).
//
// TEFAS dakikada ~6 istek sınırı uygular; bu yüzden fon başına 6 saat önbelliyoruz.
import { getCached, setCached } from "../cache.js";

const URL = "https://www.tefas.gov.tr/api/funds/fonGnlBlgSiraliGetir";
const TTL = 1000 * 60 * 60 * 6; // 6 saat (fiyatlar günde bir güncellenir)
// Fon tipi bilinmiyor; en yaygın olan "YAT" (yatırım fonu) önce denenir.
const FUND_KINDS = ["YAT", "EMK", "BYF", "GYF", "GSYF"];

const HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/json",
  Origin: "https://www.tefas.gov.tr",
  Referer: "https://www.tefas.gov.tr/tr/fon-verileri",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

// Date -> "YYYYMMDD" (TEFAS bu biçimi bekliyor).
function ymd(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

// Tek bir fon tipi için son bir haftanın verisini çekip en güncel fiyatı döndürür.
async function fetchKind(code, kind) {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const body = {
    fonTipi: kind,
    fonKodu: code,
    aramaMetni: null,
    fonTurKod: null,
    fonGrubu: null,
    sfonTurKod: null,
    fonTurAciklama: null,
    kurucuKod: null,
    basTarih: ymd(weekAgo),
    bitTarih: ymd(today),
    basSira: 1,
    bitSira: 100000,
    dil: "TR",
    sFonTurKod: "",
    fonKod: "",
    fonGrup: "",
    fonUnvanTip: "",
  };

  const r = await fetch(URL, { method: "POST", headers: HEADERS, body: JSON.stringify(body) });
  if (!r.ok) return null;
  const data = await r.json();
  // errorMessage hem gerçek hata hem "veri yok" (tatil/hafta sonu) için dönebilir; ikisinde de boş kabul et.
  if (data.errorCode || data.errorMessage) return null;

  const rows = data.resultList || [];
  if (!rows.length) return null;

  // basSira=1 ile en yeni tarih başta gelir (API rn ile sıralar).
  const row = rows[0];
  return {
    price: typeof row.fiyat === "number" ? row.fiyat : null,
    date: row.tarih, // "YYYY-MM-DD"
  };
}

export async function getFundPrice(code) {
  code = (code || "").toUpperCase().trim();
  if (!code) return { code, price: null, error: "no_code" };

  const cacheKey = "tefas:" + code;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let result = null;
  for (const kind of FUND_KINDS) {
    try {
      result = await fetchKind(code, kind);
      if (result && result.price != null) break;
    } catch (e) {
      // sıradaki fon tipine geç
    }
  }

  const out = {
    code,
    price: result ? result.price : null,
    date: result ? result.date : new Date().toISOString().slice(0, 10),
    source: "tefas",
  };
  if (out.price != null) setCached(cacheKey, out, TTL);
  else out.error = "not_found";
  return out;
}

// Sağlık kontrolü: örnek bir fonu çeker (uç çalışıyor mu?).
export async function getSample(sampleCode = "AFA") {
  return getFundPrice(sampleCode);
}

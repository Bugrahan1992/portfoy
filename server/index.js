import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { getMarket, getMarketRaw } from "./sources/market.js";
import { getFundPrice } from "./sources/tefas.js";
import { getCds } from "./sources/cds.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

// USD / EUR / gram altın / BIST100 (+ CDS varsa)
app.get("/api/market", async (req, res) => {
  try {
    const m = await getMarket();
    let cds = null;
    try { cds = await getCds(); } catch (e) { /* yoksay */ }
    res.json({ ...m, cds });
  } catch (e) {
    res.status(502).json({ error: "market_unavailable", detail: String(e.message || e) });
  }
});

// Ham kaynak (alan adları değişirse parser'ı düzeltmek için)
app.get("/api/market/raw", async (req, res) => {
  try { res.json(await getMarketRaw()); }
  catch (e) { res.status(502).json({ error: "raw_unavailable" }); }
});

// TEFAS fon fiyatı: /api/tefas/AFA
app.get("/api/tefas/:code", async (req, res) => {
  try { res.json(await getFundPrice(req.params.code)); }
  catch (e) { res.json({ code: req.params.code, price: null, error: "fetch_failed" }); }
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Derlenmiş frontend'i (web/dist) servis et — tek origin, CORS yok.
const dist = path.join(__dirname, "..", "web", "dist");
app.use(express.static(dist));
app.get("*", (req, res) => res.sendFile(path.join(dist, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Portföy sunucusu çalışıyor: http://localhost:" + PORT));

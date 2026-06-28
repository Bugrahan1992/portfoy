import React, { useEffect, useMemo, useState } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Coins, TrendingUp, TrendingDown, Plus, Pencil, Trash2,
  X, CalendarDays, RotateCcw, Check, Wallet, RefreshCw, Zap,
} from "lucide-react";
import { fetchMarket, fetchFund } from "./api.js";

const STORE_KEY = "portfolio:v2";

const CATS = {
  "Altın": "#f59e0b",
  "TEFAS Fonu": "#38bdf8",
  "BES": "#a78bfa",
  "Hayat Sigortası": "#818cf8",
  "Eurobond": "#34d399",
  "GYO": "#fb7185",
  "Hisse Senedi": "#22d3ee",
  "Döviz / Nakit": "#2dd4bf",
  "Diğer": "#94a3b8",
};
const CAT_LIST = Object.keys(CATS);

const fmtMoney = (n, cur, dec = 0) => {
  const sym = cur === "USD" ? "$" : "₺";
  const v = isFinite(n) ? n : 0;
  return sym + v.toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};
const fmtPct = (n) => {
  const v = isFinite(n) ? n : 0;
  return (v >= 0 ? "+" : "") + v.toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
};
const fmtNum = (n, dec = 2) => (isFinite(n) ? Number(n).toLocaleString("tr-TR", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : "—");
const todayStr = () => new Date().toISOString().slice(0, 10);
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const holdingValue = (h) => {
  const q = Number(h.miktar) || 0;
  const p = Number(h.birimFiyat) || 0;
  if (q > 0 && p > 0) return q * p;
  return Number(h.value) || 0;
};

function loadState() {
  try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}
function saveState(obj) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch (e) { /* sessiz */ }
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [holdings, setHoldings] = useState([]);
  const [contributions, setContributions] = useState([]);
  const [usdtry, setUsdtry] = useState(40);   // hem kur hem USD fiyatı
  const [eur, setEur] = useState(43);          // EUR/TRY
  const [gramAltin, setGramAltin] = useState(0);
  const [bist100, setBist100] = useState(0);
  const [cds, setCds] = useState("");          // elle girilir (bps)
  const [lastUpdated, setLastUpdated] = useState(null);

  const [cur, setCur] = useState("TRY");
  const [tab, setTab] = useState("assets");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState("");
  const [editingCds, setEditingCds] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ad: "", tur: "TEFAS Fonu", cur: "TRY", maliyet: "", miktar: "", birimFiyat: "", value: "", live: false, sembol: "" });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [contForm, setContForm] = useState({ date: todayStr(), amount: "", note: "" });
  const [confirmContId, setConfirmContId] = useState(null);

  const seed = () => {
    setHoldings([
      { id: genId(), ad: "Gram Altın", tur: "Altın", cur: "TRY", maliyet: 20000, miktar: 8, birimFiyat: 3062.5, value: 0, live: true, sembol: "" },
      { id: genId(), ad: "AK Portföy Altın Fonu", tur: "TEFAS Fonu", cur: "TRY", maliyet: 15000, miktar: 100000, birimFiyat: 0.182, value: 0, live: true, sembol: "AFA" },
      { id: genId(), ad: "BES Birikimi", tur: "BES", cur: "TRY", maliyet: 35000, miktar: 0, birimFiyat: 0, value: 41300, live: false, sembol: "" },
      { id: genId(), ad: "Hayat Sigortası Poliçesi", tur: "Hayat Sigortası", cur: "TRY", maliyet: 12000, miktar: 0, birimFiyat: 0, value: 13100, live: false, sembol: "" },
      { id: genId(), ad: "Türkiye 2030 Eurobond", tur: "Eurobond", cur: "USD", maliyet: 1000, miktar: 0, birimFiyat: 0, value: 1080, live: false, sembol: "" },
      { id: genId(), ad: "USD Nakit", tur: "Döviz / Nakit", cur: "USD", maliyet: 500, miktar: 0, birimFiyat: 0, value: 500, live: false, sembol: "" },
    ]);
    setContributions([
      { id: genId(), date: "2026-04-01", amount: 5000, note: "Aylık fon alımı" },
      { id: genId(), date: "2026-05-01", amount: 5000, note: "Aylık fon alımı" },
      { id: genId(), date: "2026-06-01", amount: 6000, note: "Fon + altın" },
    ]);
  };

  // Yükle
  useEffect(() => {
    const s = loadState();
    if (s) {
      setHoldings(s.holdings || []);
      setContributions(s.contributions || []);
      setUsdtry(s.usdtry ?? 40);
      setEur(s.eur ?? 43);
      setGramAltin(s.gramAltin ?? 0);
      setBist100(s.bist100 ?? 0);
      setCds(s.cds ?? "");
      setLastUpdated(s.lastUpdated ?? null);
    } else {
      seed();
    }
    setLoaded(true);
  }, []);

  // Kaydet
  useEffect(() => {
    if (!loaded) return;
    saveState({ holdings, contributions, usdtry, eur, gramAltin, bist100, cds, lastUpdated });
  }, [holdings, contributions, usdtry, eur, gramAltin, bist100, cds, lastUpdated, loaded]);

  const rate = usdtry > 0 ? usdtry : 1;
  const toTRY = (amt, c) => (c === "USD" ? amt * rate : amt);
  const toCur = (amtTRY) => (cur === "TRY" ? amtTRY : amtTRY / rate);
  const otherCur = cur === "TRY" ? "USD" : "TRY";

  const stats = useMemo(() => {
    let costTRY = 0, valTRY = 0;
    const byCat = {};
    holdings.forEach((h) => {
      const cv = holdingValue(h);
      const v = toTRY(cv, h.cur);
      const c = toTRY(Number(h.maliyet) > 0 ? Number(h.maliyet) : cv, h.cur);
      costTRY += c; valTRY += v;
      byCat[h.tur] = (byCat[h.tur] || 0) + v;
    });
    const plTRY = valTRY - costTRY;
    const plPct = costTRY > 0 ? (plTRY / costTRY) * 100 : 0;
    const alloc = Object.entries(byCat)
      .map(([k, v]) => ({ key: k, color: CATS[k] || "#94a3b8", valTRY: v, pct: valTRY > 0 ? (v / valTRY) * 100 : 0 }))
      .sort((a, b) => b.valTRY - a.valTRY);
    return { costTRY, valTRY, plTRY, plPct, alloc, biggest: alloc[0] };
  }, [holdings, rate]);

  const dca = useMemo(() => {
    const sorted = [...contributions].sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    const series = sorted.map((c) => {
      run += Number(c.amount) || 0;
      const d = new Date(c.date);
      return { name: d.toLocaleDateString("tr-TR", { month: "short", year: "2-digit" }), kumulatif: run };
    });
    const now = new Date();
    const thisMonth = contributions
      .filter((c) => { const d = new Date(c.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
      .reduce((s, c) => s + (Number(c.amount) || 0), 0);
    return { series, total: run, thisMonth, sortedDesc: [...sorted].reverse() };
  }, [contributions]);

  // --- Canlı güncelleme (backend'den) ---
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshMsg("");
    let market = null;
    try { market = await fetchMarket(); }
    catch (e) { setRefreshMsg("Piyasa verisi alınamadı — sunucu uyanıyor olabilir, birkaç saniye sonra tekrar dene."); setRefreshing(false); return; }

    if (market.usd) setUsdtry(market.usd);
    if (market.eur) setEur(market.eur);
    if (market.gramAltin) setGramAltin(market.gramAltin);
    if (market.bist100) setBist100(market.bist100);
    if (market.cds != null) setCds(String(market.cds));

    // Canlı işaretli fonları çek
    const live = holdings.filter((h) => h.live && h.tur === "TEFAS Fonu" && h.sembol && Number(h.miktar) > 0);
    const fundPrices = {};
    let missed = 0;
    for (const h of live) {
      try {
        const res = await fetchFund(h.sembol);
        if (res && res.price != null) fundPrices[h.id] = Number(res.price);
        else missed++;
      } catch (e) { missed++; }
    }

    setHoldings((prev) => prev.map((h) => {
      if (!h.live) return h;
      const q = Number(h.miktar) || 0;
      let unit = null;
      if (h.tur === "Altın") unit = market.gramAltin || null;
      else if (fundPrices[h.id] != null) unit = fundPrices[h.id];
      if (unit != null && q > 0) return { ...h, birimFiyat: unit, value: q * unit };
      return h;
    }));

    setLastUpdated(new Date().toISOString());
    if (missed > 0) setRefreshMsg(`${missed} fon fiyatı çekilemedi (TEFAS sınırı veya kod hatası olabilir) — bu kalemleri elle güncelleyebilirsin.`);
    setRefreshing(false);
  };

  const openAdd = () => { setEditingId(null); setForm({ ad: "", tur: "TEFAS Fonu", cur: "TRY", maliyet: "", miktar: "", birimFiyat: "", value: "", live: false, sembol: "" }); setModalOpen(true); };
  const openEdit = (h) => { setEditingId(h.id); setForm({ ad: h.ad, tur: h.tur, cur: h.cur, maliyet: h.maliyet ? String(h.maliyet) : "", miktar: h.miktar ? String(h.miktar) : "", birimFiyat: h.birimFiyat ? String(h.birimFiyat) : "", value: h.value ? String(h.value) : "", live: !!h.live, sembol: h.sembol || "" }); setModalOpen(true); };
  const saveHolding = () => {
    if (!form.ad.trim()) return;
    const item = {
      id: editingId || genId(),
      ad: form.ad.trim(), tur: form.tur, cur: form.cur,
      maliyet: parseFloat(form.maliyet) || 0,
      miktar: parseFloat(form.miktar) || 0,
      birimFiyat: parseFloat(form.birimFiyat) || 0,
      value: parseFloat(form.value) || 0,
      live: !!form.live, sembol: form.sembol.trim(),
    };
    setHoldings((prev) => editingId ? prev.map((h) => (h.id === editingId ? item : h)) : [...prev, item]);
    setModalOpen(false);
  };
  const delHolding = (id) => { setHoldings((p) => p.filter((h) => h.id !== id)); setConfirmDeleteId(null); };
  const addCont = () => {
    const amt = parseFloat(contForm.amount);
    if (!amt) return;
    setContributions((p) => [...p, { id: genId(), date: contForm.date || todayStr(), amount: amt, note: contForm.note.trim() }]);
    setContForm({ date: todayStr(), amount: "", note: "" });
  };
  const delCont = (id) => { setContributions((p) => p.filter((c) => c.id !== id)); setConfirmContId(null); };
  const clearAll = () => { setHoldings([]); setContributions([]); setConfirmClear(false); };

  const inputCls = "w-full bg-stone-950 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 placeholder-stone-500 focus:border-amber-500";
  const labelCls = "block text-xs uppercase tracking-wider text-stone-400 mb-1.5";
  const lastStr = lastUpdated ? new Date(lastUpdated).toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">

        {/* Header */}
        <header className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6 text-stone-950" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-50 leading-tight">Portföy</h1>
              <p className="text-xs text-stone-500">{lastStr ? `Son güncelleme: ${lastStr}` : "Tek ekranda servet takibi · ₺ & $"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-stone-400">USD/TRY</span>
              <input type="number" step="0.01" value={usdtry} onChange={(e) => setUsdtry(parseFloat(e.target.value) || 0)}
                className="w-16 bg-transparent text-stone-100 text-sm font-semibold tabular-nums focus:text-amber-400" />
            </div>
            <div className="flex rounded-full bg-stone-900 border border-stone-800 p-1">
              {["TRY", "USD"].map((c) => (
                <button key={c} onClick={() => setCur(c)}
                  className={"px-3 py-1.5 rounded-full text-sm font-semibold transition-colors " + (cur === c ? "bg-amber-500 text-stone-950" : "text-stone-400")}>
                  {c === "TRY" ? "₺ TL" : "$ USD"}
                </button>
              ))}
            </div>
            <button onClick={refresh} disabled={refreshing}
              className="flex items-center gap-1.5 bg-stone-900 border border-stone-700 text-stone-100 text-sm font-semibold rounded-xl px-3 py-2 hover:border-amber-500 transition-colors disabled:opacity-60">
              <RefreshCw className={"w-4 h-4 text-amber-400 " + (refreshing ? "animate-spin" : "")} />
              {refreshing ? "Güncelleniyor" : "Güncelle"}
            </button>
          </div>
        </header>

        {/* Piyasa şeridi */}
        <div className="flex flex-wrap gap-2 mb-5">
          <Ticker label="USD" value={"₺" + fmtNum(usdtry)} />
          <Ticker label="EUR" value={"₺" + fmtNum(eur)} />
          <Ticker label="Gram Altın" value={gramAltin ? "₺" + fmtNum(gramAltin) : "—"} />
          <Ticker label="BIST 100" value={bist100 ? fmtNum(bist100, 0) : "—"} />
          {/* CDS elle girilir */}
          <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5">
            <span className="text-xs text-stone-500 uppercase tracking-wide">CDS 5Y</span>
            {editingCds ? (
              <input
                autoFocus type="number" value={cds}
                onChange={(e) => setCds(e.target.value)}
                onBlur={() => setEditingCds(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingCds(false); }}
                className="w-16 bg-transparent text-stone-100 text-sm font-semibold tabular-nums" placeholder="bps"
              />
            ) : (
              <button onClick={() => setEditingCds(true)} className="text-sm font-semibold text-stone-200 tabular-nums hover:text-amber-400" title="Elle gir">
                {cds ? `${cds} bps` : "gir"} <Pencil className="w-3 h-3 inline-block ml-0.5 text-stone-500" />
              </button>
            )}
          </div>
        </div>

        {refreshMsg && (
          <div className="mb-5 rounded-xl border border-stone-800 bg-stone-900 px-4 py-2.5 text-sm text-stone-400">{refreshMsg}</div>
        )}

        {!loaded ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-stone-700 border-t-amber-500 animate-spin" />
            <p className="text-stone-500 text-sm">Yükleniyor…</p>
          </div>
        ) : (
          <>
            {/* HERO */}
            <section className="fade-up rounded-2xl border border-stone-800 bg-gradient-to-br from-stone-900 to-stone-950 p-6 sm:p-7 mb-5">
              <p className="text-xs uppercase tracking-widest text-stone-500 mb-2">Toplam Portföy Değeri</p>
              <div className="flex items-end gap-4 flex-wrap">
                <div className="text-4xl sm:text-5xl font-bold tabular-nums text-stone-50 tracking-tight">{fmtMoney(toCur(stats.valTRY), cur)}</div>
                <PLPill plPct={stats.plPct} plAbs={fmtMoney(toCur(stats.plTRY), cur)} />
              </div>
              <div className="h-1 w-16 bg-amber-500 rounded-full mt-3 mb-2" />
              <p className="text-sm text-stone-400 tabular-nums">≈ {fmtMoney(otherCur === "USD" ? stats.valTRY / rate : stats.valTRY, otherCur)} <span className="text-stone-600">({otherCur})</span></p>

              {stats.alloc.length > 0 && (
                <div className="mt-6">
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-stone-800">
                    {stats.alloc.map((a) => (<div key={a.key} style={{ width: a.pct + "%", backgroundColor: a.color }} title={`${a.key} · %${a.pct.toFixed(0)}`} />))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
                    {stats.alloc.map((a) => (
                      <span key={a.key} className="flex items-center gap-1.5 text-xs text-stone-400">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.key} <span className="text-stone-500 tabular-nums">%{a.pct.toFixed(0)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Metrik kartları */}
            <section className="fade-up grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6" style={{ animationDelay: ".05s" }}>
              <MetricCard label="Toplam Maliyet" value={fmtMoney(toCur(stats.costTRY), cur)} icon={<Wallet className="w-4 h-4" />} />
              <MetricCard label="Toplam Kâr / Zarar" value={fmtMoney(toCur(stats.plTRY), cur)} sub={fmtPct(stats.plPct)}
                tone={stats.plTRY >= 0 ? "up" : "down"} icon={stats.plTRY >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} />
              <MetricCard label="En Büyük Kalem" value={stats.biggest ? stats.biggest.key : "—"} sub={stats.biggest ? `%${stats.biggest.pct.toFixed(0)}` : ""} dot={stats.biggest ? stats.biggest.color : null} />
            </section>

            <nav className="flex gap-6 border-b border-stone-800 mb-6">
              {[["assets", "Varlıklar"], ["dca", "Aylık Alımlar"]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={"pb-3 text-sm font-semibold border-b-2 -mb-px transition-colors " + (tab === k ? "text-amber-400 border-amber-500" : "text-stone-500 border-transparent")}>{label}</button>
              ))}
            </nav>

            {tab === "assets" ? (
              <section className="fade-up grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm uppercase tracking-wider text-stone-400">Varlıklar</h2>
                    <button onClick={openAdd} className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors">
                      <Plus className="w-4 h-4" /> Varlık ekle
                    </button>
                  </div>

                  {holdings.length === 0 ? (
                    <EmptyState onAdd={openAdd} onSeed={seed} />
                  ) : (
                    <div className="rounded-2xl border border-stone-800 bg-stone-900 divide-y divide-stone-800 overflow-hidden">
                      {holdings.map((h) => {
                        const cv = holdingValue(h);
                        const valTRY = toTRY(cv, h.cur);
                        const costTRY = toTRY(Number(h.maliyet) > 0 ? Number(h.maliyet) : cv, h.cur);
                        const pl = valTRY - costTRY;
                        const pct = costTRY > 0 ? (pl / costTRY) * 100 : 0;
                        return (
                          <div key={h.id} className="flex items-center gap-3 px-4 py-3.5">
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: CATS[h.tur] || "#94a3b8" }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-stone-100 font-medium truncate">{h.ad}</p>
                                {h.live && <span className="flex items-center gap-0.5 text-amber-400 text-xs font-semibold uppercase tracking-wide shrink-0"><Zap className="w-3 h-3" />canlı</span>}
                              </div>
                              <p className="text-xs text-stone-500">{h.tur} · {h.cur}{Number(h.miktar) > 0 ? ` · ${Number(h.miktar).toLocaleString("tr-TR")} ad./gr` : ""}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-stone-100 font-semibold tabular-nums">{fmtMoney(toCur(valTRY), cur)}</p>
                              <p className={"text-xs tabular-nums " + (pl >= 0 ? "text-emerald-400" : "text-rose-400")}>{fmtPct(pct)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {confirmDeleteId === h.id ? (
                                <>
                                  <button onClick={() => delHolding(h.id)} className="p-1.5 rounded-md text-rose-300 hover:bg-rose-950" title="Sil"><Check className="w-4 h-4" /></button>
                                  <button onClick={() => setConfirmDeleteId(null)} className="p-1.5 rounded-md text-stone-400 hover:bg-stone-800" title="Vazgeç"><X className="w-4 h-4" /></button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => openEdit(h)} className="p-1.5 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-800" title="Düzenle"><Pencil className="w-4 h-4" /></button>
                                  <button onClick={() => setConfirmDeleteId(h.id)} className="p-1.5 rounded-md text-stone-400 hover:text-rose-400 hover:bg-stone-800" title="Sil"><Trash2 className="w-4 h-4" /></button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {holdings.length > 0 && (
                    <div className="mt-3">
                      {confirmClear ? (
                        <span className="text-xs text-stone-400 flex items-center gap-2">
                          Tüm veriler silinsin mi?
                          <button onClick={clearAll} className="text-rose-400 hover:underline">Evet, sil</button>
                          <button onClick={() => setConfirmClear(false)} className="text-stone-400 hover:underline">Vazgeç</button>
                        </span>
                      ) : (
                        <button onClick={() => setConfirmClear(true)} className="text-xs text-stone-500 hover:text-rose-400 flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Tümünü temizle</button>
                      )}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-1">
                  <h2 className="text-sm uppercase tracking-wider text-stone-400 mb-4">Varlık Dağılımı</h2>
                  <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                    {stats.alloc.length === 0 ? (
                      <p className="text-stone-500 text-sm text-center py-10">Henüz veri yok.</p>
                    ) : (
                      <>
                        <div className="relative h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={stats.alloc} dataKey="valTRY" nameKey="key" cx="50%" cy="50%" innerRadius={56} outerRadius={82} paddingAngle={2} stroke="none">
                                {stats.alloc.map((a) => (<Cell key={a.key} fill={a.color} />))}
                              </Pie>
                              <Tooltip formatter={(v) => fmtMoney(toCur(v), cur)} contentStyle={{ background: "#1c1917", border: "1px solid #44403c", borderRadius: 12, color: "#e7e5e4" }} itemStyle={{ color: "#e7e5e4" }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-stone-500">Toplam</span>
                            <span className="text-base font-bold text-stone-100 tabular-nums">{fmtMoney(toCur(stats.valTRY), cur)}</span>
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          {stats.alloc.map((a) => (
                            <div key={a.key} className="flex items-center gap-2 text-sm">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                              <span className="text-stone-300 flex-1 truncate">{a.key}</span>
                              <span className="text-stone-500 tabular-nums">%{a.pct.toFixed(0)}</span>
                              <span className="text-stone-200 tabular-nums w-24 text-right">{fmtMoney(toCur(a.valTRY), cur)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>
            ) : (
              <section className="fade-up grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard label="Bu Ay Alım" value={fmtMoney(toCur(dca.thisMonth), cur)} icon={<CalendarDays className="w-4 h-4" />} />
                    <MetricCard label="Toplam Alım (Kümülatif)" value={fmtMoney(toCur(dca.total), cur)} icon={<Coins className="w-4 h-4" />} />
                  </div>
                  <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
                    <h2 className="text-sm uppercase tracking-wider text-stone-400 mb-4">Kümülatif Birikim</h2>
                    {dca.series.length === 0 ? (
                      <p className="text-stone-500 text-sm text-center py-10">Henüz alım kaydı yok.</p>
                    ) : (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dca.series} margin={{ top: 6, right: 6, left: -10, bottom: 0 }}>
                            <defs>
                              <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.5} />
                                <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#292524" vertical={false} />
                            <XAxis dataKey="name" stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis stroke="#78716c" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => (toCur(v) / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 0 }) + "B"} />
                            <Tooltip formatter={(v) => [fmtMoney(toCur(v), cur), "Kümülatif"]} contentStyle={{ background: "#1c1917", border: "1px solid #44403c", borderRadius: 12, color: "#e7e5e4" }} itemStyle={{ color: "#e7e5e4" }} labelStyle={{ color: "#a8a29e" }} />
                            <Area type="monotone" dataKey="kumulatif" stroke="#f59e0b" strokeWidth={2} fill="url(#gold)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {dca.sortedDesc.length > 0 && (
                    <div className="rounded-2xl border border-stone-800 bg-stone-900 divide-y divide-stone-800 overflow-hidden">
                      {dca.sortedDesc.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                          <CalendarDays className="w-4 h-4 text-stone-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-stone-100 text-sm">{new Date(c.date).toLocaleDateString("tr-TR")}</p>
                            {c.note && <p className="text-xs text-stone-500 truncate">{c.note}</p>}
                          </div>
                          <span className="text-stone-100 font-semibold tabular-nums">{fmtMoney(toCur(Number(c.amount)), cur)}</span>
                          {confirmContId === c.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => delCont(c.id)} className="p-1.5 rounded-md text-rose-300 hover:bg-rose-950"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setConfirmContId(null)} className="p-1.5 rounded-md text-stone-400 hover:bg-stone-800"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmContId(c.id)} className="p-1.5 rounded-md text-stone-400 hover:text-rose-400 hover:bg-stone-800"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="lg:col-span-1">
                  <h2 className="text-sm uppercase tracking-wider text-stone-400 mb-4">Alım Ekle</h2>
                  <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5 space-y-4">
                    <div><label className={labelCls}>Tarih</label><input type="date" value={contForm.date} onChange={(e) => setContForm({ ...contForm, date: e.target.value })} className={inputCls} /></div>
                    <div><label className={labelCls}>Tutar (₺)</label><input type="number" placeholder="örn. 5000" value={contForm.amount} onChange={(e) => setContForm({ ...contForm, amount: e.target.value })} className={inputCls + " tabular-nums"} /></div>
                    <div><label className={labelCls}>Açıklama (opsiyonel)</label><input type="text" placeholder="örn. fon + altın" value={contForm.note} onChange={(e) => setContForm({ ...contForm, note: e.target.value })} className={inputCls} /></div>
                    <button onClick={addCont} className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg py-2.5 transition-colors"><Plus className="w-4 h-4" /> Ekle</button>
                    <p className="text-xs text-stone-500 leading-relaxed">Aylık alımlarını buraya işle; düzenli birikim eğrini yukarıda gör.</p>
                  </div>
                </div>
              </section>
            )}

            <p className="text-xs text-stone-600 mt-10 text-center leading-relaxed">
              Kişisel takip ve görselleştirme aracı; yatırım tavsiyesi değildir. Canlı veriler dış kaynaklardan derlenir; hata payı olabilir, kritik kararlarda resmi kaynaktan doğrula.
            </p>
          </>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onClick={() => setModalOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-stone-700 bg-stone-900 p-6 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-stone-50">{editingId ? "Varlığı düzenle" : "Yeni varlık"}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-md text-stone-400 hover:bg-stone-800"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div><label className={labelCls}>Varlık adı</label><input type="text" placeholder="örn. Gram Altın" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} className={inputCls} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Tür</label>
                  <select value={form.tur} onChange={(e) => setForm({ ...form, tur: e.target.value })} className={inputCls}>{CAT_LIST.map((c) => (<option key={c} value={c}>{c}</option>))}</select>
                </div>
                <div><label className={labelCls}>Para birimi</label>
                  <select value={form.cur} onChange={(e) => setForm({ ...form, cur: e.target.value })} className={inputCls}><option value="TRY">₺ TL</option><option value="USD">$ USD</option></select>
                </div>
              </div>

              <div><label className={labelCls}>Maliyet (yatırdığın tutar)</label><input type="number" placeholder="0" value={form.maliyet} onChange={(e) => setForm({ ...form, maliyet: e.target.value })} className={inputCls + " tabular-nums"} /></div>

              <p className="text-xs uppercase tracking-wider text-stone-500 border-t border-stone-800 mt-1 pt-3">Güncel değer</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Miktar (adet/gram)</label><input type="number" placeholder="opsiyonel" value={form.miktar} onChange={(e) => setForm({ ...form, miktar: e.target.value })} className={inputCls + " tabular-nums"} /></div>
                <div><label className={labelCls}>Birim fiyat</label><input type="number" placeholder="opsiyonel" value={form.birimFiyat} onChange={(e) => setForm({ ...form, birimFiyat: e.target.value })} className={inputCls + " tabular-nums"} /></div>
              </div>
              <div><label className={labelCls}>veya Toplam güncel değer</label><input type="number" placeholder="miktar×fiyat boşsa burayı doldur" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className={inputCls + " tabular-nums"} /></div>

              <div className="rounded-xl border border-stone-800 bg-stone-950 p-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.live} onChange={(e) => setForm({ ...form, live: e.target.checked })} className="w-4 h-4 accent-amber-500" />
                  <span className="text-sm text-stone-200 font-medium flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-400" /> Canlı fiyat çek</span>
                </label>
                {form.live && (
                  <div className="mt-3">
                    {form.tur === "Altın" ? (
                      <p className="text-xs text-stone-500">Altın için sembol gerekmez; gram fiyatı otomatik çekilir. <span className="text-stone-400">Miktarı (gram) girmen yeterli.</span></p>
                    ) : form.tur === "TEFAS Fonu" ? (
                      <>
                        <label className={labelCls}>Fon kodu</label>
                        <input type="text" placeholder="örn. AFA" value={form.sembol} onChange={(e) => setForm({ ...form, sembol: e.target.value.toUpperCase() })} className={inputCls} />
                        <p className="text-xs text-stone-500 mt-1.5">Çekimin çalışması için <span className="text-stone-400">miktar (pay) + fon kodu</span> dolu olmalı.</p>
                      </>
                    ) : (
                      <p className="text-xs text-stone-500">Bu tür için otomatik fiyat henüz yok; değeri elle güncelle. (İleride backend'e kaynak eklenebilir.)</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setModalOpen(false)} className="flex-1 border border-stone-700 text-stone-300 rounded-lg py-2.5 hover:bg-stone-800 transition-colors">Vazgeç</button>
                <button onClick={saveHolding} className="flex-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg py-2.5 transition-colors">Kaydet</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Ticker({ label, value }) {
  return (
    <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl px-3 py-1.5">
      <span className="text-xs text-stone-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold text-stone-200 tabular-nums">{value}</span>
    </div>
  );
}

function PLPill({ plPct, plAbs }) {
  const up = plPct >= 0;
  return (
    <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold tabular-nums " + (up ? "bg-emerald-950 text-emerald-300 border-emerald-800" : "bg-rose-950 text-rose-300 border-rose-900")}>
      {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      {fmtPct(plPct)} <span className="text-stone-400 font-normal">·</span> {plAbs}
    </span>
  );
}

function MetricCard({ label, value, sub, tone, icon, dot }) {
  const toneCls = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-stone-50";
  return (
    <div className="card-hover rounded-xl border border-stone-800 bg-stone-900 p-4 hover:border-stone-700">
      <div className="flex items-center gap-2 text-stone-500 mb-2">{icon}<span className="text-xs uppercase tracking-wider">{label}</span></div>
      <div className="flex items-center gap-2">
        {dot && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dot }} />}
        <span className={"text-xl font-bold tabular-nums truncate " + toneCls}>{value}</span>
      </div>
      {sub && <p className={"text-sm mt-0.5 tabular-nums " + (tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-stone-500")}>{sub}</p>}
    </div>
  );
}

function EmptyState({ onAdd, onSeed }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-700 bg-stone-900 p-10 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-800 flex items-center justify-center mx-auto mb-4"><Wallet className="w-6 h-6 text-stone-500" /></div>
      <p className="text-stone-300 font-medium mb-1">Henüz varlık yok</p>
      <p className="text-stone-500 text-sm mb-5">İlk varlığını ekle ya da örnek verilerle başla.</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onAdd} className="bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg px-4 py-2 transition-colors">Varlık ekle</button>
        <button onClick={onSeed} className="border border-stone-700 text-stone-300 rounded-lg px-4 py-2 hover:bg-stone-800 transition-colors">Örnek verilerle doldur</button>
      </div>
    </div>
  );
}

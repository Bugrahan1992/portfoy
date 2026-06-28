# Portföy — kişisel servet takip uygulaması

Dağınık varlıklarını (BES, hayat sigortası, TEFAS fonu, altın, Eurobond, döviz)
**tek ekranda**, hem **₺ hem $** bazlı toplayan; canlı kur/altın/fon verisi çeken,
telefona **uygulama gibi kurulabilen (PWA)** bir panel.

> Kişisel takip ve görselleştirme aracıdır; **yatırım tavsiyesi değildir.**

---

## Ne çalışıyor, neyin sınırı var (dürüst tablo)

| Veri | Durum | Kaynak |
|---|---|---|
| USD/TRY, EUR/TRY | ✅ Otomatik | Truncgil (anahtarsız JSON) |
| Gram altın | ✅ Otomatik | Truncgil |
| BIST 100 | ✅ Otomatik | Truncgil |
| TEFAS fon fiyatı | ⚠️ Otomatik (en iyi çaba) | TEFAS yeni `api/funds` ucu |
| CDS 5Y | ✋ Elle giriş | Temiz ücretsiz kaynak yok |
| BES / Hayat sigortası / Eurobond | ✋ Elle giriş | Tek tip API yok |

- **TEFAS:** Nisan 2026'da TEFAS altyapısını yeniledi ve eski `BindHistoryInfo`
  ucunu kaldırdı. Kod yeni `tefas.gov.tr/api/funds/...` ucunu kullanır ve günde bir
  önbelleğe alır (TEFAS dakikada ~6 istek sınırı uygular). Uç ileride yine değişirse
  fon fiyatı boş dönebilir; o zaman ilgili kalemi **elle** güncellersin. Kalıcı çözüm
  için `server/sources/tefas.js` içindeki **FALLBACK (Fonoloji)** notuna bak.
- **CDS:** Uygulamadaki üstteki "CDS 5Y" kutusuna tıklayıp değeri elle yazarsın.

Önemlisi: **her şey elle de çalışır.** Otomatik veri gelmezse panel manuel değerlerle
sorunsuz devam eder.

---

## Klasör yapısı

```
portfoy-app/
├─ package.json          # kök: express + build/start betikleri
├─ render.yaml           # Render için hazır yapılandırma
├─ server/               # veri servisi (backend)
│  ├─ index.js           # /api uçları + frontend'i servis eder
│  ├─ cache.js           # basit önbellek
│  └─ sources/
│     ├─ market.js       # USD/EUR/gram altın/BIST100 (Truncgil)
│     ├─ tefas.js        # TEFAS fon fiyatı (yeni uç)
│     └─ cds.js          # CDS (şimdilik elle)
└─ web/                  # frontend (Vite + React + Tailwind, PWA)
   ├─ src/App.jsx        # panelin kendisi
   └─ public/            # manifest, servis çalışanı, ikonlar
```

Veriler **telefonunda/tarayıcında** (localStorage) saklanır; sunucuya gönderilmez.

---

## Yayınlama — adım adım (kod bilmeyen için)

Hedef: ücretsiz **Render** üzerinde tek bir adres. Kredi kartı gerekmez, API anahtarı
gerekmez. İki hesap açman yeterli (bunları **senin** açman gerekir, ben senin yerine
giriş/şifre işlemi yapamam):

**1) GitHub hesabı + repo**
- github.com → ücretsiz hesap aç.
- Sağ üstte **+ → New repository** → ad ver (ör. `portfoy`) → **Create**.
- Açılan sayfada **uploading an existing file** bağlantısına tıkla.
- Bu `portfoy-app` klasörünün **içindeki** tüm dosya/klasörleri sürükleyip bırak
  (klasörü değil, içindekileri). **Commit changes** de.
  - (`node_modules` veya `dist` varsa yükleme; zaten `.gitignore` onları dışlar.)

**2) Render'a bağla**
- render.com → **GitHub ile giriş yap**.
- **New + → Blueprint** seç → az önceki repoyu seç.
  - Render `render.yaml`'ı okur; ayarlar otomatik gelir. **Apply** de.
  - (Blueprint görünmezse: **New + → Web Service** → repoyu seç → şu ayarları gir:
    Build Command `npm install && npm run build`, Start Command `npm start`, Plan **Free**.)
- Birkaç dakikada derlenir; sana `https://portfoy-xxxx.onrender.com` gibi bir adres verir.

**3) Telefona kur (PWA)**
- Adresi telefon tarayıcısında aç.
- iPhone (Safari): Paylaş → **Ana Ekrana Ekle**.
- Android (Chrome): menü → **Uygulamayı yükle** / **Ana ekrana ekle**.
- Artık simgesinden bir uygulama gibi açılır.

> Not: Ücretsiz Render servisi ~15 dk kullanılmazsa uykuya geçer; ilk açılışta birkaç
> saniye "uyanır". Panel bunu görürse "Güncelle"yi tekrar denemeni söyler.

---

## İlk kullanım

1. Üstte bugünkü **USD/TRY** kuru yazılı gelir; **Güncelle**'ye basınca kur, EUR,
   gram altın ve BIST 100 gerçek değerlerine güncellenir.
2. Örnek veriler yüklüdür. "Tümünü temizle" deyip kendi varlıklarını ekle.
3. **TEFAS fonu** eklerken: Tür = *TEFAS Fonu*, **Maliyet**, **Miktar (pay)** ve
   **Canlı fiyat çek** + **Fon kodu** (ör. AFA). "Güncelle" o fonu da çeker.
4. **Altın** için sadece **Miktar (gram)** + Canlı yeterli.
5. **CDS**'i üstteki kutudan elle gir.

---

## Geliştirici notu (opsiyonel — yerelde çalıştırmak için)

```bash
# 1) kök bağımlılıklar + frontend build
npm install
npm run build
# 2) sunucuyu başlat (http://localhost:3000)
npm start
```

Geliştirme modunda (canlı yeniden yükleme) iki terminal:
```bash
# terminal 1: backend
npm start
# terminal 2: frontend (proxy ile /api -> localhost:3000)
cd web && npm install && npm run dev
```

Bu projeyi **Claude Code** içinde açarsan, uçları gerçek zamanlı test edip
(örn. TEFAS uç parametrelerini) anında düzeltmek çok kolay olur.

---

## Sorun giderme

- **"Piyasa verisi alınamadı":** Render uykudaysa ilk istekte olur; birkaç saniye sonra
  tekrar "Güncelle".
- **Fon fiyatı gelmiyor:** TEFAS sınırı/format değişikliği olabilir. `/api/tefas/AFA`
  adresini tarayıcıda açıp ne döndüğüne bak; gerekiyorsa `server/sources/tefas.js`'i
  güncelle veya Fonoloji fallback'ine geç. Bu arada kalemi elle güncelleyebilirsin.
- **Kur/altın yanlış alan:** `/api/market/raw` ham JSON'u gösterir; alan adları
  değişmişse `server/sources/market.js` içindeki `pick(...)` desenlerini düzelt.

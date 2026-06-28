// Türkiye 5Y CDS (kredi temerrüt takası, baz puan).
//
// DÜRÜST DURUM: CDS'in temiz/ücretsiz/anahtarsız bir API'si YOK.
// Investing.com, TradingEconomics gibi yerlerde yayınlanır ama bunlar
// ya giriş/anahtar ister ya da kazımayı (scraping) engeller.
//
// Bu yüzden uygulamada CDS'i ELLE girilen bir gösterge olarak tutuyoruz
// (uygulamadaki "CDS" kutusuna tıklayıp güncelliyorsun).
// Aşağıdaki fonksiyon ileride bir kaynak eklemek istersen yer tutucudur;
// şu an güvenilir bir değer döndüremediği için null veriyor.
export async function getCds() {
  // İleride buraya keyli bir kaynak (ör. bir veri sağlayıcı) bağlanabilir.
  // Şimdilik elle giriş esas; otomatik değer yok.
  return null;
}

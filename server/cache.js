// Basit TTL önbellek. TEFAS dakikada 6 istek sınırına takılmamak ve
// kaynakları yormamak için sonuçları belirli süre saklarız.
const store = new Map();

export function getCached(key) {
  const e = store.get(key);
  if (e && e.exp > Date.now()) return e.val;
  return null;
}

export function setCached(key, val, ttlMs) {
  store.set(key, { val, exp: Date.now() + ttlMs });
}

const CACHE_FALLBACK_NOTICE =
  "Показаны последние доступные данные из кеша. Они могут быть неактуальны.";

export function wasServedFromCache(result) {
  return Boolean(result?.meta?.servedFromCache);
}

export function getCacheFallbackNotice(...results) {
  return results.some(wasServedFromCache) ? CACHE_FALLBACK_NOTICE : "";
}

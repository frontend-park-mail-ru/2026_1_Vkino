import type { ApiResult } from "@/js/api.ts";

const CACHE_FALLBACK_NOTICE =
  "Показаны последние доступные данные из кеша. Они могут быть неактуальны.";

type ApiResultLike = Pick<ApiResult<unknown>, "meta"> | null | undefined;

export function wasServedFromCache(result: ApiResultLike): boolean {
  return Boolean(result?.meta?.servedFromCache);
}

export function getCacheFallbackNotice(...results: ApiResultLike[]): string {
  return results.some(wasServedFromCache) ? CACHE_FALLBACK_NOTICE : "";
}

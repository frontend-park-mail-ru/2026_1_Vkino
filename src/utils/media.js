const IMAGE_EXTENSION_RE = /\.(avif|gif|jpe?g|png|svg|webp)$/i;
const MEDIA_BASE_URL = String(import.meta.env.VITE_MEDIA_BASE_URL || "")
  .trim()
  .replace(/\/+$/, "");

export const MEDIA_BUCKETS = {
  actors: "vkino-actors",
  posters: "vkino-posters",
  cards: "vkino-cards",
  avatars: "vkino-avatars",
  videos: "vkino-videos",
};

export function resolveMediaUrl(value, bucket = MEDIA_BUCKETS.cards) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  if (normalized.startsWith("/img/")) {
    return normalized;
  }

  const withoutLeadingSlash = normalized.replace(/^\/+/, "");

  if (withoutLeadingSlash.startsWith("img/")) {
    return `/${withoutLeadingSlash}`;
  }

  if (!MEDIA_BASE_URL) {
    return normalized.startsWith("/") ? normalized : `/${withoutLeadingSlash}`;
  }

  const normalizedKey = normalizeBucketKey(withoutLeadingSlash);
  const finalizedKey = IMAGE_EXTENSION_RE.test(normalizedKey)
    ? normalizedKey
    : `${normalizedKey}.webp`;

  return `${MEDIA_BASE_URL}/${bucket}/${finalizedKey}`;
}

function normalizeBucketKey(value) {
  return value
    .replace(/^cards\//, "")
    .replace(/^posters\//, "")
    .replace(/^actors\//, "")
    .replace(/^avatars\//, "")
    .replace(/^videos\//, "")
    .replace(/^img\/cards\//, "")
    .replace(/^img\/posters\//, "")
    .replace(/^img\/actors\//, "")
    .replace(/^img\/avatars\//, "")
    .replace(/^img\/videos\//, "");
}

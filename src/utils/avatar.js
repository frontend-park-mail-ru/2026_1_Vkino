/**
 * Путь к дефолтному аватару, используемому при отсутствии пользовательского изображения.
 * @type {string}
 */
export const DEFAULT_AVATAR_URL = "/img/user-avatar.png";

/**
 * Нормализует URL аватара для безопасного использования в интерфейсе.
 * Добавляет ведущий `/` для относительных путей и оставляет абсолютные URL без изменений.
 *
 * @param {string|null|undefined} avatarUrl исходный URL аватара
 * @returns {string} нормализованный URL аватара
 */
export function resolveAvatarUrl(avatarUrl) {
  const normalized = String(avatarUrl || "").trim();

  if (!normalized) {
    return DEFAULT_AVATAR_URL;
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  return `/${normalized.replace(/^\/+/, "")}`;
}

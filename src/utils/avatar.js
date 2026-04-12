export const DEFAULT_AVATAR_URL = "img/user-avatar.png";

export function resolveAvatarUrl(avatarUrl) {
  const normalized = String(avatarUrl || "").trim();
  return normalized || DEFAULT_AVATAR_URL;
}
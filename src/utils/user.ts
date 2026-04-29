/**
 * Возвращает отображаемое имя пользователя на основе email.
 * Если email корректный, берется часть строки до `@`.
 *
 * @param {string} [email=""] email пользователя
 * @returns {string} отображаемое имя пользователя
 */
export function getDisplayNameFromEmail(email = "") {
  const normalized = String(email).trim();

  if (!normalized) {
    return "";
  }

  const [localPart] = normalized.split("@");
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Форматирует дату рождения в локализованный человекочитаемый вид.
 *
 * @param {string} [birthdate=""] дата в формате `YYYY-MM-DD`
 * @returns {string} отформатированная дата или значение-заглушка
 */
export function formatBirthdate(birthdate = "") {
  const normalized = String(birthdate || "").trim();

  if (!normalized) {
    return "Не указана";
  }

  const parsedDate = new Date(`${normalized}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parsedDate);
}

export function formatDate(dateString = "") {
  const normalized = String(dateString || "").trim();
  if (!normalized) {
    return "";
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }
  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

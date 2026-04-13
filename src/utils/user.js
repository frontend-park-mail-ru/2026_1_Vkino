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

  const atIndex = normalized.indexOf("@");

  if (atIndex === -1) {
    return normalized;
  }

  return normalized.slice(0, atIndex);
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

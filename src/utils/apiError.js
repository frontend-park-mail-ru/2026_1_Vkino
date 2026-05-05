export function extractRawApiPayloadError(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  return String(
    payload.Error ||
      payload.error ||
      payload.message ||
      payload.raw ||
      "",
  ).trim();
}

export function extractRawApiError(result = {}) {
  return String(
    result.rawError ||
      extractRawApiPayloadError(result.resp) ||
      result.error ||
      "",
  ).trim();
}

export function mapApiErrorMessage(
  status,
  rawMessage = "",
  { context = "default", fallback = "" } = {},
) {
  const normalizedRaw = String(rawMessage || "").trim();
  const raw = normalizedRaw.toLowerCase();

  if (!raw && status === 0) {
    return "Не удалось связаться с сервером. Проверьте соединение и попробуйте снова.";
  }

  if (raw.includes("user already exists") || raw.includes("email already exists")) {
    return "Пользователь с таким email уже существует.";
  }

  if (
    raw.includes("invalid credentials") ||
    raw.includes("invalid email or password") ||
    raw.includes("wrong password")
  ) {
    return resolveUnauthorizedMessage(context);
  }

  if (raw.includes("unauthorized")) {
    return resolveUnauthorizedMessage(context);
  }

  if (raw.includes("forbidden") || raw.includes("access denied")) {
    return "Недостаточно прав для выполнения этого действия.";
  }

  if (raw.includes("not found")) {
    return "Запрашиваемый ресурс не найден.";
  }

  if (
    raw.includes("payload too large") ||
    raw.includes("request entity too large")
  ) {
    return "Файл слишком большой.";
  }

  if (
    raw.includes("unsupported media type") ||
    raw.includes("invalid file type")
  ) {
    return "Формат файла не поддерживается.";
  }

  if (
    raw.includes("invalid json body") ||
    raw.includes("unexpected end of json") ||
    raw.includes("cannot unmarshal")
  ) {
    return "Сервер не смог обработать отправленные данные.";
  }

  if (raw.includes("internal server error")) {
    return "На сервере произошла ошибка. Попробуйте позже.";
  }

  if (status === 400) {
    return fallback || "Проверьте введенные данные.";
  }

  if (status === 401) {
    return resolveUnauthorizedMessage(context);
  }

  if (status === 403) {
    return "Недостаточно прав для выполнения этого действия.";
  }

  if (status === 404) {
    return "Запрашиваемый ресурс не найден.";
  }

  if (status === 409) {
    return fallback || "Такой ресурс уже существует.";
  }

  if (status === 413) {
    return "Файл слишком большой.";
  }

  if (status === 415) {
    return "Формат файла не поддерживается.";
  }

  if (status === 429) {
    return "Слишком много запросов. Попробуйте позже.";
  }

  if (status >= 500) {
    return "На сервере произошла ошибка. Попробуйте позже.";
  }

  return fallback || normalizedRaw || "Не удалось выполнить запрос.";
}

export function getApiErrorMessage(
  result = {},
  { context = "default", fallback = "" } = {},
) {
  return mapApiErrorMessage(result.status, extractRawApiError(result), {
    context,
    fallback,
  });
}

function resolveUnauthorizedMessage(context = "default") {
  if (context === "sign-in") {
    return "Неверный email или пароль.";
  }

  if (context === "change-password") {
    return "Текущий пароль указан неверно.";
  }

  return "Нужно заново войти в аккаунт.";
}

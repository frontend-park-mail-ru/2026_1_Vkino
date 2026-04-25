/**
 * Сервис для выполнения HTTP-запросов к API backend.
 * Управляет базовым URL, пространством имен эндпоинтов и токеном авторизации.
 */
const RESPONSE_SOURCE_HEADER = "x-vkino-response-source";

export class ApiService {
  /**
   * Конструирует экземпляр ApiService.
   * @constructor
   * @param {string} baseUrl базовый URL API (например, "http://localhost:8080/api", "https://vkino.tech/api")
   * @param {string} [namespace=""] пространство имен для группировки эндпоинтов
   * @param {string} [accessTokenKey="vkino_access_token"] ключ access токена в localStorage
   */
  constructor(baseUrl, namespace = "", accessTokenKey = "vkino_access_token") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.namespace = namespace;
    this.accessTokenKey = accessTokenKey;
  }

  /**
   * Создает новый экземпляр сервиса с указанным пространством имен.
   * @param {string} namespace новое пространство имен
   * @returns {ApiService} новый экземпляр сервиса с заданным namespace
   */
  withNamespace(namespace) {
    return new ApiService(this.baseUrl, namespace, this.accessTokenKey);
  }

  /**
   * Получает токен доступа из localStorage.
   * @returns {string|null} токен доступа или null, если токен не найден
   */
  getAccessToken() {
    return localStorage.getItem(this.accessTokenKey);
  }

  /**
   * Сохраняет токен доступа в localStorage.
   * @param {string|null} token токен доступа для сохранения
   */
  setAccessToken(token) {
    if (!token) {
      this.clearAccessToken();
      return;
    }

    localStorage.setItem(this.accessTokenKey, token);
  }

  /**
   * Метод, удаляющий accessToken
   */
  clearAccessToken() {
    localStorage.removeItem(this.accessTokenKey);
  }

  /**
   * Формирует полный URL для запроса с учетом namespace, endpoint и query-параметров.
   * @param {string} [endpoint=""] конечная точка API
   * @param {Object|URLSearchParams|null} [query=null] query-параметры запроса
   * @returns {string} сформированный URL
   */
  buildUrl(endpoint = "", query = null) {
    const normalizedNamespace = this.namespace
      ? `/${String(this.namespace).replace(/^\/+|\/+$/g, "")}`
      : "";

    const normalizedEndpoint = endpoint
      ? `/${String(endpoint).replace(/^\/+/, "")}`
      : "";

    return appendQueryParams(
      `${this.baseUrl}${normalizedNamespace}${normalizedEndpoint}`,
      query,
    );
  }

  /**
   * Главный метод, выполняет HTTP-запрос к API.
   * @async
   * @param {string} endpoint конечная точка API
   * @param {Object} [options] параметры запроса
   * @param {string} [options.method="GET"] HTTP метод
   * @param {Object|null} [options.data=null] данные для отправки в теле запроса
   * @param {Object|URLSearchParams|null} [options.query=null] query-параметры запроса
   * @param {Object} [options.headers={}] дополнительные заголовки
   * @returns {Promise<Object>} результат запроса
   * @returns {boolean} return.ok успешен ли запрос
   * @returns {number} return.status HTTP статус ответа
   * @returns {Object|null} return.resp ответ сервера
   * @returns {string} return.error сообщение об ошибке (если есть)
   * @returns {{source: string, servedFromCache: boolean}} return.meta мета-информация об источнике ответа
   */
  async request(
    endpoint,
    {
      method = "GET",
      data = null,
      query = null,
      headers = {},
      signal = null,
    } = {},
  ) {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const bodyAllowed = normalizedMethod !== "GET" && normalizedMethod !== "HEAD";

    return this._performRequest(this.buildUrl(endpoint, query), {
      method: normalizedMethod,
      data: bodyAllowed ? data : null,
      headers,
      signal,
    });
  }

  async _performRequest(
    url,
    { method = "GET", data = null, headers = {}, signal = null } = {},
  ) {
    const accessToken = this.getAccessToken();

    const fetchParams = {
      method,
      credentials: "include",
      signal: signal || undefined,
      headers: {
        Accept: "application/json",
        ...headers,
      },
    };

    if (data !== null) {
      if (data instanceof FormData) {
        fetchParams.body = data;
      } else {
        fetchParams.headers["Content-Type"] = "application/json";
        fetchParams.body = JSON.stringify(data);
      }
    }

    if (accessToken) {
      fetchParams.headers.Authorization = `Bearer ${accessToken}`;
    }

    let response;

    try {
      response = await fetch(url, fetchParams);
    } catch (error) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error:
          error?.name === "AbortError" ? "" : error.message || "Network error",
        aborted: error?.name === "AbortError",
        meta: createResponseMeta("network-error"),
      };
    }

    const rawText = await response.text();

    let parsedBody = null;

    if (rawText) {
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        parsedBody = { raw: rawText };
      }
    }

    return {
      ok: response.ok,
      status: response.status,
      resp: parsedBody,
      error: extractErrorMessage(parsedBody),
      aborted: false,
      meta: extractResponseMeta(response),
    };
  }

  /**
   * Выполняет GET запрос.
   * @async
   * @param {string} endpoint конечная точка API
   * @param {Object} [options={}] дополнительные параметры запроса
   * @param {Object|URLSearchParams|null} [options.query=null] query-параметры
   * @param {Object} [options.headers={}] дополнительные заголовки
   * @param {AbortSignal|null} [options.signal=null] сигнал отмены запроса
   * @returns {Promise<Object>} результат запроса
   */
  get(endpoint, { query = null, headers = {}, signal = null } = {}) {
    return this.request(endpoint, {
      method: "GET",
      query,
      headers,
      signal,
    });
  }

  /**
   * Выполняет POST запрос.
   * @async
   * @param {string} endpoint конечная точка API
   * @returns {Promise<Object>} результат запроса
   */
  post(endpoint, data = null) {
    return this.request(endpoint, { method: "POST", data });
  }

  /**
   * Выполняет PUT запрос.
   * @async
   * @param {string} endpoint конечная точка API
   * @returns {Promise<Object>} результат запроса
   */
  put(endpoint, data = null) {
    return this.request(endpoint, { method: "PUT", data });
  }

  /**
   * Выполняет PATCH запрос.
   * @async
   * @param {string} endpoint конечная точка API
   * @param {Object|FormData|null} data данные для обновления
   * @returns {Promise<Object>} результат запроса
   */
  patch(endpoint, data = null) {
    return this.request(endpoint, { method: "PATCH", data });
  }

  /**
   * Выполняет DELETE запрос.
   * @async
   * @param {string} endpoint конечная точка API
   * @returns {Promise<Object>} результат запроса
   */
  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  }
}

/**
 * Функция, извлекающая сообщение об ошибке из ответа сервера.
 * @param {Object} resp ответ сервера
 * @returns {string} сообщение об ошибке или пустая строка
 */
function extractErrorMessage(resp) {
  if (!resp || typeof resp !== "object") return "";
  return resp.Error || resp.error || resp.message || "";
}

function appendQueryParams(url, query = null) {
  if (!query) {
    return url;
  }

  const params =
    query instanceof URLSearchParams ? new URLSearchParams(query) : new URLSearchParams();

  if (!(query instanceof URLSearchParams)) {
    Object.entries(query).forEach(([key, value]) => {
      appendQueryValue(params, key, value);
    });
  }

  const queryString = params.toString();

  if (!queryString) {
    return url;
  }

  return `${url}${url.includes("?") ? "&" : "?"}${queryString}`;
}

function appendQueryValue(params, key, value) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(params, key, item));
    return;
  }

  const normalizedValue = typeof value === "string" ? value.trim() : value;

  if (normalizedValue === "") {
    return;
  }

  params.append(key, String(normalizedValue));
}

function extractResponseMeta(response) {
  const source =
    String(response.headers.get(RESPONSE_SOURCE_HEADER) || "network").trim() ||
    "network";

  return createResponseMeta(source);
}

function createResponseMeta(source) {
  return {
    source,
    servedFromCache: source === "cache-fallback",
  };
}

// читаем baseUrl из .env (с сервера) или ставим дефолтный для dev
const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/**
 * Экземпляр ApiService, сконфигурированный на основе .env
 * @type {ApiService}
 */
export const apiService = new ApiService(baseUrl);

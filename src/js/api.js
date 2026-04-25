/**
 * Сервис для выполнения HTTP-запросов к API backend.
 * Управляет базовым URL, пространством имен эндпоинтов и токеном авторизации.
 */
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
   * Формирует полный URL для запроса с учетом namespace и endpoint.
   * @param {string} [endpoint=""] конечная точка API
   * @returns {string} сформированный URL
   */
  buildUrl(endpoint = "") {
    const normalizedNamespace = this.namespace
      ? `/${String(this.namespace).replace(/^\/+|\/+$/g, "")}`
      : "";

    const normalizedEndpoint = endpoint
      ? `/${String(endpoint).replace(/^\/+/, "")}`
      : "";

    return `${this.baseUrl}${normalizedNamespace}${normalizedEndpoint}`;
  }

  /**
   * Главный метод, выполняет HTTP-запрос к API.
   * @async
   * @param {string} endpoint конечная точка API
   * @param {Object} [options] параметры запроса
   * @param {string} [options.method="GET"] HTTP метод
   * @param {Object|null} [options.data=null] данные для отправки в теле запроса
   * @param {Object} [options.headers={}] дополнительные заголовки
   * @returns {Promise<Object>} результат запроса
   * @returns {boolean} return.ok успешен ли запрос
   * @returns {number} return.status HTTP статус ответа
   * @returns {Object|null} return.resp ответ сервера
   * @returns {string} return.error сообщение об ошибке (если есть)
   */
  async request(
    endpoint,
    { method = "GET", data = null, headers = {}, signal = null } = {},
  ) {
    return this._performRequest(this.buildUrl(endpoint), {
      method: String(method || "GET").toUpperCase(),
      data,
      headers,
      signal,
    });
  }

  async _performRequest(
    url,
    { method = "GET", data = null, headers = {}, signal = null } = {},
  ) {
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
    };
  }

  _performRequestViaXhr(
    url,
    { method = "GET", data = null, headers = {}, signal = null } = {},
  ) {
    return new Promise((resolve) => {
      const accessToken = this.getAccessToken();
      const xhr = new XMLHttpRequest();
      let isSettled = false;


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

// читаем baseUrl из .env (с сервера) или ставим дефолтный для dev
const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/**
 * Экземпляр ApiService, сконфигурированный на основе .env
 * @type {ApiService}
 */
export const apiService = new ApiService(baseUrl);

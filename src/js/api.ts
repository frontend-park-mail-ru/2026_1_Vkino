/**
 * Сервис для выполнения HTTP-запросов к API backend.
 * Управляет базовым URL, пространством имен эндпоинтов и токеном авторизации.
 */

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

type JsonRecord = Record<string, unknown>;

type RequestData = JsonRecord | FormData | null;

type RequestHeaders = Record<string, string>;
const RESPONSE_SOURCE_HEADER = "x-vkino-response-source";

interface RequestOptions {
  method?: HttpMethod;
  data?: RequestData;
  headers?: RequestHeaders;
}

interface RawTextResponse {
  raw: string;
}

type ParsedResponseBody = JsonRecord | RawTextResponse | null;

export interface ResponseMeta {
  source: string;
  servedFromCache: boolean;
}

export interface ApiResponse<T = ParsedResponseBody> {
  ok: boolean;
  status: number;
  resp: T | null;
  error: string;
  meta: ResponseMeta;
}

export class ApiService {
  private baseUrl: string;
  private namespace: string;
  private accessTokenKey: string;

  /**
   * Конструирует экземпляр ApiService.
   * @constructor
   * @param baseUrl базовый URL API (например, "http://localhost:8080/api", "https://vkino.tech/api")
   * @param namespace пространство имен для группировки эндпоинтов
   * @param accessTokenKey ключ access токена в localStorage
   */
  constructor(
    baseUrl: string,
    namespace: string = "",
    accessTokenKey: string = "vkino_access_token",
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.namespace = namespace;
    this.accessTokenKey = accessTokenKey;
  }

  /**
   * Создает новый экземпляр сервиса с указанным пространством имен.
   * @param namespace новое пространство имен
   * @returns новый экземпляр сервиса с заданным namespace
   */
  withNamespace(namespace: string): ApiService {
    return new ApiService(this.baseUrl, namespace, this.accessTokenKey);
  }

  /**
   * Получает токен доступа из localStorage.
   * @returns токен доступа или null, если токен не найден
   */
  getAccessToken(): string | null {
    return localStorage.getItem(this.accessTokenKey);
  }

  /**
   * Сохраняет токен доступа в localStorage.
   * @param token токен доступа для сохранения
   */
  setAccessToken(token: string | null): void {
    if (!token) {
      this.clearAccessToken();
      return;
    }

    localStorage.setItem(this.accessTokenKey, token);
  }

  /**
   * Метод, удаляющий accessToken
   */
  clearAccessToken(): void {
    localStorage.removeItem(this.accessTokenKey);
  }

  /**
   * Формирует полный URL для запроса с учетом namespace и endpoint.
   * @param endpoint конечная точка API
   * @returns сформированный URL
   */
  buildUrl(endpoint: string = ""): string {
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
   * @param endpoint конечная точка API
   * @param options параметры запроса
   * @returns результат запроса
   */
  async request<T = ParsedResponseBody>(
    endpoint: string,
    { method = "GET", data = null, headers = {} }: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(endpoint);
    const accessToken = this.getAccessToken();

    const fetchHeaders: RequestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    const fetchParams: RequestInit = {
      method,
      credentials: "include",
      headers: fetchHeaders,
    };

    if (data !== null) {
      if (data instanceof FormData) {
        fetchParams.body = data;
      } else {
        fetchHeaders["Content-Type"] = "application/json";
        fetchParams.body = JSON.stringify(data);
      }
    }

    if (accessToken) {
      fetchHeaders.Authorization = `Bearer ${accessToken}`;
    }

    let response: Response;

    try {
      response = await fetch(url, fetchParams);
    } catch (error: unknown) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: getErrorMessage(error),
        meta: createResponseMeta("network-error"),
      };
    }

    const rawText = await response.text();

    let parsedBody: unknown = null;

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
      resp: parsedBody as T | null,
      error: extractErrorMessage(parsedBody),
      meta: extractResponseMeta(response),
    };
  }

  /**
   * Выполняет GET запрос.
   * @param endpoint конечная точка API
   * @returns результат запроса
   */
  get<T = ParsedResponseBody>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "GET" });
  }

  /**
   * Выполняет POST запрос.
   * @param endpoint конечная точка API
   * @param data данные для отправки
   * @returns результат запроса
   */
  post<T = ParsedResponseBody>(
    endpoint: string,
    data: RequestData = null,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "POST", data });
  }

  /**
   * Выполняет PUT запрос.
   * @param endpoint конечная точка API
   * @param data данные для отправки
   * @returns результат запроса
   */
  put<T = ParsedResponseBody>(
    endpoint: string,
    data: RequestData = null,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PUT", data });
  }

  /**
   * Выполняет DELETE запрос.
   * @param endpoint конечная точка API
   * @returns результат запроса
   */
  delete<T = ParsedResponseBody>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "DELETE" });
  }
}

/**
 * Функция, извлекающая сообщение об ошибке из ответа сервера.
 * @param resp ответ сервера
 * @returns сообщение об ошибке или пустая строка
 */
function extractErrorMessage(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";

  const errorResp = resp as {
    Error?: unknown;
    error?: unknown;
    message?: unknown;
  };

  if (typeof errorResp.Error === "string") return errorResp.Error;
  if (typeof errorResp.error === "string") return errorResp.error;
  if (typeof errorResp.message === "string") return errorResp.message;

  return "";
}

/**
 * Безопасно извлекает сообщение ошибки из unknown.
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Network error";
}

function extractResponseMeta(response: Response): ResponseMeta {
  const source =
    String(response.headers.get(RESPONSE_SOURCE_HEADER) || "network").trim() ||
    "network";

  return createResponseMeta(source);
}

function createResponseMeta(source: string): ResponseMeta {
  return {
    source,
    servedFromCache: source === "cache-fallback",
  };
}

// читаем baseUrl из .env (с сервера) или ставим дефолтный для dev
const baseUrl: string =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

/**
 * Экземпляр ApiService, сконфигурированный на основе .env
 */
export const apiService = new ApiService(baseUrl);

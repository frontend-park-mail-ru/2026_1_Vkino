/**
 * Сервис для выполнения HTTP-запросов к API backend.
 * Управляет базовым URL, пространством имен эндпоинтов и токеном авторизации.
 */
export type HttpMethod = "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT";

export type JsonRecord = Record<string, unknown>;

// Request bodies in this codebase are plain serializable objects or FormData.
// Using `object` here keeps existing DTO interfaces assignable without adding
// artificial index signatures to every payload type.
export type RequestData = object | FormData | null;

export type RequestHeaders = Record<string, string>;

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[];

export type QueryParams = Record<string, QueryValue>;

const RESPONSE_SOURCE_HEADER = "x-vkino-response-source";

interface RequestOptions {
  method?: HttpMethod;
  data?: RequestData;
  query?: QueryParams | URLSearchParams | null;
  headers?: RequestHeaders;
  signal?: AbortSignal | null;
}

interface RawTextResponse {
  raw: string;
}

type ParsedResponseBody =
  | JsonRecord
  | readonly unknown[]
  | RawTextResponse
  | string
  | number
  | boolean
  | null;

export interface ResponseMeta {
  source: string;
  servedFromCache: boolean;
}

export interface ApiResult<T = ParsedResponseBody> {
  ok: boolean;
  status: number;
  resp: T | null;
  error: string;
  aborted: boolean;
  meta: ResponseMeta;
}

export type ApiResponse<T = ParsedResponseBody> = ApiResult<T>;

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
   * Формирует полный URL для запроса с учетом namespace, endpoint и query-параметров.
   * @param endpoint конечная точка API
   * @returns сформированный URL
   */
  buildUrl(
    endpoint: string = "",
    query: QueryParams | URLSearchParams | null = null,
  ): string {
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
   * @param endpoint конечная точка API
   * @param options параметры запроса
   * @returns результат запроса
   */
  async request<T = ParsedResponseBody>(
    endpoint: string,
    {
      method = "GET",
      data = null,
      query = null,
      headers = {},
      signal = null,
    }: RequestOptions = {},
  ): Promise<ApiResult<T>> {
    const normalizedMethod = String(method || "GET").toUpperCase() as HttpMethod;
    const bodyAllowed = normalizedMethod !== "GET" && normalizedMethod !== "HEAD";

    return this._performRequest<T>(this.buildUrl(endpoint, query), {
      method: normalizedMethod,
      data: bodyAllowed ? data : null,
      headers,
      signal,
    });
  }

  async _performRequest<T = ParsedResponseBody>(
    url: string,
    {
      method = "GET",
      data = null,
      headers = {},
      signal = null,
    }: Omit<RequestOptions, "query"> = {},
  ): Promise<ApiResult<T>> {
    const accessToken = this.getAccessToken();

    const fetchHeaders: RequestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    const fetchParams: RequestInit = {
      method,
      credentials: "include",
      signal: signal || undefined,
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
      const aborted =
        error instanceof DOMException && error.name === "AbortError";

      return {
        ok: false,
        status: 0,
        resp: null,
        error: aborted ? "" : getErrorMessage(error),
        aborted,
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
      aborted: false,
      meta: extractResponseMeta(response),
    };
  }

  /**
   * Выполняет GET запрос.
   * @param endpoint конечная точка API
   * @returns результат запроса
   */
  get<T = ParsedResponseBody>(
    endpoint: string,
    {
      query = null,
      headers = {},
      signal = null,
    }: Pick<RequestOptions, "headers" | "query" | "signal"> = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: "GET",
      query,
      headers,
      signal,
    });
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

  patch<T = ParsedResponseBody>(
    endpoint: string,
    data: RequestData = null,
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: "PATCH", data });
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

function appendQueryParams(
  url: string,
  query: QueryParams | URLSearchParams | null = null,
): string {
  if (!query) {
    return url;
  }

  const params =
    query instanceof URLSearchParams
      ? new URLSearchParams(query)
      : new URLSearchParams();

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

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: QueryValue,
): void {
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

export function createApiErrorResult<T = ParsedResponseBody>({
  status = 0,
  error = "",
  resp = null,
  aborted = false,
  source = "local-validation",
}: {
  status?: number;
  error?: string;
  resp?: T | null;
  aborted?: boolean;
  source?: string;
} = {}): ApiResult<T> {
  return {
    ok: false,
    status,
    resp,
    error,
    aborted,
    meta: createResponseMeta(source),
  };
}

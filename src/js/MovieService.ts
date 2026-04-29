import { ApiService, apiService } from "./api.ts";
import type { AnyRecord } from "@/types/shared.ts";

/**
 * Сервис для работы с фильмами и подборками.
 * Предоставляет методы для получения информации о фильмах и подборках.
 */
export class MovieService {
  [key: string]: any;
  /**
   * Конструирует экземпляр MovieService.
   * @constructor
   * @param {ApiService} apiService экземпляр ApiService
   */
  constructor(apiService: ApiService) {
    this.api = apiService.withNamespace("movie");
    this.rootApi = apiService;
  }

  /**
   * Получает список всех доступных подборок фильмов.
   * @async
   * @returns {Promise<Object>} результат запроса с массивом подборок
   * @returns {boolean} return.ok успешен ли запрос
   * @returns {number} return.status HTTP статус ответа
   * @returns {Object[]|null} return.resp массив подборок
   * @returns {string} return.error сообщение об ошибке
   */
  async getAllSelections() {
    return this.api.get(`/selection/all`);
  }

  /**
   * Получает конкретную подборку фильмов по её названию.
   * @async
   * @param {string} title название подборки
   * @returns {Promise<Object>} результат запроса с данными подборки
   * @returns {boolean} return.ok успешен ли запрос
   * @returns {number} return.status HTTP статус ответа
   * @returns {Object|null} return.resp данные подборки с массивом фильмов
   * @returns {string} return.error сообщение об ошибке (если есть)
   */
  async getSelectionByTitle(title) {
    const normalizedTitle = String(title ?? "").trim();

    if (!normalizedTitle) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "MovieService: не передано название подборки",
      };
    }

    return this.api.get(`/selection/${encodeURIComponent(normalizedTitle)}`);
  }

  /**
   * Получает набор подборок по их названиям.
   * Если список названий пустой, возвращает все подборки.
   * @async
   * @param {string[]} [titles=[]] названия подборок
   * @returns {Promise<Object>} результат запроса с массивом подборок
   */
  async getSelectionsByTitles(titles = []) {
    const normalizedTitles = normalizeSelectionTitles(titles);

    if (!normalizedTitles.length) {
      return this.getAllSelections();
    }

    const results = await Promise.all(
      normalizedTitles.map((title) => this.getSelectionByTitle(title)),
    );
    const selections = results.flatMap((result, index) =>
      normalizeSelectionResponse(result.resp, normalizedTitles[index]),
    );

    if (selections.length) {
      return {
        ok: true,
        status: 200,
        resp: selections,
        error: "",
      };
    }

    const firstFailedResult = results.find((result) => !result.ok);

    return {
      ok: false,
      status: firstFailedResult?.status || 0,
      resp: null,
      error: firstFailedResult?.error || "Не удалось загрузить подборки",
    };
  }

  /**
   * Получает детальную информацию о фильме по id.
   * @async
   * @param {string|number} id id фильма
   * @returns {Promise<Object>} результат запроса с данными фильма
   * @returns {boolean} return.ok успешен ли запрос
   * @returns {number} return.status HTTP статус ответа
   * @returns {Object|null} return.resp данные фильма
   * @returns {string} return.error сообщение об ошибке (если есть)
   */
  async getMovieById(id) {
    const normalizedId = String(id ?? "").trim();

    if (!normalizedId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "MovieService: не передан id фильма",
      };
    }

    return this.api.get(`/${encodeURIComponent(normalizedId)}`);
  }

  /**
   * Получает актера по идентификатору.
   * @async
   * @param {number|string} actorId идентификатор актера
   * @returns {Promise<Object>} результат запроса с данными актера
   */
  async getActorById(actorId) {
    const normalizedActorId = String(actorId ?? "").trim();

    if (!normalizedActorId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "MovieService: не передан id актера",
      };
    }

    return this.api.get(`/actor/${encodeURIComponent(normalizedActorId)}`);
  }
}

/**
 * Экземпляр сервиса для работы с фильмами
 * @type {MovieService}
 */
export const movieService = new MovieService(apiService);

function normalizeSelectionTitles(titles: unknown[] = []): string[] {
  if (!Array.isArray(titles)) {
    return [];
  }

  return Array.from(
    new Set(
      titles.map((title) => String(title ?? "").trim()).filter(Boolean),
    ),
  );
}

function normalizeSelectionResponse(
  resp: unknown,
  requestedTitle = "",
): AnyRecord[] {
  if (Array.isArray(resp)) {
    return resp
      .map((selection) => normalizeSelection(selection, requestedTitle))
      .filter((selection): selection is AnyRecord => Boolean(selection));
  }

  const normalizedSelection = normalizeSelection(resp, requestedTitle);

  return normalizedSelection ? [normalizedSelection] : [];
}

function normalizeSelection(
  selection: unknown,
  requestedTitle = "",
): AnyRecord | null {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const normalizedSelection = selection as AnyRecord;

  return {
    ...normalizedSelection,
    title:
      String(normalizedSelection.title || "").trim() ||
      String(normalizedSelection.name || "").trim() ||
      String(requestedTitle || "").trim(),
  };
}

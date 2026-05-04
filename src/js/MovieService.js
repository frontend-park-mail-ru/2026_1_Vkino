import { apiService } from "./api.js";
import {
  extractGenre,
  extractGenres,
  unwrapPayload,
} from "@/utils/apiResponse.js";

/**
 * Сервис для работы с фильмами и подборками.
 * Предоставляет методы для получения информации о фильмах и подборках.
 */
export class MovieService {
  /**
   * Конструирует экземпляр MovieService.
   * @constructor
   * @param {ApiService} apiService экземпляр ApiService
   */
  constructor(apiService) {
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

  async searchMovies(query) {
    const normalizedQuery = String(query ?? "").trim();

    if (!normalizedQuery) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "MovieService: не передан поисковый запрос",
      };
    }

    return this.api.get("/search", {
      query: { query: normalizedQuery },
    });
  }

  async getGenres() {
    const result = await this.rootApi.get("/genres");

    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      resp: normalizeGenresResponse(result.resp),
    };
  }

  async getGenreById(id) {
    const normalizedId = String(id ?? "").trim();

    if (!normalizedId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "MovieService: не передан id жанра",
      };
    }

    const result = await this.rootApi.get(
      `/movie/genre/${encodeURIComponent(normalizedId)}`,
    );

    if (!result.ok) {
      return result;
    }

    return {
      ...result,
      resp: normalizeGenreResponse(result.resp, normalizedId),
    };
  }
}

/**
 * Экземпляр сервиса для работы с фильмами
 * @type {MovieService}
 */
export const movieService = new MovieService(apiService);

function normalizeSelectionTitles(titles = []) {
  if (!Array.isArray(titles)) {
    return [];
  }

  return Array.from(
    new Set(
      titles.map((title) => String(title ?? "").trim()).filter(Boolean),
    ),
  );
}

function normalizeSelectionResponse(resp, requestedTitle = "") {
  if (Array.isArray(resp)) {
    return resp
      .map((selection) => normalizeSelection(selection, requestedTitle))
      .filter(Boolean);
  }

  const normalizedSelection = normalizeSelection(resp, requestedTitle);

  return normalizedSelection ? [normalizedSelection] : [];
}

function normalizeSelection(selection, requestedTitle = "") {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  return {
    ...selection,
    title:
      String(selection.title || "").trim() ||
      String(selection.name || "").trim() ||
      String(requestedTitle || "").trim(),
  };
}

function normalizeGenresResponse(resp) {
  return extractGenres(resp)
    .map((genre, index) => normalizeGenreSummary(genre, index))
    .filter(Boolean);
}

function normalizeGenreResponse(resp, fallbackId = "") {
  const unwrapped = unwrapPayload(resp);

  if (Array.isArray(unwrapped)) {
    return {
      id: String(fallbackId || "").trim(),
      title: "",
      movies: unwrapped,
    };
  }

  const genre = extractGenre(resp);

  if (!genre) {
    return null;
  }

  const normalizedId =
    String(genre.id ?? genre.genre_id ?? genre.genreId ?? fallbackId).trim();
  const normalizedTitle = String(genre.title ?? genre.name ?? "").trim();

  return {
    ...genre,
    id: normalizedId,
    title: normalizedTitle,
    movies: extractGenreMovies(genre),
  };
}

function normalizeGenreSummary(genre, index = 0) {
  if (!genre || typeof genre !== "object") {
    return null;
  }

  const normalizedId = String(
    genre.id ?? genre.genre_id ?? genre.genreId ?? "",
  ).trim();
  const normalizedTitle = String(genre.title ?? genre.name ?? "").trim();

  if (!normalizedId || !normalizedTitle) {
    return null;
  }

  return {
    ...genre,
    id: normalizedId,
    title: normalizedTitle,
    href: `/genre/${encodeURIComponent(normalizedId)}`,
    order: Number.isFinite(Number(genre.order)) ? Number(genre.order) : index,
  };
}

function extractGenreMovies(genre = {}) {
  const candidates = [
    genre.movies,
    genre.Movies,
    genre.titles,
    genre.Titles,
    genre.items,
    genre.Items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

import { apiService } from "./api.js";

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
    return this.api.get(`/selection/${title}`);
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

    return this.rootApi.get(`/actor/${encodeURIComponent(normalizedActorId)}`);
  }
}

/**
 * Экземпляр сервиса для работы с фильмами
 * @type {MovieService}
 */
export const movieService = new MovieService(apiService);

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
}

/**
 * Экземпляр сервиса для работы с фильмами
 * @type {MovieService}
 */
export const movieService = new MovieService(apiService);

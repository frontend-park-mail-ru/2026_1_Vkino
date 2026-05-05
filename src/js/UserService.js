import { apiService } from "./api.js";

/**
 * Сервис авторизации. Надстройка нам ApiService
 * Управляет ручками, связанными с авторизацией, регистрацией, обнолением токенов, информацией пользователя и разлогином.
 */
export class UserService {
  /**
   * Конструирует экземпляр UserService.
   * @constructor
   * @param {ApiService} экземпляр ApiService
   */
  constructor(apiService) {
    this.apiRoot = apiService;
    this.api = apiService.withNamespace("/user");
  }

  /**
   * Сохраняет access token из ответа сервера в localStorage.
   * @private
   * @param {Object} result результат запроса к API
   * @param {boolean} result.ok флаг успешности запроса
   * @param {Object} result.resp ответ сервера
   * @param {string} result.resp.access_token токен доступа
   */
  _saveAccessToken(result) {
    const accessToken = result?.resp?.access_token;

    if (result?.ok && accessToken) {
      this.apiRoot.setAccessToken(accessToken);
    }
  }

  /**
   * Очищаем localStorage
   * @private
   */
  _clearSessionLocal() {
    this.apiRoot.clearAccessToken();
  }

  /**
   * Получаем accessToken
   * @returns {string|null} токен доступа или null, если токен не найден
   */
  getAccessToken() {
    return this.apiRoot.getAccessToken();
  }

  /**
   * Обнуляем сессию
   */
  clearAccessToken() {
    this._clearSessionLocal();
  }

  /**
   * Авторизуем пользователя.
   * @async
   * @param {Object} authUserData данные для авторизации
   * @param {string} authUserData.email email пользователя
   * @param {string} authUserData.password пароль пользователя
   * @returns {Promise<Object>} результат запроса
   */
  async signIn(authUserData) {
    const result = await this.api.post("/sign-in", authUserData);
    this._saveAccessToken(result);
    return result;
  }

  /**
   * Регистрируем нового пользователя.
   * @async
   * @param {Object} authUserData данные для регистрации
   * @param {string} authUserData.email email пользователя
   * @param {string} authUserData.password пароль пользователя
   * @param {string} authUserData.name имя пользователя
   * @returns {Promise<Object>} результат запроса
   */
  async signUp(authUserData) {
    const result = await this.api.post("/sign-up", authUserData);
    this._saveAccessToken(result);
    return result;
  }

  /**
   * Обновляет access token с помощью refresh token.
   * @async
   * @returns {Promise<Object>} результат запроса
   */
  async refresh() {
    const result = await this.api.post("/refresh");
    this._saveAccessToken(result);

    if (!result.ok && shouldClearSessionAfterRefreshFailure(result.status)) {
      this._clearSessionLocal();
    }

    return result;
  }

  /**
   * Получает информацию о текущем авторизованном пользователе.
   * @async
   * @returns {Promise<Object>} результат запроса с данными пользователя
   */
  async me() {
    return this.api.get("/me");
  }

  /**
   * Разлогин пользователя.
   * @async
   * @returns {Promise<Object>} результат запроса
   */
  async logout() {
    const result = await this.api.post("/logout");
    this._clearSessionLocal();
    return result;
  }

  /**
   * Обновляет профиль пользователя.
   * Передаёт дату рождения и аватарку одним multipart запросом.
   * @param {string|null} birthdate
   * @param {File|null} avatarFile
   */
  async updateProfile(birthdate, avatarFile = null) {
    const formData = new FormData();

    if (birthdate !== null && birthdate !== undefined) {
      formData.append("birthdate", String(birthdate));
    }

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    } else {
      formData.append("avatar", "null");
    }

    return this.api.put("/profile", formData);
  }

  /**
   * Меняет пароль пользователя.
   * @param {{old_password: string, new_password: string}} payload
   */
  async changePassword(payload) {
    return this.api.post("/change-password", payload);
  }

  /**
   * Переключает фильм в любимый / нелюбимый
   * @async
   * @param {string|number} movieId ID фильма.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async toggleFavorite(movieId) {
    return this.api.put(`/favorites/${movieId}`);
  }

  /**
   * Возвращает список избранных фильмов пользователя.
   * @async
   * @param {{limit?: number, offset?: number}} [options={}] параметры пагинации.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getFavorites({ limit = 10, offset = 0 } = {}) {
    return this.api.get("/favorites", { query: { limit, offset } });
  }

  /**
   * Возвращает подборку "Продолжить просмотр".
   * @async
   * @param {{limit?: number}} [options={}] параметры выборки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getContinueWatching({ limit = 5 } = {}) {
    return this.api.get("/watch/continue", { query: { limit } });
  }

  /**
   * Возвращает историю просмотра пользователя.
   * @async
   * @param {{limit?: number}} [options={}] параметры выборки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getWatchHistory({ limit = 10 } = {}) {
    return this.api.get("/watch/history", { query: { limit } });
  }

  /**
   * Возвращает недавно просмотренные фильмы (с порогом прогресса просмотра на бэкенде).
   * @async
   * @param {{limit?: number}} [options={}] параметры выборки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getWatchRecent({ limit = 10 } = {}) {
    return this.api.get("/watch/recent", { query: { limit } });
  }

  /**
   * Ищет пользователей по email.
   * @async
   * @param {string} query поисковая строка.
   * @param {{limit?: number}} [options={}] параметры выборки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async searchUsers(query, { limit = 10 } = {}) {
    return this.api.get("/search", { query: { query, limit } });
  }

  /**
   * Отправляет исходящую заявку в друзья.
   * @async
   * @param {string|number} toUserId ID пользователя, которому отправляется заявка.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async sendFriendRequest(toUserId) {
    return this.api.post(`/friends/${toUserId}`);
  }

  /**
   * Отвечает на входящую заявку в друзья.
   * @async
   * @param {string|number} requestId ID заявки.
   * @param {"accept"|"decline"|"cancel"|string} action действие над заявкой.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async respondToFriendRequest(requestId, action) {
    return this.api.post(`/friends/requests/${requestId}/respond`, { action });
  }

  /**
   * Отменяет исходящую заявку в друзья.
   * @async
   * @param {string|number} requestId ID заявки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async cancelFriendRequest(requestId) {
    return this.api.delete(`/friends/requests/${requestId}`);
  }

  /**
   * Возвращает список заявок в друзья.
   * @async
   * @param {{direction?: "incoming"|"outgoing"|string, limit?: number}} [options={}] параметры выборки.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getFriendRequests({ direction = "incoming", limit = 50 } = {}) {
    return this.api.get("/friends/requests", { query: { direction, limit } });
  }

  /**
   * Возвращает список друзей пользователя.
   * @async
   * @param {{limit?: number, offset?: number}} [options={}] параметры пагинации.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getFriendsList({ limit = 50, offset = 0 } = {}) {
    return this.api.get("/friends", { query: { limit, offset } });
  }

  /**
   * Удаляет пользователя из друзей.
   * @async
   * @param {string|number} userId ID друга.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async deleteFriend(userId) {
    return this.api.delete(`/friends/${userId}`);
  }
}

/**
 * Экземпляр сервиса пользователя.
 * @type {UserService}
 */
export const userService = new UserService(apiService);

function shouldClearSessionAfterRefreshFailure(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

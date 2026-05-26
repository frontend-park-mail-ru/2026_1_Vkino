import { apiService } from "./api.js";
import { paymentService } from "./PaymentService.js";
import {
  buildPlansFromTariffs,
  normalizeCapabilitiesFromApi,
} from "@/utils/subscriptionDisplay.js";
// import {
//   buildMockCoinsHistoryResponse,
//   MOCK_COINS_BALANCE,
//   USE_COINS_DEV_MOCKS,
// } from "@/dev/coinsDevMocks.js";

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
    const result = await this.api.get("/me");

    // if (USE_COINS_DEV_MOCKS && result.ok && result.resp) {
    //   result.resp = {
    //     ...result.resp,
    //     vkino_coins_count:
    //       result.resp.vkino_coins_count ??
    //       result.resp.vkino_coins_balance ??
    //       MOCK_COINS_BALANCE,
    //   };
    // }

    return result;
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
   * Список тарифных планов подписки (free + платные из payment-service).
   */
  async getSubscriptionPlans() {
    const result = await paymentService.getTariffs();
    if (!result.ok) {
      return result;
    }

    const tariffs = Array.isArray(result.resp?.tariffs) ? result.resp.tariffs : [];
    return {
      ok: true,
      resp: {
        plans: buildPlansFromTariffs(tariffs),
      },
    };
  }

  /**
   * Текущая подписка, capabilities и usage пользователя.
   */
  async getSubscriptionCapabilities() {
    return this.api.get("/subscription/capabilities");
  }

  /**
   * Текущая подписка пользователя (обёртка над capabilities).
   */
  async getCurrentUserSubscription() {
    const result = await this.getSubscriptionCapabilities();
    if (!result.ok) {
      return result;
    }

    const normalized = normalizeCapabilitiesFromApi(result.resp);

    return {
      ok: true,
      resp: {
        subscription: result.resp?.subscription ?? null,
        capabilities: normalized,
        usage: normalized.usage,
        raw: result.resp,
      },
    };
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
   * Создает или обновляет отзыв пользователя к фильму.
   * @async
   * @param {string|number} movieId ID фильма.
   * @param {{rating?: number, message?: string}} payload данные отзыва.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async setMovieReview(movieId, payload = {}) {
    const normalizedMovieId = normalizeUserEndpointId(movieId);

    if (!normalizedMovieId) {
      return createClientValidationError("UserService: не передан id фильма");
    }

    const normalizedPayload = {};
    const hasRating = Object.prototype.hasOwnProperty.call(payload, "rating");
    const hasMessage = Object.prototype.hasOwnProperty.call(payload, "message");

    if (hasRating) {
      const rating = Number(payload.rating);

      if (Number.isFinite(rating)) {
        normalizedPayload.rating = rating;
      }
    }

    if (hasMessage) {
      normalizedPayload.message = String(payload.message ?? "").trim();
    }

    return this.api.put(
      `/reviews/${encodeURIComponent(normalizedMovieId)}`,
      normalizedPayload,
    );
  }

  /**
   * Удаляет отзыв пользователя к фильму.
   * @async
   * @param {string|number} movieId ID фильма.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async deleteMovieReview(movieId) {
    const normalizedMovieId = normalizeUserEndpointId(movieId);

    if (!normalizedMovieId) {
      return createClientValidationError("UserService: не передан id фильма");
    }

    return this.api.delete(`/reviews/${encodeURIComponent(normalizedMovieId)}`);
  }

  /**
   * Ставит или меняет реакцию пользователя на чужой отзыв.
   * @async
   * @param {string|number} reviewId ID отзыва.
   * @param {"like"|"dislike"} reaction реакция пользователя.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async setReviewReaction(reviewId, reaction) {
    const normalizedReviewId = normalizeUserEndpointId(reviewId);
    const normalizedReaction = String(reaction || "")
      .trim()
      .toLowerCase();

    if (!normalizedReviewId) {
      return createClientValidationError("UserService: не передан id отзыва");
    }

    if (!["like", "dislike"].includes(normalizedReaction)) {
      return createClientValidationError("UserService: некорректная реакция");
    }

    return this.api.put(
      `/review-reactions/${encodeURIComponent(normalizedReviewId)}`,
      { reaction: normalizedReaction },
    );
  }

  /**
   * Удаляет реакцию пользователя на отзыв.
   * @async
   * @param {string|number} reviewId ID отзыва.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async deleteReviewReaction(reviewId) {
    const normalizedReviewId = normalizeUserEndpointId(reviewId);

    if (!normalizedReviewId) {
      return createClientValidationError("UserService: не передан id отзыва");
    }

    return this.api.delete(
      `/review-reactions/${encodeURIComponent(normalizedReviewId)}`,
    );
  }

  /**
   * Ставит отдельную пользовательскую оценку фильму без текста отзыва.
   * @async
   * @param {string|number} movieId ID фильма.
   * @param {number|string} rating оценка фильма.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async setMovieRating(movieId, rating) {
    const normalizedMovieId = normalizeUserEndpointId(movieId);
    const normalizedRating = Number(rating);

    if (!normalizedMovieId) {
      return createClientValidationError("UserService: не передан id фильма");
    }

    if (!Number.isFinite(normalizedRating)) {
      return createClientValidationError("UserService: некорректная оценка");
    }

    return this.api.put(`/ratings/${encodeURIComponent(normalizedMovieId)}`, {
      movie_id: normalizeMovieIdForPayload(normalizedMovieId),
      rating: normalizedRating,
    });
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

  /**
   * Возвращает историю операций VKino coins.
   * @async
   * @param {{limit?: number, offset?: number}} [options={}] параметры пагинации.
   * @returns {Promise<{ok: boolean, resp: Object}>} результат запроса.
   */
  async getCoinsHistory({ limit = 50, offset = 0 } = {}) {
    // if (USE_COINS_DEV_MOCKS) {
    //   return {
    //     ok: true,
    //     status: 200,
    //     resp: buildMockCoinsHistoryResponse({ limit, offset }),
    //     error: null,
    //   };
    // }

    return this.api.get("/coins/history", { query: { limit, offset } });
  }
}

/**
 * Экземпляр сервиса пользователя.
 * @type {UserService}
 */
export const userService = new UserService(apiService);

function normalizeUserEndpointId(value) {
  return String(value ?? "").trim();
}

function normalizeMovieIdForPayload(value) {
  const normalizedValue = normalizeUserEndpointId(value);
  const numericValue = Number(normalizedValue);

  return Number.isFinite(numericValue) ? numericValue : normalizedValue;
}

function createClientValidationError(error) {
  return {
    ok: false,
    status: 0,
    resp: null,
    error,
  };
}

function shouldClearSessionAfterRefreshFailure(status) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

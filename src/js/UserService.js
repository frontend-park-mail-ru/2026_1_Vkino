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

    if (!result.ok) {
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
}

/**
 * Экземпляр сервиса пользователя.
 * @type {UserService}
 */
export const userService = new UserService(apiService);

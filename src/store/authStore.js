import { createStore } from "./createStore.js";
import { authService } from "../js/AuthService.js";

const initialState = {
  status: "idle",
  user: null,
  error: null,
};

class AuthStore {
  /**
   * Инициализирует хранилище с начальным состоянием.
   */
  constructor() {
    this.store = createStore(initialState);
  }

  /**
   * Возвращает текущее состояние хранилища.
   * @returns {AuthState}
   */
  getState() {
    return this.store.getState();
  }

  /**
   * Подписывает обработчик на изменения состояния.
   * @param {Function} listener - Колбэк, вызываемый при каждом изменении стейта.
   * @returns {Function} Функция для отписки.
   */
  subscribe(listener) {
    return this.store.subscribe(listener);
  }

  /**
   * Метод для частичного обновления состояния.
   * @param {Partial<AuthState>} patch - Объект с обновляемыми полями.
   */
  _setState(patch) {
    this.store.setState(patch);
  }
  /**
   * Переводит состояние в статус "Гость".
   * @param {string|null} [error=null] - Опциональное сообщение об ошибке.
   */
  _setGuest(error = null) {
    this._setState({
      status: "guest",
      user: null,
      error,
    });
  }
  /**
   * Переводит состояние в статус "Авторизован".
   * @param {User} user - Объект данных пользователя.
   */
  _setAuthenticated(user) {
    this._setState({
      status: "authenticated",
      user,
      error: null,
    });
  }
  /**
   * Инициализация сессии при запуске приложения.
   * Проверяет наличие токена, пытается получить данные пользователя 
   * или обновить истекшую сессию.
   * @returns {Promise<void>}
   */
  async init() {
    this._setState({
      status: "loading",
      error: null,
    });

    const token = authService.getAccessToken();

    if (!token) {
      this._setGuest();
      return;
    }

    let meResult = await authService.me();

    if (meResult.ok) {
      this._setAuthenticated(meResult.resp);
      return;
    }

    if (meResult.status === 401) {
      const refreshResult = await authService.refresh();

      if (refreshResult.ok) {
        meResult = await authService.me();

        if (meResult.ok) {
          this._setAuthenticated(meResult.resp);
          return;
        }
      }
    }

    authService.clearAccessToken();
    this._setGuest("Не удалось восстановить сессию");
  }

  /**
   * Выполняет вход пользователя в систему.
   * @param {Object} credentials - Данные для входа (email, password).
   * @returns {Promise<Object>} Результат выполнения запроса (signInResult).
   */
  async signIn(credentials) {
    this._setState({
      status: "loading",
      error: null,
    });

    const signInResult = await authService.signIn(credentials);

    if (!signInResult.ok) {
      this._setGuest(signInResult.resp?.Error || "Не удалось выполнить вход");
      return signInResult;
    }

    const meResult = await authService.me();

    if (meResult.ok) {
      this._setAuthenticated(meResult.resp);
      return signInResult;
    }

    this._setGuest("Вход выполнен, но не удалось получить данные пользователя");
    return {
      ok: false,
      status: meResult.status,
      resp: {
        Error: "Не удалось получить данные пользователя",
      },
    };
  }

  /**
   * Регистрация нового пользователя.
   * @param {Object} data - Данные формы регистрации.
   * @returns {Promise<Object>} Результат выполнения запроса (signUpResult).
   */
  async signUp(data) {
    this._setState({
      status: "loading",
      error: null,
    });

    const signUpResult = await authService.signUp(data);

    if (!signUpResult.ok) {
      this._setGuest(
        signUpResult.resp?.Error || "Не удалось выполнить регистрацию",
      );
      return signUpResult;
    }

    const meResult = await authService.me();

    if (meResult.ok) {
      this._setAuthenticated(meResult.resp);
      return signUpResult;
    }

    this._setGuest(
      "Регистрация выполнена, но не удалось получить данные пользователя",
    );
    return {
      ok: false,
      status: meResult.status,
      resp: {
        Error: "Не удалось получить данные пользователя",
      },
    };
  }

  /**
   * Выход из системы.
   * Очищает токены через сервис и переводит состояние в режим гостя.
   * @returns {Promise<void>}
   */
  async logout() {
    await authService.logout();
    this._setGuest();
  }

  /**
   * Обновляет данные текущего пользователя в store без сброса сессии.
   * @param {Object} profile
   */
  updateUserProfile(profile) {
    const state = this.getState();
    if (state.status !== "authenticated" || !state.user) {
      return;
    }

    this._setState({
      user: {
        ...state.user,
        ...profile,
      },
    });
  }
}

/** 
 * Экспортируемый экземпляр AuthStore (Singleton).
 * @type {AuthStore} 
 */
export const authStore = new AuthStore();

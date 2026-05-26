import { createStore } from "./createStore.js";
import { userService } from "@/js/UserService.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import { extractProfile } from "@/utils/apiResponse.js";
import { extractCoinsBalanceFromProfile } from "@/utils/coinsDisplay.js";
import {
  normalizeCapabilitiesFromApi,
  normalizeSubscriptionFromApi,
} from "@/utils/subscriptionDisplay.js";

const initialState = {
  status: "idle",
  user: null,
  error: null,
};
const SESSION_RECOVERY_DEFERRED_ERROR =
  "Сессия сохранена, но backend временно недоступен";

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
    const normalizedUser = normalizeAuthUser(user);

    this._setState({
      status: "authenticated",
      user: normalizedUser,
      error: null,
    });
  }

  /**
   * Подмешивает подписку и capabilities в объект пользователя.
   * @param {Object} user
   * @param {Object|null} capabilitiesResponse — ответ GET /subscription/capabilities
   */
  _mergeSubscriptionIntoUser(user, capabilitiesResponse) {
    if (!user || !capabilitiesResponse) {
      return user;
    }

    const subscription = normalizeSubscriptionFromApi(
      capabilitiesResponse.subscription,
    );
    const capabilities = normalizeCapabilitiesFromApi(capabilitiesResponse);

    return {
      ...user,
      subscription,
      subscriptionRaw: capabilitiesResponse.subscription ?? null,
      capabilities,
      usage: capabilities.usage,
    };
  }

  /**
   * Загружает подписку с сервера и обновляет store.
   * @returns {Promise<boolean>} true если данные обновлены
   */
  async refreshSubscription() {
    const state = this.getState();
    if (state.status !== "authenticated" || !state.user) {
      return false;
    }

    const result = await userService.getSubscriptionCapabilities();
    if (!result.ok) {
      return false;
    }

    this._setState({
      user: this._mergeSubscriptionIntoUser(state.user, result.resp),
    });
    return true;
  }

  /**
   * Обновляет профиль пользователя с сервера (баланс coins, email и т.д.).
   * @returns {Promise<boolean>}
   */
  async refreshUserProfile() {
    const state = this.getState();
    if (state.status !== "authenticated" || !state.user) {
      return false;
    }

    const result = await userService.me();
    if (!result.ok) {
      return false;
    }

    this.updateUserProfile(result.resp);
    return true;
  }

  /**
   * После успешной оплаты обновляет подписку и профиль.
   * @returns {Promise<void>}
   */
  async refreshAfterPayment() {
    await Promise.all([this.refreshSubscription(), this.refreshUserProfile()]);
  }

  async _hydrateAuthenticatedUser(profile) {
    const user = extractProfile(profile);
    this._setAuthenticated(user);

    const subResult = await userService.getSubscriptionCapabilities();
    if (subResult.ok) {
      const state = this.getState();
      this._setState({
        user: this._mergeSubscriptionIntoUser(state.user, subResult.resp),
      });
    }
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

    const token = userService.getAccessToken();

    if (!token) {
      this._setGuest();
      return;
    }

    
   /*
    this._setAuthenticated({
      email: "mock-admin@vkino.tech",
      role: "admin",
    });
    return;
    */
    
   

    let meResult = await userService.me();


    if (meResult.ok) {
      await this._hydrateAuthenticatedUser(meResult.resp);
      return;
    }

    if (meResult.status === 401) {
      const refreshResult = await userService.refresh();

      if (refreshResult.ok) {
        meResult = await userService.me();

        if (meResult.ok) {
          await this._hydrateAuthenticatedUser(meResult.resp);
          return;
        }
      }

      if (isTransientAuthFailure(refreshResult.status)) {
        this._setGuest(SESSION_RECOVERY_DEFERRED_ERROR);
        return;
      }
    }

    if (isTransientAuthFailure(meResult.status)) {
      this._setGuest(SESSION_RECOVERY_DEFERRED_ERROR);
      return;
    }

    userService.clearAccessToken();
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

    const signInResult = await userService.signIn(credentials);

    if (!signInResult.ok) {
      this._setGuest(
        getApiErrorMessage(signInResult, {
          context: "sign-in",
          fallback: "Не удалось выполнить вход.",
        }),
      );
      return signInResult;
    }

    const meResult = await userService.me();

    if (meResult.ok) {
      await this._hydrateAuthenticatedUser(meResult.resp);
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

    const signUpResult = await userService.signUp(data);

    if (!signUpResult.ok) {
      this._setGuest(
        getApiErrorMessage(signUpResult, {
          fallback: "Не удалось выполнить регистрацию.",
        }),
      );
      return signUpResult;
    }

    const meResult = await userService.me();

    if (meResult.ok) {
      await this._hydrateAuthenticatedUser(meResult.resp);
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
    await userService.logout();
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

    const normalizedProfile = normalizeAuthUser(profile, {
      roleFallback: state.user.role,
    });

    this._setState({
      user: {
        ...state.user,
        ...normalizedProfile,
      },
    });
  }

  /**
   * Обновляет нормализованную подписку в профиле клиента (без запроса на сервер).
   * @param {Object|null} subscription — объект из normalizeSubscriptionFromApi или null при отмене
   */
  updateUserSubscription(subscription) {
    const state = this.getState();
    if (state.status !== "authenticated" || !state.user) {
      return;
    }

    const nextUser = { ...state.user };
    if (subscription == null) {
      delete nextUser.subscription;
      delete nextUser.subscriptionRaw;
    } else {
      nextUser.subscription = subscription;
    }

    this._setState({
      user: nextUser,
    });
  }

  /**
   * Обновляет capabilities в профиле клиента.
   * @param {Object|null} capabilities
   */
  updateUserCapabilities(capabilities) {
    const state = this.getState();
    if (state.status !== "authenticated" || !state.user) {
      return;
    }

    this._setState({
      user: {
        ...state.user,
        capabilities: capabilities ?? null,
        usage: capabilities?.usage ?? null,
      },
    });
  }

  /**
   * Обновляет баланс VKino coins локально.
   * @param {number} coinsBalance
   */
  updateUserCoinsBalance(coinsBalance) {
    const balance = Number(coinsBalance);
    if (!Number.isFinite(balance)) {
      return;
    }

    this.updateUserProfile({ vkino_coins_count: balance });
  }
}

function normalizeAuthUser(user = {}, { roleFallback = "user" } = {}) {
  if (!user || typeof user !== "object") {
    return {
      role: roleFallback,
    };
  }

  const role = String(user.role || roleFallback || "user").trim() || "user";
  const coinsBalance = extractCoinsBalanceFromProfile(user);

  return {
    ...user,
    role,
    coinsBalance,
  };
}

/**
 * Экспортируемый экземпляр AuthStore (Singleton).
 * @type {AuthStore}
 */
export const authStore = new AuthStore();

function isTransientAuthFailure(status) {
  return status === 0 || status >= 500;
}

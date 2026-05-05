import BasePage from "../BasePage.js";
import "./SignIn.precompiled.js";

import { initPasswordToggle } from "@/js/password/eye-btn.js";
import { initAuthValidation, setError } from "@/js/password/validation.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import { SupportWidgetController } from "@/utils/supportWidget.js";

/**
 * Класс страницы авторизации.
 * @extends BasePage
 */
export default class SignInPage extends BasePage {
  /**
   * Создает экземпляр страницы SignIn.
   * @param {Object} [context={}] - Контекст данных для Handlebars.
   * @param {Element|null} [parent=null] - Родительский элемент (опционально).
   * @param {Element} el - Корневой DOM-элемент, в который отрисовывается страница.
   * @throws {Error} Если не передан корневой элемент `el`.
   */
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("SignIn: не передан корневой элемент для SignIn");
    }

    super(
      context,
      Handlebars.templates["SignIn.hbs"],
      parent,
      el,
      "SignInPage",
    );
    this._destroyPasswordToggle = null;
    this._destroyValidation = null;
    this._supportWidget = null;
  }

  /**
   * Инициализирует страницу и вызывает базовый рендеринг.
   * @returns {void}
   */
  init() {
    if (authStore.getState().status === "authenticated") {
      router.go("/");
      return this;
    }

    return super.init();
  }

  /**
   * Навешивает обработчики:
   * 1. Инициализирует переключатель видимости пароля.
   * 2. Настраивает валидацию формы и перехват события отправки (submit).
   */
  addEventListeners() {
    this._destroyPasswordToggle = initPasswordToggle(this.el);

    const form = this.el.querySelector('form[data-auth-form="login"]');

    this._destroyValidation = initAuthValidation(form, {
      onSubmit: this.handleSubmit.bind(this),
    });

    this._supportWidget = new SupportWidgetController(this.el).init();
  }

  /**
   * Удаляет все обработчики и производит очистку вспомогательных модулей.
   * Вызывается автоматически роутером или родителем.
   */
  removeEventListeners() {
    if (this._destroyPasswordToggle) {
      this._destroyPasswordToggle();
      this._destroyPasswordToggle = null;
    }

    if (this._destroyValidation) {
      this._destroyValidation();
      this._destroyValidation = null;
    }

    if (this._supportWidget) {
      this._supportWidget.destroy();
      this._supportWidget = null;
    }
  }

  /**
   * Обработчик отправки формы авторизации.
   * Выполняет запрос к API через `authStore`. При ошибке отображает сообщение пользователю.
   * @param {Object} authUserData - Данные пользователя из формы.
   * @returns {Promise<void>}
   */
  async handleSubmit(authUserData) {
    const result = await authStore.signIn(authUserData);

    if (!result.ok) {
      const password = this.el.querySelector("#password");
      const passwordError = this.el.querySelector("#password-error");

      setError(
        password,
        passwordError,
        getApiErrorMessage(result, {
          context: "sign-in",
          fallback: "Не удалось выполнить вход.",
        }),
      );
      return;
    }

    if (typeof this.context.onSuccess === "function") {
      this.context.onSuccess(result.resp);
    }
  }
}

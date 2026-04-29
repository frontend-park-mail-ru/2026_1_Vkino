import BasePage from "../BasePage.ts";
import "./SignIn.precompiled.js";

import { initPasswordToggle } from "@/js/password/eye-btn.ts";
import { initAuthValidation, setError } from "@/js/password/validation.ts";
import { router } from "@/router/index.ts";
import { authStore } from "@/store/authStore.ts";
import { SupportWidgetController } from "@/utils/supportWidget.ts";

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
  constructor(
    context: AnyRecord = {},
    parent: BasePage | null = null,
    el: Element | null = null,
  ) {
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

    const form = this.el.querySelector<HTMLFormElement>('form[data-auth-form="login"]');

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
      const password = this.el.querySelector<HTMLInputElement>("#password");
      const passwordError = this.el.querySelector<HTMLElement>("#password-error");

      setError(
        password,
        passwordError,
        result.resp?.Error ||
          result.resp?.message ||
          result.error ||
          "Не удалось выполнить вход",
      );
      return;
    }

    if (typeof this.context.onSuccess === "function") {
      this.context.onSuccess(result.resp);
    }
  }
}

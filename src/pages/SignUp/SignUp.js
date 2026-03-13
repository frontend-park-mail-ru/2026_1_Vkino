import BasePage from "../BasePage.js";
import "./SignUp.precompiled.js";

import { attachPageStyles } from "../../utils/pageStyles.js";
import { initPasswordToggle } from "../../js/password/eye-btn.js";
import { initAuthValidation, setError } from "../../js/password/validation.js";
import { initRegisterBottleEffect } from "../../js/register.js";
import { authStore } from "../../store/authStore.js";

/**
 * @typedef {Object} AuthUserData
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} SignUpPageContext
 * @property {(response: unknown) => void} [onSuccess] Колбэк успешной регистрации.
 */

/**
 * Страница регистрации пользователя.
 */
export default class SignUpPage extends BasePage {
  /**
   * @param {SignUpPageContext} [context={}] Контекст страницы с внешними колбэками.
   * @param {BasePage|null} [parent=null] Родительская страница.
   * @param {HTMLElement|null} [el=null] Корневой DOM-элемент страницы.
   */
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("SignUp: не передан корневой элемент для SignUp");
    }

    super(
      context,
      Handlebars.templates["SignUp.hbs"],
      parent,
      el,
      "SignUpPage",
    );

    this._detachStyles = null;
    this._destroyPasswordToggle = null;
    this._destroyValidation = null;
    this._destroyBottleEffect = null;
  }

  /**
   * Подключает стили страницы и вызывает базовую инициализацию.
   *
   * @returns {*}
   */
  init() {
    this._detachStyles = attachPageStyles(
      ["/css/main.css", "/css/auth.css", "/css/register.css"],
      "sign-up",
    );

    return super.init();
  }

  /**
   * Инициализирует обработчики страницы:
   * переключение видимости пароля, валидацию формы и canvas-эффект.
   *
   * @returns {void}
   */
  addEventListeners() {
    this._destroyPasswordToggle = initPasswordToggle(this.el);

    const form = this.el.querySelector('form[data-auth-form="register"]');
    this._destroyValidation = initAuthValidation(form, {
      onSubmit: this.handleSubmit.bind(this),
    });

    this._destroyBottleEffect = initRegisterBottleEffect(this.el);
  }

  /**
   * Удаляет все обработчики, созданные в {@link addEventListeners}.
   *
   * @returns {void}
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

    if (this._destroyBottleEffect) {
      this._destroyBottleEffect();
      this._destroyBottleEffect = null;
    }
  }

  /**
   * Отправляет данные регистрации и показывает сообщение об ошибке при ошибке.
   *
   * @param {AuthUserData} authUserData Данные пользователя из формы.
   * @returns {Promise<void>}
   */
  async handleSubmit(authUserData) {
    const result = await authStore.signUp(authUserData);

    const MapError = {
      "user already exists": "такой пользователь уже существует",
      "invalid credentials": "Некорректные данные для учётной записи",
      "internal server error": "Ошибка сервера",
    };

    if (!result.ok) {
      const email = this.el.querySelector('input[type="email"]');
      const password = this.el.querySelector("#password");
      const passwordError = this.el.querySelector("#password-error");

      setError(
        email,
        password,
        passwordError,
        MapError[result.resp?.Error] ||
          result.resp?.message ||
          result.error ||
          "Не удалось зарегистрироваться",
      );
      return;
    }

    if (typeof this.context.onSuccess === "function") {
      this.context.onSuccess(result.resp);
    }
  }

  /**
   * Отключает стили страницы перед удалением экземпляра.
   *
   * @returns {void}
   */
  beforeDestroy() {
    if (this._detachStyles) {
      this._detachStyles();
      this._detachStyles = null;
    }
  }
}

import BasePage from "../BasePage.ts";
import "./SignUp.precompiled.js";
import "@/css/register.scss";
import { initPasswordToggle } from "@/js/password/eye-btn.ts";
import { initAuthValidation, setError } from "@/js/password/validation.ts";
import { initRegisterBottleEffect } from "@/js/register.ts";
import { router } from "@/router/index.ts";
import { authStore } from "@/store/authStore.ts";
import type { SignUpCredentials } from "@/types/user.ts";

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
  constructor(
    context: AnyRecord = {},
    parent: BasePage | null = null,
    el: Element | null = null,
  ) {
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
    this._destroyPasswordToggle = null;
    this._destroyValidation = null;
    this._destroyBottleEffect = null;
  }

  /**
   * Выполняет базовую инициализацию страницы.
   *
   * @returns {*}
   */
  init() {
    if (authStore.getState().status === "authenticated") {
      router.go("/");
      return this;
    }

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

    const form = this.el.querySelector<HTMLFormElement>('form[data-auth-form="register"]');
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
  async handleSubmit(authUserData: SignUpCredentials) {
    const result = await authStore.signUp(authUserData);

    const MapError: Record<string, string> = {
      "user already exists": "такой пользователь уже существует",
      "invalid credentials": "Некорректные данные для учётной записи",
      "internal server error": "Ошибка сервера",
    };

    if (!result.ok) {
      const email = this.el.querySelector<HTMLInputElement>('input[type="email"]');
      const emailError = this.el.querySelector<HTMLElement>("#email-error");
      const password = this.el.querySelector<HTMLInputElement>("#password");
      const passwordError = this.el.querySelector<HTMLElement>("#password-error");
      const errorKey = typeof result.resp?.Error === "string" ? result.resp.Error : "";
      const message =
        MapError[errorKey] ||
        result.resp?.message ||
        result.error ||
        "Не удалось зарегистрироваться";

      setError(email, emailError, "");
      setError(password, passwordError, "");

      if (result.status === 409) {
        setError(email, emailError, "Пользователь с таким email уже существует");
        return;
      }

      setError(password, passwordError, message);
      return;
    }

    if (typeof this.context.onSuccess === "function") {
      this.context.onSuccess(result.resp);
    }
  }
}

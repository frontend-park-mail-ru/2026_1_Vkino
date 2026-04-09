import { BaseComponent } from "../BaseComponent.js";
import "./Header.precompiled.js";
import { authStore } from "../../store/authStore.js";

/**
 * Компонент header
 * Отображает навигацию, информацию о пользователе и кнопки авторизации/выхода + войти/зарегистрироваться.
 * Автоматически реагирует на изменения статуса авторизации через authStore.
 */
export default class HeaderComponent extends BaseComponent {
  /**
   * Конструирует header.
   * @constructor
   * @param {Object} context контекст отрисовки шаблона
   * @param {Element} parent элемент, в который будет отрисован шаблон
   * @param {Element} el корневой элемент компонента
   * @throws {Error} если не передан parent или el
   */
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error("Header: не передан parent для HeaderComponent");
    }

    if (!el) {
      throw new Error("Header: не передан el для HeaderComponent");
    }

    super(context, Handlebars.templates["Header.hbs"], parent, el);

    this._unsubscribe = null;
  }

  /**
   * Инициализирует компонент. Заполняет контекст данными о текущем пользователе.
   * @returns {Promise<HeaderComponent>} текущий экземпляр компонента
   */
  init() {
    const state = authStore.getState();

    this.context = {
      ...this.context,
      isAuthorized: state.status === "authenticated",
      userName: getTruncatedEmail(state.user?.email),
      avatarUrl: state.user?.avatar_url || "",
    };

    return super.init();
  }

  /**
   * Добавляет обработчики событий.
   * Подписывается на изменения в authStore и добавляет обработчик клика на кнопку выхода.
   */
  addEventListeners() {
    this._unsubscribe = authStore.subscribe((state) => {
      this.refresh({
        ...this.context,
        isAuthorized: state.status === "authenticated",
        userName: getTruncatedEmail(state.user?.email),
        avatarUrl: state.user?.avatar_url || "",
      });
    });
    const logoutBtn = this.el.querySelector('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.addEventListener("click", this._onLogoutClick);
    }
  }

  /**
   * Удаляет обработчики событий.
   * Отписывается от изменений в authStore и удаляет обработчик клика с кнопки выхода.
   */
  removeEventListeners() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    const logoutBtn = this.el.querySelector('[data-action="logout"]');
    if (logoutBtn) {
      logoutBtn.removeEventListener("click", this._onLogoutClick);
    }
  }

  /**
   * Обработчик клика по кнопке выхода.
   * @private
   * @param {Event} e событие клика
   */
  _onLogoutClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await authStore.logout();
    console.log(res);
  };
}

/**
 * Возвращает email в коротком формате для отображения в header.
 * @private
 * @param {string} [email=""] email пользователя
 * @returns {string} обрезанный email или пустая строка
 */
function getTruncatedEmail(email = "") {
  const normalized = String(email).trim();
  if (!normalized) return "";

  if (normalized.length <= 22) {
    return normalized;
  }

  return `${normalized.slice(0, 19)}...`;
}

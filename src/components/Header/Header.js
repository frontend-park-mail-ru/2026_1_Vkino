import { BaseComponent } from "@/components/BaseComponent.js";
import "@/components/Header/Header.precompiled.js";
import { authStore } from "@/store/authStore.js";
import { router } from "@/router/index.js";
import { resolveAvatarUrl } from "@/utils/avatar.js";
import { getDisplayNameFromEmail } from "@/utils/user.js";
import { canManageSupportTicketStatus } from "@/utils/support.js";


const PENDING_SCROLL_TARGET_KEY = "vkino_pending_scroll_target";

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
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
    this._onWindowScrollBound = this._onWindowScroll.bind(this);
  }

  /**
   * Инициализирует компонент. Заполняет контекст данными о текущем пользователе.
   * @returns {Promise<HeaderComponent>} текущий экземпляр компонента
   */
  init() {
    this.context = this._buildContext(authStore.getState(), this.context);

    return super.init();
  }

  /**
   * Добавляет обработчики событий.
   * Подписывается на изменения в authStore и добавляет обработчик клика на кнопку выхода.
   */
  addEventListeners() {
    this._subscribeToAuth();
    this._bindToggleButton(
      '[data-action="toggle-burger-menu"]',
      this._onBurgerToggleClick,
    );
    this._bindToggleButton(
      '[data-action="toggle-profile-menu"]',
      this._onProfileToggleClick,
    );
    this._bindToggleButton(
      '[data-action="toggle-search"]',
      this._onSearchToggleClick,
    );
    this._bindToggleButton('[data-action="logout"]', this._onLogoutClick);
    this._bindNodeList(
      '[data-action="close-all-menus"]',
      this._onCloseAllMenusClick,
    );
    this._bindNodeList(
      '[data-action="scroll-to-section"]',
      this._onScrollToSectionClick,
    );
    this._bindSubmitForm('[data-menu="search"]', this._onSearchSubmit);
    document.addEventListener("click", this._onDocumentClickBound);
    window.addEventListener("scroll", this._onWindowScrollBound, {
      passive: true,
    });
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

    this._unbindToggleButton(
      '[data-action="toggle-burger-menu"]',
      this._onBurgerToggleClick,
    );
    this._unbindToggleButton(
      '[data-action="toggle-profile-menu"]',
      this._onProfileToggleClick,
    );
    this._unbindToggleButton(
      '[data-action="toggle-search"]',
      this._onSearchToggleClick,
    );
    this._unbindToggleButton('[data-action="logout"]', this._onLogoutClick);
    this._unbindNodeList(
      '[data-action="close-all-menus"]',
      this._onCloseAllMenusClick,
    );
    this._unbindNodeList(
      '[data-action="scroll-to-section"]',
      this._onScrollToSectionClick,
    );
    this._unbindSubmitForm('[data-menu="search"]', this._onSearchSubmit);
    document.removeEventListener("click", this._onDocumentClickBound);
    window.removeEventListener("scroll", this._onWindowScrollBound);
  }

  /**
   * Обработчик клика по кнопке выхода.
   * @private
   * @param {Event} e событие клика
   */
  _onBurgerToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleBurgerMenu();
  };

  _onProfileToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleProfileMenu();
  };

  _onSearchToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleSearch();
  };

  _onCloseAllMenusClick = () => {
    this.closeAllMenus();
  };

  _onScrollToSectionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget.dataset.scrollTarget;
    if (!target) {
      return;
    }

    this.closeAllMenus();

    if (window.location.pathname !== "/") {
      sessionStorage.setItem(PENDING_SCROLL_TARGET_KEY, target);
      router.go("/");
      return;
    }

    scrollToMainSection(target);
  };

  _onSearchSubmit = (e) => {
    e.preventDefault();
  };

  _onLogoutClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.closeAllMenus();
    await authStore.logout();
    router.go("/");
  };

  _onDocumentClick(e) {
    if (!this.context.isAnyMenuOpen) {
      return;
    }

    if (this._isClickInsideMenu(e.target)) {
      return;
    }

    this.closeAllMenus();
  }

  _onWindowScroll() {
    if (!this.context.isAnyMenuOpen && !this.context.isSearchOpen) {
      return;
    }

    this.closeAllMenus();
  }

  toggleBurgerMenu() {
    this._applyMenuState({
      isBurgerMenuOpen: !this.context.isBurgerMenuOpen,
      isProfileMenuOpen: false,
      isSearchOpen: false,
    });
  }

  closeBurgerMenu() {
    if (!this.context.isBurgerMenuOpen) {
      return;
    }

    this._applyMenuState({ isBurgerMenuOpen: false });
  }

  toggleProfileMenu() {
    if (!this.context.isAuthorized) {
      return;
    }

    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: !this.context.isProfileMenuOpen,
      isSearchOpen: false,
    });
  }

  toggleSearch() {
    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: false,
      isSearchOpen: !this.context.isSearchOpen,
    });
  }

  closeAllMenus() {
    if (!this.context.isAnyMenuOpen && !this.context.isSearchOpen) {
      return;
    }

    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: false,
      isSearchOpen: false,
    });
  }

  _subscribeToAuth() {
    this._unsubscribe = authStore.subscribe((state) => {
      this.refresh(this._buildContext(state, this.context));
    });
  }

  _buildContext(state, currentContext = {}) {
    const isAuthorized = state.status === "authenticated";
    const avatarUrl = resolveAvatarUrl(state.user?.avatar_url);
    const canManageSupportTickets = canManageSupportTicketStatus(
      state.user?.role,
    );
    const currentPath = window.location.pathname;
    const nextContext = {
      ...currentContext,
      isAuthorized,
      userName: getDisplayNameFromEmail(state.user?.email),
      avatarUrl,
      supportTicketsHref: "/support",
      supportTicketsLabel: canManageSupportTickets
        ? "Панель поддержки"
        : "Мои обращения",
      isWatchPartyActive:
        currentPath === "/watch-party" || currentPath.startsWith("/watch-party/"),
      isBurgerMenuOpen: currentContext.isBurgerMenuOpen ?? false,
      isSearchOpen: currentContext.isSearchOpen ?? false,
      isProfileMenuOpen: isAuthorized
        ? (currentContext.isProfileMenuOpen ?? false)
        : false,
    };

    return {
      ...nextContext,
      isAnyMenuOpen:
        nextContext.isBurgerMenuOpen || nextContext.isProfileMenuOpen,
    };
  }

  _applyMenuState(nextState) {
    const nextContext = {
      ...this.context,
      ...nextState,
    };

    nextContext.isAnyMenuOpen =
      nextContext.isBurgerMenuOpen || nextContext.isProfileMenuOpen;

    this.refresh(nextContext);
  }

  _isClickInsideMenu(target) {
    const burgerButton = this.el.querySelector(
      '[data-action="toggle-burger-menu"]',
    );
    const profileButton = this.el.querySelector(
      '[data-action="toggle-profile-menu"]',
    );
    const searchButton = this.el.querySelector('[data-action="toggle-search"]');
    const burgerMenu = this.el.querySelector('[data-menu="burger"]');
    const profileMenu = this.el.querySelector('[data-menu="profile"]');
    const searchMenu = this.el.querySelector('[data-menu="search"]');

    return (
      burgerButton?.contains(target) ||
      profileButton?.contains(target) ||
      searchButton?.contains(target) ||
      burgerMenu?.contains(target) ||
      profileMenu?.contains(target) ||
      searchMenu?.contains(target)
    );
  }

  _bindToggleButton(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.addEventListener("click", handler);
  }

  _unbindToggleButton(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.removeEventListener("click", handler);
  }

  _bindNodeList(selector, handler) {
    const nodes = this.el.querySelectorAll(selector);
    nodes.forEach((node) => {
      node.addEventListener("click", handler);
    });
  }

  _unbindNodeList(selector, handler) {
    const nodes = this.el.querySelectorAll(selector);
    nodes.forEach((node) => {
      node.removeEventListener("click", handler);
    });
  }

  _bindSubmitForm(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.addEventListener("submit", handler);
  }

  _unbindSubmitForm(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.removeEventListener("submit", handler);
  }
}

function scrollToMainSection(target) {
  const escapedTarget = window.CSS?.escape ? window.CSS.escape(target) : target;
  const section = document.querySelector(
    `[data-scroll-id="${escapedTarget}"]`,
  );

  if (!section) {
    return false;
  }

  section.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  return true;
}

export function consumePendingMainScrollTarget() {
  const target = sessionStorage.getItem(PENDING_SCROLL_TARGET_KEY);

  if (!target) {
    return "";
  }

  sessionStorage.removeItem(PENDING_SCROLL_TARGET_KEY);
  return target;
}

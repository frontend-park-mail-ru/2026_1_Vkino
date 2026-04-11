export class Router {
  /**
   * Создает экземпляр роутера
   * @param {Element} root
   * @throws {Error} если не передан root
   */
  constructor(root) {
    if (!root) {
      throw new Error("Router: не передан корневой DOM-элемент");
    }

    // Корневой контейнер, куда будут монтироваться страницы
    this.root = root;
    // Таблица маршрутов: path -> builder страницы
    this.routeTable = new Map();
    // Текущая активная страница
    this.activePage = null;
    // Привязка методов к экземпляру
    this._syncRoute = this._syncRoute.bind(this);
    this._processLinkClick = this._processLinkClick.bind(this);

    // Делегирование кликов по ссылкам внутри документа
    document.addEventListener("click", this._processLinkClick);
    // Назад/вперед в браузере
    window.addEventListener("popstate", this._syncRoute);
  }


  /**
   * Регистрирует новый путь.
   * @param {string} path - URL путь.
   * @param {Function} component - Обработчик отрисовки страницы.
   * @returns {Router} Текущий экземпляр для цепочки вызовов.
   * @throws {Error} Если путь не указан или строитель не является функцией.
   */
  registerRoute(path, pageBuilder) {
    if (!path) {
      throw new Error("Router: не указан path");
    }
    if (typeof pageBuilder !== "function") {
      throw new Error(
        `Router: pageBuilder для пути "${path}" должен быть функцией`,
      );
    }
    this.routeTable.set(this._formatPath(path), pageBuilder);
    return this;
  }

  /**
   * Переход на указанный маршрут.
   * Добавляет запись в историю браузера и синхронизирует состояние.
   * @param {string} path - Путь для перехода.
   */
  go(path) {
    const normalizedPath = this._formatPath(path);
    if (window.location.pathname === normalizedPath) {
      return;
    }
    window.history.pushState({}, "", normalizedPath);
    this._syncRoute();
  }

  /**
   * Инициализирует роутер
   */
  init() {
    console.log("Router initialized");
    this._syncRoute();
  }

  /**
   * Уничтожает экземпляр роутера.
   * Удаляет обработчики событий и вызывает метод destroy у активной страницы.
   */
  destroy() {
    document.removeEventListener("click", this._processLinkClick);
    window.removeEventListener("popstate", this._syncRoute);
    if (this.activePage?.destroy) {
      this.activePage.destroy();
    }
    this.activePage = null;
  }

  /**
   * Обрабатывает клики по всему документу.
   * Если клик был по ссылке с атрибутом [router-link], отменяет стандартный переход
   * и вызывает внутреннюю навигацию.
   * @param {MouseEvent} event - Событие клика.
   */
  _processLinkClick(event) {
    const link = event.target.closest("[router-link]");
    if (!link) {
      return;
    }
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    const href = link.getAttribute("href");
    console.log("Router href =", href);
    if (!href) {
      return;
    }
    event.preventDefault();
    this.go(href);
  }

  /**
   * Основная логика сопоставления текущего URL с таблицей маршрутов.
   * Очищает контейнер, уничтожает старую страницу и запускает новую.
   * @throws {Error} Если маршрут не найден (и нет 404) или строитель вернул некорректный объект.
   */
  _syncRoute() {
    const path = this._formatPath(window.location.pathname);
    console.log("route path =", path);
    const pageBuilder =
      this.routeTable.get(path) || this.routeTable.get("/404");
    console.log("pageBuilder =", pageBuilder);

    if (!pageBuilder) {
      throw new Error(
        `Router: маршрут "${path}" не найден и маршрут "/404" не зарегистрирован`,
      );
    }

    if (this.activePage?.destroy) {
      this.activePage.destroy();
    }

    this.root.innerHTML = "";
    const page = pageBuilder(this.root);
    if (!page || typeof page.init !== "function") {
      throw new Error(
        `Router: builder для пути "${path}" должен возвращать страницу с методом init()`,
      );
    }

    this.activePage = page;
    page.init();
  }

  /**
   * Нормализует путь.
   * Убирает лишние слэши в конце и приводит пустую строку к '/'.
   * @param {string} path - Исходный путь.
   * @returns {string} Нормализованный путь.
   */
  _formatPath(path) {
    if (!path || path === "/") {
      return "/";
    }
    return path.endsWith("/") ? path.slice(0, -1) : path;
  }

  /**
   * Ищет обработчик для точного или параметризованного маршрута.
   * @param {string} path
   * @returns {Function|undefined}
   */
  _matchRoute(path) {
    const exactMatch = this.routeTable.get(path);

    if (exactMatch) {
      return exactMatch;
    }

    const pathParts = path.split("/").filter(Boolean);

    for (const [routePath, pageBuilder] of this.routeTable.entries()) {
      const routeParts = routePath.split("/").filter(Boolean);

      if (routeParts.length !== pathParts.length) {
        continue;
      }

      const isMatch = routeParts.every((routePart, index) => {
        return routePart.startsWith(":") || routePart === pathParts[index];
      });

      if (isMatch) {
        return pageBuilder;
      }
    }

    return undefined;
  }
}

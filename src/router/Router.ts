export interface PageInstance {
  init: () => void | PageInstance;
  destroy?: () => void;
}

export type PageBuilder = (root: Element) => PageInstance;

export class Router {
  private root: Element;
  private routeTable: Map<string, PageBuilder>;
  private activePage: PageInstance | null;

  /**
   * Создает экземпляр роутера
   * @param root корневой DOM-элемент
   * @throws Error если не передан root
   */
  constructor(root: Element) {
    if (!root) {
      throw new Error("Router: не передан корневой DOM-элемент");
    }

    // Корневой контейнер, куда будут монтироваться страницы
    this.root = root;
    // Таблица маршрутов: path -> builder страницы
    this.routeTable = new Map<string, PageBuilder>();
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
   * @param path URL путь
   * @param pageBuilder обработчик отрисовки страницы
   * @returns текущий экземпляр для цепочки вызовов
   * @throws Error если путь не указан или строитель не является функцией
   */
  registerRoute(path: string, pageBuilder: PageBuilder): Router {
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
   * @param path путь для перехода
   */
  go(path: string): void {
    const normalizedPath = this._formatPath(path);
    const currentPath = `${window.location.pathname}${window.location.search}`;

    if (currentPath === normalizedPath) {
      return;
    }

    window.history.pushState({}, "", normalizedPath);
    this._syncRoute();
  }

  /**
   * Инициализирует роутер
   */
  init(): void {
    this._syncRoute();
  }

  /**
   * Уничтожает экземпляр роутера.
   * Удаляет обработчики событий и вызывает метод destroy у активной страницы.
   */
  destroy(): void {
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
   * @param event событие клика
   */
  private _processLinkClick(event: MouseEvent): void {
    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("[router-link]");

    if (!(link instanceof Element)) {
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

    if (!href) {
      return;
    }

    event.preventDefault();
    this.go(href);
  }

  /**
   * Основная логика сопоставления текущего URL с таблицей маршрутов.
   * Очищает контейнер, уничтожает старую страницу и запускает новую.
   * @throws Error если маршрут не найден (и нет 404) или строитель вернул некорректный объект
   */
  private _syncRoute(): void {
    const path = this._formatPath(window.location.pathname);

    const pageBuilder = this._matchRoute(path) || this.routeTable.get("/404");

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
   * Убирает лишние слэши в конце и приводит пустую строку к '/'
   * @param path исходный путь
   * @returns нормализованный путь
   */
  private _formatPath(path: string): string {
    if (!path || path === "/") {
      return "/";
    }

    return path.endsWith("/") ? path.slice(0, -1) : path;
  }

  /**
   * Ищет обработчик для точного или параметризованного маршрута.
   * @param path путь
   * @returns pageBuilder или undefined
   */
  private _matchRoute(path: string): PageBuilder | undefined {
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

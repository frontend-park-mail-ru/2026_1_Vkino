export class Router {
    constructor(root) {
        if (!root) {
            throw new Error('Router: не передан корневой DOM-элемент');
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
        document.addEventListener('click', this._processLinkClick);
        // Назад/вперед в браузере
        window.addEventListener('popstate', this._syncRoute);
    }

    // Регистрация маршрута
    registerRoute(path, pageBuilder) {
        if (!path) {
            throw new Error('Router: не указан path');
        }
        if (typeof pageBuilder !== 'function') {
            throw new Error(`Router: pageBuilder для пути "${path}" должен быть функцией`);
        }
        this.routeTable.set(this._formatPath(path), pageBuilder);
        return this;
    }

    // Переход на новый маршрут без перезагрузки страницы
    go(path) {
        const normalizedPath = this._formatPath(path);
        if (window.location.pathname === normalizedPath) {
            return;
        }
        window.history.pushState({}, '', normalizedPath);
        this._syncRoute();
    }

    // Запуск роутера
    init() {
        console.log('Router initialized');
        this._syncRoute();
    }

    // Уничтожение роутера
    destroy() {
        document.removeEventListener('click', this._processLinkClick);
        window.removeEventListener('popstate', this._syncRoute);
        if (this.activePage?.destroy) {
            this.activePage.destroy();
        }
        this.activePage = null;
    }

    // Обработка кликов по ссылкам с router-link
    _processLinkClick(event) {
        const link = event.target.closest('[router-link]');
        if (!link) {
            return;
        }
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }

        const href = link.getAttribute('href');
        console.log('Router href =', href);
        if (!href) {
            return;
        }
        event.preventDefault();
        this.go(href);
    }

    // Основная логика выбора и запуска страницы
    _syncRoute() {
        const path = this._formatPath(window.location.pathname);
        console.log('route path =', path);
        const pageBuilder = this.routeTable.get(path) || this.routeTable.get('/404');
        console.log('pageBuilder =', pageBuilder);

        if (!pageBuilder) {
            throw new Error(`Router: маршрут "${path}" не найден и маршрут "/404" не зарегистрирован`);
        }

        if (this.activePage?.destroy) {
            this.activePage.destroy();
        }

        this.root.innerHTML = '';
        const page = pageBuilder(this.root);
        if (!page || typeof page.init !== 'function') {
            throw new Error(`Router: builder для пути "${path}" должен возвращать страницу с методом init()`);
        }

        this.activePage = page;
        page.init();
    }

    // Нормализация пути:
    // '/sign-in/' -> '/sign-in'; '' -> '/'
    _formatPath(path) {
        if (!path || path === '/') {
            return '/';
        }
        return path.endsWith('/') ? path.slice(0, -1) : path;
    }
}
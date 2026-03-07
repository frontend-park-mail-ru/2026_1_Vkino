export class Router {
    constructor(root) {
        if (!root) {
            throw new Error('Router: не передан корневой DOM-элемент');
        }

        // DOM-элемент, в который будут монтироваться страницы
        this.root = root;
        // Хранилище маршрутов path -> factory экземпляр страницы
        this.routes = new Map();
        // Текущая активная страница
        this._currentPage = null;

        // Привязка методов к экземпляру
        this._handleRoute = this._handleRoute.bind(this);
        this._handleLinkClick = this._handleLinkClick.bind(this);

        // Обработка переходов назад/вперёд в браузере
        window.addEventListener('popstate', this._handleRoute);
        // Делегирование кликов по ссылкам внутри документа
        document.addEventListener('click', this._handleLinkClick);
    }

    // Регистрация маршрута
    addRoute(path, pageFactory) {
        if (!path) {
            throw new Error('Router: не указан path');
        }
        if (typeof pageFactory !== 'function') {
            throw new Error(`Router: pageFactory для пути "${path}" должен быть функцией`);
        }

        this.routes.set(this._normalizePath(path), pageFactory);
        return this;
    }

    // Переход на новый маршрут без перезагрузки страницы
    navigate(path) {
        const normalizedPath = this._normalizePath(path);
        if (window.location.pathname === normalizedPath) {
            return;
        }
        window.history.pushState({}, '', normalizedPath);
        this._handleRoute();
    }

    // Запуск роутера
    start() {
        console.log("Router started: ")
        this._handleRoute();
    }

    // Уничтожение текущей страницы и отвязка событий роутера
    destroy() {
        window.removeEventListener('popstate', this._handleRoute);
        document.removeEventListener('click', this._handleLinkClick);

        if (this._currentPage?.destroy) {
            this._currentPage.destroy();
        }

        this._currentPage = null;
    }

    // Обработка кликов по ссылкам с data-link
    _handleLinkClick(event) {
        const link = event.target.closest('[data-link]');
        if (!link) {
            return;
        }
        // Не мешаем открытию в новой вкладке/окне
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
            return;
        }
        // перенаправляем на ссылку в href
        const href = link.getAttribute('href');
        console.log('Router href =', href);
        if (!href) {
            return;
        }
        event.preventDefault();
        this.navigate(href);
    }

    // Основная логика выбора и запуска страницы
    _handleRoute() {
        const path = this._normalizePath(window.location.pathname);
        console.log('route path =', path);
        // Ищем страницу по текущему URL, иначе fallback на /404
        const pageFactory = this.routes.get(path) || this.routes.get('/404');
        console.log('pageFactory =', pageFactory);
        if (!pageFactory) {
            throw new Error(`Router: маршрут "${path}" не найден и маршрут "/404" не зарегистрирован`);
        }

        // Уничтожаем предыдущую страницу перед монтированием новой
        if (this._currentPage?.destroy) {
            this._currentPage.destroy();
        }
        this.root.innerHTML = '';

        // Создаём новую страницу
        const page = pageFactory(this.root);
        if (!page || typeof page.init !== 'function') {
            throw new Error(`Router: factory для пути "${path}" должна возвращать страницу с методом init()`);
        }
        this._currentPage = page;
        // Монтируем страницу
        page.init();
    }

    // Нормализация пути:
    // '/sign-in/' -> '/sign-in'; '' -> '/'
    _normalizePath(path) {
        if (!path || path === '/') {
            return '/';
        }
        return path.endsWith('/') ? path.slice(0, -1) : path;
    }
}
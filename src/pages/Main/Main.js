import BasePage from '../BasePage.js';
import './Main.precompiled.js';

import { movieService } from '../../js/MovieService.js';
import HeaderComponent from '../../components/Header/Header.js';

export default class MainPage extends BasePage {
    constructor(context = {}, parent = null, el = null) {
        if (!el) {
            throw new Error('Main: не передан корневой элемент для MainPage');
        }

        super(
            context,
            Handlebars.templates['Main.hbs'],
            parent,
            el,
            'MainPage'
        );

        this._contextLoaded = false;

        this._scrollContainerHandlers = new Map();
        this._posterClickHandlers = new Map();
        this._navToggleHandlers = new Map();
        this._menuItemHandlers = new Map();
    }

    init() {
        super.init();
        
        if (!this._contextLoaded) {
            this.loadContext();
        }
    }

    async loadContext() {
        const { ok, resp } = await movieService.getAllSelections();

        const newContext = {
            ...this.context,
            selections: ok ? resp : [],
        };

        if (!ok) {
            console.log('Фильмы не прилетели с бэка');
        }

        this._contextLoaded = true;
        this.refresh(newContext);
    }

    addEventListeners() {
        super.addEventListeners();

        this._addSidebarListeners();
        this._addScrollContainerListeners();
        this._addMoviePostersClickListeners();
    }

    removeEventListeners() {
        super.removeEventListeners();

        this._removeSidebarListeners();
        this._removeScrollContainerListeners();
        this._removeMoviePostersClickListeners();
    }

    _addSidebarListeners() {
        const toggleButtons = this.el.querySelectorAll('[data-action="toggle-nav"]');
        const menuItems = this.el.querySelectorAll('[data-content]');

        toggleButtons.forEach((button) => {
            const onClick = () => {
                this._toggleNav();
            };

            button.addEventListener('click', onClick);
            this._navToggleHandlers.set(button, onClick);
        });

        menuItems.forEach((item) => {
            const onClick = () => {
                const content = item.dataset.content || '';
                this._showContent(content);
            };

            item.addEventListener('click', onClick);
            this._menuItemHandlers.set(item, onClick);
        });
    }

    _removeSidebarListeners() {
        for (const [button, handler] of this._navToggleHandlers) {
            button.removeEventListener('click', handler);
        }
        this._navToggleHandlers.clear();

        for (const [item, handler] of this._menuItemHandlers) {
            item.removeEventListener('click', handler);
        }
        this._menuItemHandlers.clear();
    }

    _toggleNav() {
        const sideMenu = this.el.querySelector('#side-menu');
        const mainContent = this.el.querySelector('#main-content');
        const openIcon = this.el.querySelector('#open-icon');

        sideMenu?.classList.toggle('menu-active');
        mainContent?.classList.toggle('menu-active');
        openIcon?.classList.toggle('menu-active');
    }

    _showContent(content) {
        console.log(`Выбран раздел: ${content}`);

        const sideMenu = this.el.querySelector('#side-menu');
        const mainContent = this.el.querySelector('#main-content');
        const openIcon = this.el.querySelector('#open-icon');

        sideMenu?.classList.remove('menu-active');
        mainContent?.classList.remove('menu-active');
        openIcon?.classList.remove('menu-active');

        // Здесь позже можно сделать:
        // - фильтрацию подборок
        // - смену активной категории
        // - роутинг
    }

    _addScrollContainerListeners() {
        const scrollContainers = this.el.querySelectorAll('.scroll-container');

        scrollContainers.forEach((container) => {
            let isDragging = false;
            let startX = 0;
            let startScrollLeft = 0;

            const onMouseDown = (e) => {
                e.preventDefault();

                isDragging = true;
                startX = e.pageX;
                startScrollLeft = container.scrollLeft;

                container.classList.add('is-dragging');
            };

            const onMouseMove = (e) => {
                if (!isDragging) return;

                const dx = e.pageX - startX;
                container.scrollLeft = startScrollLeft - dx;
            };

            const onMouseUp = () => {
                if (!isDragging) return;

                isDragging = false;
                container.classList.remove('is-dragging');
            };

            const onMouseLeave = () => {
                if (!isDragging) return;

                isDragging = false;
                container.classList.remove('is-dragging');
            };

            container.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mouseleave', onMouseLeave);

            this._scrollContainerHandlers.set(container, {
                onMouseDown,
                onMouseMove,
                onMouseUp,
                onMouseLeave,
            });
        });
    }

    _removeScrollContainerListeners() {
        for (const [container, handlers] of this._scrollContainerHandlers) {
            container.removeEventListener('mousedown', handlers.onMouseDown);
            document.removeEventListener('mousemove', handlers.onMouseMove);
            document.removeEventListener('mouseup', handlers.onMouseUp);
            document.removeEventListener('mouseleave', handlers.onMouseLeave);
        }

        this._scrollContainerHandlers.clear();
    }

    _addMoviePostersClickListeners() {
        const moviePosters = this.el.querySelectorAll('.movie-poster');

        moviePosters.forEach((moviePoster) => {
            const onClick = () => {
                const movieId = moviePoster.dataset.moviePosterId;
                console.log('Нажали на постер фильма:', movieId);

                // Здесь позже будет router.go(`/movie/${movieId}`) или аналог
            };

            moviePoster.addEventListener('click', onClick);
            this._posterClickHandlers.set(moviePoster, onClick);
        });
    }

    _removeMoviePostersClickListeners() {
        for (const [poster, handler] of this._posterClickHandlers) {
            poster.removeEventListener('click', handler);
        }

        this._posterClickHandlers.clear();
    }

    setupChildren() {
        const header = this.el.querySelector('#header');

        if (!header) {
            throw new Error('Main: не найден header в шаблоне Main.hbs');
        }

        this.addChild(
            'header',
            new HeaderComponent(
                {
                    ...this.context.userData,
                },
                this,
                header
            )
        );
    }
}
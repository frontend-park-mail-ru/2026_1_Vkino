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
    }

    init() {
        super.init()
        if (!this._contextLoaded)
            this.loadContext()
    }

    async loadContext() {
        const [top, newmovies, popular] = await Promise.all([
            movieService.getSelectionByTitle("new"),
            movieService.getSelectionByTitle("new"),
            movieService.getSelectionByTitle("popular")
        ])


        console.log(top)
        const newContext = {
            ...this.context,
            top: top.resp?.movies,
            new: newmovies.resp?.movies,
            popular: popular.resp?.movies
        }

        this._contextLoaded = true;
        this.refresh(newContext)
    }

    addEventListeners() {
        super.addEventListeners()

        this._addScrollContainerListeners()
        this._addMoviePostersClickListeners()
    }

    removeEventListeners() {
        super.removeEventListeners()

        this._removeScrollContainerListeners()
        this._removeMoviePostersClickListeners()
    }


    _addScrollContainerListeners() {
        const scrollContainers = document.querySelectorAll('.scroll-container');

        scrollContainers.forEach(container => {
            let isDragging = false;
            let startX;
            let startScrollLeft;

            const onMouseDown = (e) => {
                e.preventDefault();
                
                isDragging = true;
                startX = e.pageX;
                startScrollLeft = container.scrollLeft;

                container.classList.add('is-dragging');
            }

            const onMouseMove = (e) => {
                if (!isDragging) return;

                const dx = e.pageX - startX;
                container.scrollLeft = startScrollLeft - dx;
            }

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    container.classList.remove('is-dragging');
                }
            };

            const onMouseLeave = () => {
                if (isDragging) {
                    isDragging = false;
                }
            };

            container.addEventListener('mousedown', onMouseDown);
            container.addEventListener('mousemove', onMouseMove);
            container.addEventListener('mouseup', onMouseUp);
            container.addEventListener('mouseleave', onMouseLeave);

            this._scrollContainerHandlers.set(container, {
                onMouseDown,
                onMouseMove,
                onMouseUp,
                onMouseLeave
            });
        });
    }

    _addMoviePostersClickListeners() {
        const moviePosters = this.el.querySelectorAll('.movie-poster');

        moviePosters.forEach(moviePoster => {
            const onClick = (e) => {
                console.log("нажали на постер");
            };

            moviePoster.addEventListener('click', onClick);
            this._posterClickHandlers.set(moviePoster, onClick);
        });
    }

    _removeScrollContainerListeners() {
        for (const [container, handlers] of this._scrollContainerHandlers) {
            container.removeEventListener('mousedown', handlers.onMouseDown);
            container.removeEventListener('mousemove', handlers.onMouseMove);
            container.removeEventListener('mouseup', handlers.onMouseUp);
            container.removeEventListener('mouseleave', handlers.onMouseLeave);
        }
        this._scrollContainerHandlers.clear();
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
                // context
                {
                    ...this.context.userData,
                },
                // template - указан в конструкторе Header
                // parent
                this,
                // el
                header
            )
        );
    }
}
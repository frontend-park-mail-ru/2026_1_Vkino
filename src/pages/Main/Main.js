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
        const {ok, status, resp} = await movieService.getAllSelections()

        this._contextLoaded = true;
        
        console.log(ok, status, resp)

        if (ok) {
            this.context = {
                ...this.context,
                selections: resp
            };
            
            if (this.children.size > 0) {
                this.refreshChildren({
                    ...this.context.userData 
                });
            }

            this.render();
            this.addEventListeners();
        } else {
            this.context = {
                ...this.context,
                selections: []
            };
            console.log("фильмы не прилетели с бэка(");
            this.render();
        }
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
        this._removeScrollContainerListeners();
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
                e.preventDefault();
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
                    container.classList.remove('is-dragging');
                }
            };

            container.addEventListener('mousedown', onMouseDown);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mouseleave', onMouseLeave);

            this._scrollContainerHandlers.set(container, {
                onMouseDown,
                onMouseMove,
                onMouseUp,
                onMouseLeave
            });
        });
    }

    _addMoviePostersClickListeners() {
        this._removeMoviePostersClickListeners(); 

        const moviePosters = this.el.querySelectorAll('.movie-poster');

        moviePosters.forEach(moviePoster => {
            const onClick = (e) => {
                e.preventDefault();
                const movieId = moviePoster.dataset.movieId;
                console.log("нажали на постер", movieId);
            };

            moviePoster.addEventListener('click', onClick);
            this._posterClickHandlers.set(moviePoster, onClick);
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
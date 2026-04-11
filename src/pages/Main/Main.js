import BasePage from "../BasePage.js";
import "./Main.precompiled.js";

import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";
import { router } from "../../router/index.js";

/**
 * Главная страница приложения с подборками фильмов.
 * @class
 * @extends BasePage
 */
export default class MainPage extends BasePage {
  /**
   * Создает экземпляр главной страницы.
   * @constructor
   * @param {Object} [context={}] - Контекст данных для страницы.
   * @param {BaseComponent|null} [parent=null] - Родительский компонент.
   * @param {Element|null} [el=null] - Корневой DOM-элемент страницы.
   * @throws {Error} Если не передан корневой элемент.
   */
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("Main: не передан корневой элемент для MainPage");
    }

    super(context, Handlebars.templates["Main.hbs"], parent, el, "MainPage");

    /**
     * Флаг загрузки контекста.
     * @private
     * @type {boolean}
     * @default false
     */
    this._contextLoaded = false;

    /**
     * Мапа обработчиков для контейнеров со скроллом.
     * @private
     * @type {Map<Element, {onMouseDown: Function, onMouseMove: Function, onMouseUp: Function, onMouseLeave: Function}>}
     * @default new Map()
     */
    this._scrollContainerHandlers = new Map();

    /**
     * Мапа обработчиков кликов по постерам фильмов.
     * @private
     * @type {Map<Element, Function>}
     * @default new Map()
     */
    this._posterClickHandlers = new Map();

  }

  /**
   * Инициализирует страницу и загружает контекст при необходимости.
   * @override
   * @returns {this} Текущий экземпляр страницы.
   */
  init() {
    super.init();

    if (!this._contextLoaded) {
      this.loadContext();
    }

    return this;
  }

  /**
   * Загружает подборки фильмов с сервера.
   * @async
   * @returns {Promise<void>}
   */
  async loadContext() {
    const { ok, resp } = await movieService.getAllSelections();

    const newContext = {
      ...this.context,
      selections: ok ? resp : [],
    };

    if (!ok) {
      console.log("Фильмы не прилетели с бэка");
    }

    this._contextLoaded = true;
    this.refresh(newContext);
  }

  /**
   * Добавляет все обработчики событий для страницы.
   * @override
   */
  addEventListeners() {
    super.addEventListeners();

    this._addScrollContainerListeners();
    this._addMoviePostersClickListeners();
  }

  /**
   * Удаляет все обработчики событий для страницы.
   * @override
   */
  removeEventListeners() {
    super.removeEventListeners();

    this._removeScrollContainerListeners();
    this._removeMoviePostersClickListeners();
  }

  /**
   * Добавляет обработчики для горизонтального скролла контейнеров с постерами.
   * Реализует drag-to-scroll функциональность.
   * @private
   */
  _addScrollContainerListeners() {
    const scrollContainers = this.el.querySelectorAll(".scroll-container");

    scrollContainers.forEach((container) => {
      const DRAG_THRESHOLD_PX = 6;
      let isPointerDown = false;
      let isDragging = false;
      let startX = 0;
      let startScrollLeft = 0;

      const onMouseDown = (e) => {
        isPointerDown = true;
        isDragging = false;
        startX = e.pageX;
        startScrollLeft = container.scrollLeft;
      };

      const onMouseMove = (e) => {
        if (!isPointerDown) return;
        const dx = e.pageX - startX;

        if (!isDragging && Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          isDragging = true;
          container.classList.add("is-dragging");
        }

        if (!isDragging) return;

        e.preventDefault();
        container.scrollLeft = startScrollLeft - dx;
      };

      const onMouseUp = () => {
        if (!isPointerDown) return;

        isPointerDown = false;
        isDragging = false;
        container.classList.remove("is-dragging");
      };

      const onMouseLeave = () => {
        if (!isPointerDown) return;

        isPointerDown = false;
        isDragging = false;
        container.classList.remove("is-dragging");
      };

      container.addEventListener("mousedown", onMouseDown);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.addEventListener("mouseleave", onMouseLeave);

      this._scrollContainerHandlers.set(container, {
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
      });
    });
  }

  /**
   * Удаляет обработчики горизонтального скролла.
   * @private
   */
  _removeScrollContainerListeners() {
    for (const [container, handlers] of this._scrollContainerHandlers) {
      container.removeEventListener("mousedown", handlers.onMouseDown);
      document.removeEventListener("mousemove", handlers.onMouseMove);
      document.removeEventListener("mouseup", handlers.onMouseUp);
      document.removeEventListener("mouseleave", handlers.onMouseLeave);
    }

    this._scrollContainerHandlers.clear();
  }

  /**
   * Добавляет обработчики кликов по постерам фильмов.
   * @private
   */
  _addMoviePostersClickListeners() {
    const moviePosters = this.el.querySelectorAll(".movie-poster");

    moviePosters.forEach((moviePoster) => {
      const onClick = () => {
        const movieId =
          moviePoster.dataset.moviePosterId ||
          moviePoster.dataset.movieId ||
          moviePoster.dataset.movieUuid;

        if (!movieId) {
          console.warn("Main: не найден id фильма для перехода");
          return;
        }

        router.go(`/movie?id=${encodeURIComponent(movieId)}`);
      };

      moviePoster.addEventListener("click", onClick);
      this._posterClickHandlers.set(moviePoster, onClick);
    });
  }

  /**
   * Удаляет обработчики кликов по постерам фильмов.
   * @private
   */
  _removeMoviePostersClickListeners() {
    for (const [poster, handler] of this._posterClickHandlers) {
      poster.removeEventListener("click", handler);
    }

    this._posterClickHandlers.clear();
  }

  /**
   * Настраивает дочерние компоненты страницы.
   * Создает и добавляет компонент шапки.
   * @override
   * @throws {Error} Если не найден элемент для компонента шапки.
   */
  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error("Main: не найден header в шаблоне Main.hbs");
    }

    this.addChild(
      "header",
      new HeaderComponent(
        {
          ...this.context.userData,
        },
        this,
        header,
      ),
    );
  }
}

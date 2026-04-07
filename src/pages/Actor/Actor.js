import BasePage from "../BasePage.js";
import "./Actor.precompiled.js";

import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";

/**
 * Старница актера
 * @class
 * @extends BasePage
 */
export default class ActorPage extends BasePage {
  /**
   * Создает экземпляр страницы актера.
   * @constructor
   * @param {Object} [context={}] - Контекст данных для страницы.
   * @param {BaseComponent|null} [parent=null] - Родительский компонент.
   * @param {Element|null} [el=null] - Корневой DOM-элемент страницы.
   * @throws {Error} Если не передан корневой элемент.
   */
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("Actor: не передан корневой элемент для ActorPage");
    }

    super(context, Handlebars.templates["Actor.hbs"], parent, el, "ActorPage");

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
    const actorId = this.context.actorId ?? this._getActorIdFromLocation();

    if (!actorId) {
      this._contextLoaded = true;
      this.refresh({
        ...this.context,
        actor: null,
      });
      return;
    }

    const { ok, resp } = await movieService.getActorById(actorId);

    const newContext = {
      ...this.context,
      actor: ok ? this._mapActor(resp) : null,
    };

    if (!ok) {
      console.log("Актер не прилетел с бэка");
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
      let isDragging = false;
      let startX = 0;
      let startScrollLeft = 0;

      const onMouseDown = (e) => {
        e.preventDefault();

        isDragging = true;
        startX = e.pageX;
        startScrollLeft = container.scrollLeft;

        container.classList.add("is-dragging");
      };

      const onMouseMove = (e) => {
        if (!isDragging) return;

        const dx = e.pageX - startX;
        container.scrollLeft = startScrollLeft - dx;
      };

      const onMouseUp = () => {
        if (!isDragging) return;

        isDragging = false;
        container.classList.remove("is-dragging");
      };

      const onMouseLeave = () => {
        if (!isDragging) return;

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
        const movieId = moviePoster.dataset.moviePosterId;
        console.log("Нажали на постер фильма:", movieId);

        // Здесь позже будет router.go(`/movie/${movieId}`) или аналог
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
   * Возвращает ID актера из query-параметра или URL вида /actor/{id}.
   * @private
   * @returns {string|null}
   */
  _getActorIdFromLocation() {
    const params = new URLSearchParams(window.location.search);
    const actorIdFromQuery = params.get("id");

    if (actorIdFromQuery) {
      return actorIdFromQuery;
    }

    const parts = window.location.pathname.split("/").filter(Boolean);
    const actorIndex = parts.indexOf("actor");
    const actorIdFromPath = actorIndex >= 0 ? parts[actorIndex + 1] : null;

    return actorIdFromPath || null;
  }

  /**
   * Нормализует ответ бэка под шаблон страницы.
   * @private
   * @param {Object|null} actor данные актера с бэка
   * @returns {Object|null}
   */
  _mapActor(actor) {
    if (!actor) {
      return null;
    }

    return {
      ...actor,
      birth_date: actor.birth_date ? this._formatDate(actor.birth_date) : "Не указана",
      biography: actor.biography || "Нет описания",
      movie_ids: Array.isArray(actor.movie_ids) ? actor.movie_ids : [],
    };
  }

  /**
   * Форматирует дату в локализованный вид.
   * @private
   * @param {string} value строка даты
   * @returns {string}
   */
  _formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("ru-RU");
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
      throw new Error("Actor: не найден header в шаблоне Actor.hbs");
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

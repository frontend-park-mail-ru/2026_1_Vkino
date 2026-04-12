import BasePage from "../BasePage.js";
import "./Actor.precompiled.js";

import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";

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
        actor: this._mapActor(this._createActorStub()),
      });
      return;
    }

    const { ok, resp } = await movieService.getActorById(actorId);
    const actorSource = ok ? resp : this._createActorStub(actorId);

    const newContext = {
      ...this.context,
      actor: this._mapActor(actorSource),
    };

    if (!ok) {
      console.log("Актер не прилетел с бэка, используется заглушка");
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
  }

  /**
   * Удаляет все обработчики событий для страницы.
   * @override
   */
  removeEventListeners() {
    super.removeEventListeners();
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

    const movieIds = actor.movie_ids ?? actor.MovieIDs;
    const birthDate = actor.birth_date ?? actor.BirthDate;
    const biography = actor.biography ?? actor.Biography;
    const createdAt = actor.created_at ?? actor.CreatedAt;
    const updatedAt = actor.updated_at ?? actor.UpdatedAt;
    const normalizedMovieIds = Array.isArray(movieIds) ? movieIds : [];

    return {
      id: actor.id ?? actor.ID ?? null,
      full_name: actor.full_name ?? actor.FullName ?? "Имя актера не указано",
      country_id: actor.country_id ?? actor.CountryID ?? null,
      country_label: this._formatCountry(actor.country_id ?? actor.CountryID),
      picture_file_key: actor.picture_file_key ?? actor.PictureFileKey ?? "",
      picture_src: actor.picture_file_key || actor.PictureFileKey || "img/user-avatar.png",
      birth_date: birthDate ? this._formatDate(birthDate) : "Не указана",
      biography: biography || "Нет описания",
      created_at: createdAt ? this._formatDate(createdAt) : "Не указано",
      updated_at: updatedAt ? this._formatDate(updatedAt) : "Не указано",
      movie_ids: normalizedMovieIds,
      movies_count: normalizedMovieIds.length,
      movies: this._buildMovieCards(normalizedMovieIds),
    };
  }

  /**
   * Временная заглушка актера, пока с бэка нет стабильного ответа.
   * Поля соответствуют структуре API.
   * @private
   * @param {string|number|null} [actorId=null]
   * @returns {Object}
   */
  _createActorStub(actorId = null) {
    return {
      id: Number(actorId) || 0,
      full_name: "Кристиан Бейл",
      birth_date: "1974-01-30T00:00:00Z",
      biography: "Актер с широким диапазоном ролей: от психологических драм до масштабных приключенческих фильмов.",
      country_id: 826,
      picture_file_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      movie_ids: [101, 205, 309, 412, 518, 624],
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
   * Возвращает подпись страны по идентификатору.
   * @private
   * @param {number|string|null} countryId
   * @returns {string}
   */
  _formatCountry(countryId) {
    if (countryId === null || countryId === undefined || countryId === "") {
      return "Не указана";
    }

    return `Country #${countryId}`;
  }

  /**
   * Создает карточки-заглушки фильмов по списку id.
   * @private
   * @param {number[]} movieIds
   * @returns {Object[]}
   */
  _buildMovieCards(movieIds) {
    const posterPool = [
      "img/1.jpg",
      "img/2.jpeg",
      "img/3.jpg",
      "img/4.jpg",
      "img/5.jpg",
      "img/image_10.jpg",
      "img/image_11.jpg",
      "img/image_12.jpg",
    ];

    return movieIds.map((movieId, index) => ({
      id: movieId,
      title: `Фильм ${movieId}`,
      posterUrl: posterPool[index % posterPool.length],
      poster_src: posterPool[index % posterPool.length],
      description: "Фильм из фильмографии актера.",
      genres: [],
      actionText: "О фильме",
      href: `/movie/${encodeURIComponent(movieId)}`,
    }));
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

    this._setupActorMoviesCarousel();
  }

  _setupActorMoviesCarousel() {
    const carouselSlot = this.el.querySelector("#actor-movies-carousel");
    const movies = Array.isArray(this.context.actor?.movies) ? this.context.actor.movies : [];

    if (!carouselSlot || !movies.length) {
      return;
    }

    this.addChild(
      "actor-movies-carousel",
      new PosterCarouselComponent(
        {
          slug: "actor-movies",
          title: "Фильмы с этим актером",
          movies,
          posterVariant: "default",
          posterSize: "small",
          showArrows: false,
        },
        this,
        carouselSlot,
      ),
    );
  }
}

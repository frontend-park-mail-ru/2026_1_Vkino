import BasePage from "../BasePage.js";
import "./Actor.precompiled.js";

import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";
import { MEDIA_BUCKETS, resolveMediaUrl } from "../../utils/media.js";
import {
  extractActor,
  extractSelections,
} from "../../utils/apiResponse.js";

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
        actor: null,
      });
      return;
    }

    const [actorResult, selectionsResult] = await Promise.all([
      movieService.getActorById(actorId),
      movieService.getAllSelections(),
    ]);

    const actorSource = actorResult.ok ? extractActor(actorResult.resp) : null;
    const selections = selectionsResult.ok
      ? extractSelections(selectionsResult.resp)
      : [];

    const selectionMovies = actorResult.ok
      ? this._getMoviesFromSelections(selections, actorSource)
      : [];

    const newContext = {
      ...this.context,
      actor: actorResult.ok
        ? this._mapActor(actorSource, selectionMovies)
        : null,
    };

    if (!actorResult.ok || !newContext.actor) {
      console.error("ActorPage: не удалось загрузить данные актера", {
        actorId,
        actorResp: actorResult.resp,
        selectionsResp: selectionsResult.resp,
      });
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

    return actorIdFromPath ? decodeURIComponent(actorIdFromPath) : null;
  }

  /**
   * Достает объект актера из типовых оберток ответа API.
   * @private
   * @param {Object|null} payload
   * @returns {Object|null}
   */
  _extractActorPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }

    if (payload.actor && typeof payload.actor === "object") {
      return payload.actor;
    }

    if (payload.data && typeof payload.data === "object") {
      if (payload.data.actor && typeof payload.data.actor === "object") {
        return payload.data.actor;
      }

      return payload.data;
    }

    if (payload.result && typeof payload.result === "object") {
      if (payload.result.actor && typeof payload.result.actor === "object") {
        return payload.result.actor;
      }

      return payload.result;
    }

    return payload;
  }

  /**
   * Нормализует ответ бэка под шаблон страницы.
   * @private
   * @param {Object|null} actor данные актера с бэка
   * @returns {Object|null}
   */
  _mapActor(actor, fallbackMovies = []) {
    if (!actor) {
      return null;
    }

    const birthDate =
      actor.birth_date ??
      actor.BirthDate ??
      actor.birthDate ??
      actor.date_of_birth;
    const biography =
      actor.biography ??
      actor.Biography ??
      actor.description ??
      actor.bio ??
      actor.about;
    const movies = this._mergeMovies(
      this._getActorMovies(actor),
      fallbackMovies,
    );
    const actorId =
      actor.id ?? actor.ID ?? actor.actor_id ?? actor.ActorID ?? null;
    const fullName =
      actor.full_name ??
      actor.FullName ??
      actor.fullName ??
      [actor.first_name, actor.last_name].filter(Boolean).join(" ").trim();
    const countryId =
      actor.country_id ?? actor.CountryID ?? actor.countryId ?? null;
    const imageValue =
      actor.picture_file_key ??
      actor.PictureFileKey ??
      actor.picture_src ??
      actor.picture ??
      actor.avatar ??
      actor.img_url ??
      actor.imgUrl ??
      actor.photo_url ??
      actor.photoUrl;

    return {
      id: actorId,
      full_name: fullName || "Имя актера не указано",
      country_id: countryId,
      country_label: this._formatCountry(
        countryId,
        actor.country_name ?? actor.country ?? actor.Country,
      ),
      picture_src:
        this._normalizeImageUrl(imageValue) || "/img/user-avatar.png",
      birth_date: birthDate ? this._formatDate(birthDate) : "Не указана",
      biography: biography || "Нет описания",
      movies_count: movies.length,
      movies: this._mapMovies(movies),
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
   * Нормализует путь до картинки.
   * @private
   * @param {string|number|null|undefined} value
   * @returns {string}
   */
  _normalizeImageUrl(value) {
    return resolveMediaUrl(value, MEDIA_BUCKETS.actors);
  }

  _normalizeCardImageUrl(value) {
    return resolveMediaUrl(value, MEDIA_BUCKETS.cards);
  }

  /**
   * Возвращает подпись страны по идентификатору.
   * @private
   * @param {number|string|null} countryId
   * @returns {string}
   */
  _formatCountry(countryId, countryName = "") {
    const normalizedCountryName = String(countryName ?? "").trim();

    if (normalizedCountryName) {
      return normalizedCountryName;
    }

    if (countryId === null || countryId === undefined || countryId === "") {
      return "Не указана";
    }

    return `Country #${countryId}`;
  }

  /**
   * Возвращает фильмографию актера из разных вариантов ответа API.
   * @private
   * @param {Object} actor
   * @returns {Object[]}
   */
  _getActorMovies(actor) {
    const movieCollections = [
      actor.movies,
      actor.Movies,
      actor.filmography,
      actor.films,
      actor.titles,
      actor.projects,
    ];

    const movies = movieCollections.find((value) => Array.isArray(value));
    return Array.isArray(movies) ? movies : [];
  }

  _mergeMovies(primaryMovies, fallbackMovies) {
    const mergedMovies = [];
    const seenIds = new Set();

    [primaryMovies, fallbackMovies].forEach((movieCollection) => {
      if (!Array.isArray(movieCollection)) {
        return;
      }

      movieCollection.forEach((movie) => {
        if (!movie || typeof movie !== "object") {
          return;
        }

        const movieId = String(
          movie.id ?? movie.ID ?? movie.movie_id ?? movie.MovieID ?? "",
        ).trim();

        if (!movieId || seenIds.has(movieId)) {
          return;
        }

        seenIds.add(movieId);
        mergedMovies.push(movie);
      });
    });

    return mergedMovies;
  }

  _getMoviesFromSelections(selections, actor) {
    if (!Array.isArray(selections) || !actor || typeof actor !== "object") {
      return [];
    }

    const actorId = String(
      actor.id ?? actor.ID ?? actor.actor_id ?? actor.ActorID ?? "",
    ).trim();
    const actorName = String(
      actor.full_name ??
        actor.FullName ??
        actor.fullName ??
        [actor.first_name, actor.last_name].filter(Boolean).join(" "),
    )
      .trim()
      .toLowerCase();

    const allMovies = selections
      .flatMap((selection) => {
        if (Array.isArray(selection?.movies)) {
          return selection.movies;
        }

        if (Array.isArray(selection?.Movies)) {
          return selection.Movies;
        }

        if (Array.isArray(selection?.titles)) {
          return selection.titles;
        }

        return [];
      })
      .filter((movie) => movie && typeof movie === "object");

    return allMovies.filter((movie) =>
      this._movieMatchesActor(movie, actorId, actorName),
    );
  }

  _movieMatchesActor(movie, actorId, actorName) {
    const movieActorCollections = [
      movie.actors,
      movie.Actors,
      movie.cast,
      movie.Cast,
      movie.persons,
      movie.Persons,
    ];

    const people = movieActorCollections.find((value) => Array.isArray(value));

    if (Array.isArray(people) && people.length) {
      return people.some((person) => {
        if (!person || typeof person !== "object") {
          return false;
        }

        const personId = String(
          person.id ?? person.ID ?? person.actor_id ?? person.ActorID ?? "",
        ).trim();
        const personName = String(
          person.full_name ??
            person.FullName ??
            person.fullName ??
            [person.first_name, person.last_name].filter(Boolean).join(" "),
        )
          .trim()
          .toLowerCase();

        return (
          (actorId && personId === actorId) ||
          (actorName && personName === actorName)
        );
      });
    }

    const singleActorId = String(movie.actor_id ?? movie.ActorID ?? "").trim();
    const singleActorName = String(
      movie.actor_name ?? movie.actor ?? movie.Actor ?? "",
    )
      .trim()
      .toLowerCase();

    return (
      (actorId && singleActorId === actorId) ||
      (actorName && singleActorName === actorName)
    );
  }

  /**
   * Нормализует фильмы актера для карусели.
   * @private
   * @param {Object[]} movies
   * @returns {Object[]}
   */
  _mapMovies(movies) {
    return movies
      .filter((movie) => {
        if (!movie || typeof movie !== "object") {
          return false;
        }

        const movieId = movie.id ?? movie.ID ?? movie.movie_id ?? movie.MovieID;
        return movieId !== null && movieId !== undefined && movieId !== "";
      })
      .map((movie) => {
        const movieId = movie.id ?? movie.ID ?? movie.movie_id ?? movie.MovieID;
        const imageUrl =
          this._normalizeCardImageUrl(
            movie?.img_url ||
              movie?.poster_url ||
              movie?.posterUrl ||
              movie?.picture_src ||
              movie?.PictureFileKey,
          ) || "/img/cards/interstellar.webp";
        const title = movie.title ?? movie.Title ?? movie.name ?? movie.Name;

        return {
          id: movieId,
          title: title || `Фильм ${movieId}`,
          posterUrl: imageUrl,
          poster_src: imageUrl,
          description:
            movie.description ??
            movie.Description ??
            "Фильм из фильмографии актера.",
          genres: Array.isArray(movie.genres) ? movie.genres : [],
          actionText: "О фильме",
          href: `/movie/${encodeURIComponent(movieId)}`,
        };
      });
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
    const movies = Array.isArray(this.context.actor?.movies)
      ? this.context.actor.movies
      : [];

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
          posterSize: "medium",
          showArrows: false,
        },
        this,
        carouselSlot,
      ),
    );
  }
}

import BasePage from "../BasePage.js";
import "./Main.precompiled.js";

import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";
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
    const selections = ok ? buildSelectionEntries(resp) : [];

    const newContext = {
      ...this.context,
      selectionEntries: selections,
      heroMovies: buildHeroMovies(selections),
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
  }

  /**
   * Удаляет все обработчики событий для страницы.
   * @override
   */
  removeEventListeners() {
    super.removeEventListeners();
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

    this._setupHeroCarousel();
    this._setupSelectionCarousels();
  }

  _setupHeroCarousel() {
    const heroSlot = this.el.querySelector("#hero-carousel");
    if (!heroSlot || !Array.isArray(this.context.heroMovies) || !this.context.heroMovies.length) {
      return;
    }

    this.addChild(
      "hero-carousel",
      new PosterCarouselComponent(
        {
          slug: "hero",
          movies: this.context.heroMovies,
          posterVariant: "default",
          posterSize: "medium",
          centeredHero: true,
          showArrows: true,
        },
        this,
        heroSlot,
      ),
    );
  }

  _setupSelectionCarousels() {
    const selections = Array.isArray(this.context.selectionEntries)
      ? this.context.selectionEntries
      : [];

    selections.forEach((selection) => {
      const slot = this.el.querySelector(
        `[data-selection-slot="${selection.slotKey}"]`,
      );
      if (!slot) {
        return;
      }

      this.addChild(
        `selection-${selection.slotKey}`,
        new PosterCarouselComponent(
          {
            slug: selection.slotKey,
            title: selection.title,
            movies: selection.movies,
            posterVariant: "default",
            posterSize: "medium",
            showArrows: false,
          },
          this,
          slot,
        ),
      );
    });
  }
}

function buildSelectionEntries(selections = []) {
  return selections.map((selection, index) => ({
    title: selection.title || `Подборка ${index + 1}`,
    slotKey: `selection-${index}`,
    movies: normalizeMovies(selection.movies),
  }));
}

function buildHeroMovies(selectionEntries = []) {
  const movies = selectionEntries.flatMap((selection) => selection.movies);
  const heroMovies = movies.slice(0, 3);

  if (!heroMovies.length) {
    return buildFallbackHeroMovies();
  }

  return heroMovies;
}

function normalizeMovies(movies = []) {
  return movies.map((movie, index) => normalizeMovie(movie, index));
}

function normalizeMovie(movie = {}, index = 0) {
  const movieId = String(movie.id ?? `movie-${index}`).trim();

  return {
    id: movieId,
    title: movie.title || movie.name || "Фильм",
    posterUrl: movie.posterUrl || movie.poster_url || movie.img_url || "img/image_10.jpg",
    backdropUrl: movie.backdropUrl || movie.backdrop_url || "",
    ageRating: movie.ageRating || movie.age_rating || movie.ageLimit || movie.age_limit || "18+",
    genres: movie.genres || movie.genre || [],
    description:
      movie.description ||
      movie.summary ||
      "Погрузитесь в атмосферу кино с подборкой фильмов, собранной специально для VKino.",
    imdbRating: movie.imdbRating || movie.imdb_rating || "",
    kpRating: movie.kpRating || movie.kp_rating || "",
    actionText: "Смотреть",
    href: `/movie/${encodeURIComponent(movieId)}`,
  };
}

function buildFallbackHeroMovies() {
  return [
    {
      id: "fallback-hero-1",
      title: "Интерстеллар",
      posterUrl: "img/image_10.jpg",
      backdropUrl: "img/image_10.jpg",
      ageRating: "16+",
      genres: ["Триллер", "Драма"],
      description: "История о случайной встрече, которая меняет планы на одну длинную ночь.",
      imdbRating: "7.8",
      kpRating: "7.6",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-1",
    },
    {
      id: "fallback-hero-2",
      title: "Интерстеллар",
      posterUrl: "img/image_11.jpg",
      backdropUrl: "img/image_11.jpg",
      ageRating: "12+",
      genres: ["Мелодрама", "Приключения"],
      description: "Теплая история о выборе, свободе и людях, которые появляются в нужный момент.",
      imdbRating: "8.1",
      kpRating: "7.9",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-2",
    },
    {
      id: "fallback-hero-3",
      title: "Дюна",
      posterUrl: "img/image_12.jpg",
      backdropUrl: "img/image_12.jpg",
      ageRating: "18+",
      genres: ["Боевик", "Криминал"],
      description: "Одна поездка через весь город превращается в гонку, из которой нельзя выйти раньше времени.",
      imdbRating: "7.4",
      kpRating: "7.3",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-3",
    },
  ];
}

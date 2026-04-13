import BasePage from "../BasePage.js";
import "./Profile.precompiled.js";
import "../../css/profile.css";

import HeaderComponent from "../../components/Header/Header.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";
import { movieService } from "../../js/MovieService.js";
import { userService } from "../../js/UserService.js";
import { router } from "../../router/index.js";
import { authStore } from "../../store/authStore.js";
import { resolveAvatarUrl } from "../../utils/avatar.js";
import { formatBirthdate, getDisplayNameFromEmail } from "../../utils/user.js";

/**
 * Страница профиля текущего пользователя.
 * Загружает профиль с бэка и собирает витринные секции из доступных подборок фильмов.
 *
 * @class
 * @extends BasePage
 */
export default class ProfilePage extends BasePage {
  /**
   * Создает экземпляр страницы профиля.
   *
   * @param {Object} [context={}] контекст страницы
   * @param {BasePage|null} [parent=null] родительский компонент
   * @param {Element|null} [el=null] корневой DOM-элемент страницы
   */
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "ProfilePage: не передан корневой элемент для ProfilePage",
      );
    }

    super(
      {
        isLoading: true,
        errorMessage: "",
        displayName: "",
        email: "",
        birthdateLabel: "",
        avatarUrl: resolveAvatarUrl(""),
        featuredMovies: [],
        recentMovies: [],
        favoriteMovies: [],
        ...context,
      },
      Handlebars.templates["Profile.hbs"],
      parent,
      el,
      "ProfilePage",
    );

    this._authUnsubscribe = null;
  }

  /**
   * Инициализирует страницу и запускает загрузку данных профиля.
   *
   * @returns {ProfilePage} текущий экземпляр страницы
   */
  init() {
    const state = authStore.getState();

    if (state.status === "loading") {
      this._authUnsubscribe = authStore.subscribe((nextState) => {
        if (nextState.status === "loading") {
          return;
        }

        this._authUnsubscribe?.();
        this._authUnsubscribe = null;

        if (!nextState.user) {
          router.go("/sign-in");
          return;
        }

        this.refresh({
          ...this.context,
          ...buildProfileIdentity(nextState.user),
          isLoading: true,
        });
      });

      return super.init();
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    this.context = {
      ...this.context,
      ...buildProfileIdentity(state.user),
    };

    super.init();

    if (this.context.isLoading) {
      this.loadContext();
    }

    return this;
  }

  /**
   * Загружает профиль пользователя и данные для секций страницы.
   *
   * @returns {Promise<void>}
   */
  async loadContext() {
    const fallbackProfile = authStore.getState().user || {};
    const [profileResult, selectionsResult] = await Promise.all([
      userService.me(),
      movieService.getAllSelections(),
    ]);

    if (profileResult.status === 401) {
      await authStore.logout();
      router.go("/sign-in");
      return;
    }

    const profile = profileResult.ok
      ? profileResult.resp || {}
      : fallbackProfile;

    if (profileResult.ok) {
      authStore.updateUserProfile(profile);
    }

    const movieCollections = buildMovieCollections(
      selectionsResult.ok ? selectionsResult.resp : [],
    );

    this.refresh({
      ...this.context,
      ...buildProfileIdentity(profile),
      ...movieCollections,
      isLoading: false,
      errorMessage: profileResult.ok
        ? ""
        : profileResult.error || "Не удалось обновить профиль с сервера",
    });
  }

  /**
   * Добавляет обработчики событий страницы.
   */
  addEventListeners() {
    const retryButton = this.el.querySelector('[data-action="retry-profile"]');

    retryButton?.addEventListener("click", this._onRetryClick);
  }

  /**
   * Удаляет обработчики событий и подписки страницы.
   */
  removeEventListeners() {
    if (this._authUnsubscribe) {
      this._authUnsubscribe();
      this._authUnsubscribe = null;
    }

    const retryButton = this.el.querySelector('[data-action="retry-profile"]');

    retryButton?.removeEventListener("click", this._onRetryClick);
  }

  /**
   * Инициализирует дочерние компоненты страницы.
   */
  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error("Profile: не найден header в шаблоне Profile.hbs");
    }

    this.addChild("header", new HeaderComponent({}, this, header));
    this._setupProfileCarousels();
  }

  /**
   * Повторно запускает загрузку данных профиля после ошибки.
   *
   * @private
   * @returns {void}
   */
  _onRetryClick = () => {
    if (this.context.isLoading) {
      return;
    }

    this.refresh({
      ...this.context,
      isLoading: true,
      errorMessage: "",
    });
  };

  _setupProfileCarousels() {
    buildProfileCarousels(this.context).forEach((carousel) => {
      const slot = this.el.querySelector(
        `[data-profile-carousel="${carousel.slotKey}"]`,
      );

      if (!slot) {
        return;
      }

      this.addChild(
        `profile-carousel-${carousel.slotKey}`,
        new PosterCarouselComponent(
          {
            slug: `profile-${carousel.slotKey}`,
            title: carousel.title,
            movies: carousel.movies,
            posterVariant: carousel.posterVariant,
            posterSize: carousel.posterSize,
            showArrows: carousel.showArrows,
          },
          this,
          slot,
        ),
      );
    });
  }
}

/**
 * Собирает отображаемые данные профиля из ответа бэкенда.
 *
 * @param {Object} [profile={}] данные профиля пользователя
 * @returns {{displayName: string, email: string, birthdateLabel: string, avatarUrl: string}}
 */
function buildProfileIdentity(profile = {}) {
  const email = String(profile.email || "").trim();
  const displayName = getDisplayNameFromEmail(email) || "Пользователь";

  return {
    displayName,
    email,
    birthdateLabel: formatBirthdate(profile.birthdate),
    avatarUrl: resolveAvatarUrl(profile.avatar_url),
  };
}

/**
 * Формирует набор секций страницы профиля из общего пула фильмов.
 *
 * @param {Object[]} [selections=[]] подборки фильмов с бэка
 * @returns {{featuredMovies: Object[], recentMovies: Object[], favoriteMovies: Object[]}}
 */
function buildMovieCollections(selections = []) {
  const normalizedMovies = normalizeSelections(selections);
  const moviePool = fillMoviePool(normalizedMovies, 16);

  return {
    featuredMovies: moviePool.slice(0, 4).map((movie) => ({
      ...movie,
      variant: "hero",
      size: "hero",
    })),
    recentMovies: moviePool.slice(2, 10),
    favoriteMovies: moviePool.slice(10, 16),
  };
}

function buildProfileCarousels(context = {}) {
  const carousels = [
    {
      slotKey: "featured",
      title: "Продолжить просмотр",
      movies: context.featuredMovies,
      posterVariant: "hero",
      posterSize: "hero",
      showArrows: true,
    },
    {
      slotKey: "recent",
      title: "Недавно просмотренное",
      movies: context.recentMovies,
      posterVariant: "default",
      posterSize: "medium",
      showArrows: false,
    },
    {
      slotKey: "favorites",
      title: "Избранное",
      movies: context.favoriteMovies,
      posterVariant: "compact",
      posterSize: "medium",
      showArrows: false,
    },
  ];

  return carousels.filter(
    (carousel) => Array.isArray(carousel.movies) && carousel.movies.length,
  );
}

/**
 * Разворачивает список подборок в единый нормализованный список фильмов.
 *
 * @param {Object[]} [selections=[]] подборки фильмов
 * @returns {Object[]} нормализованный список фильмов
 */
function normalizeSelections(selections = []) {
  if (!Array.isArray(selections)) {
    return [];
  }

  return selections
    .flatMap((selection) => selection?.movies || [])
    .map((movie, index) => normalizeMovie(movie, index))
    .filter(Boolean);
}

/**
 * Нормализует объект фильма под формат карточек профиля.
 *
 * @param {Object} [movie={}] исходный объект фильма
 * @param {number} [index=0] индекс фильма в списке
 * @returns {Object|null} нормализованный объект фильма или `null`
 */
function normalizeMovie(movie = {}, index = 0) {
  const movieId = String(movie.id ?? `profile-movie-${index}`).trim();

  if (!movieId) {
    return null;
  }

  const fallbackMovie = FALLBACK_MOVIES[index % FALLBACK_MOVIES.length];
  const title = movie.title || movie.name || fallbackMovie.title;
  const posterUrl =
    movie.posterUrl ||
    movie.poster_url ||
    movie.img_url ||
    movie.backdropUrl ||
    movie.backdrop_url ||
    fallbackMovie.posterUrl;
  const backdropUrl =
    movie.backdropUrl ||
    movie.backdrop_url ||
    movie.posterUrl ||
    movie.poster_url ||
    movie.img_url ||
    fallbackMovie.backdropUrl;
  const genres = normalizeGenres(
    movie.genres || movie.genre || fallbackMovie.genres,
  );

  return {
    id: movieId,
    title,
    posterUrl: resolveMediaUrl(posterUrl),
    backdropUrl: resolveMediaUrl(backdropUrl),
    href: `/movie/${encodeURIComponent(movieId)}`,
    meta: genres.join(" • ") || fallbackMovie.meta,
  };
}

/**
 * Нормализует список жанров к массиву строк.
 *
 * @param {string[]|string} genres жанры фильма
 * @returns {string[]} нормализованный список жанров
 */
function normalizeGenres(genres) {
  if (Array.isArray(genres)) {
    return genres.filter(Boolean).map((genre) => String(genre).trim());
  }

  if (typeof genres === "string" && genres.trim()) {
    return genres
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
  }

  return [];
}

/**
 * Нормализует относительные пути к медиа-ресурсам.
 *
 * @param {string} url путь или абсолютный URL медиа
 * @returns {string} нормализованный URL
 */
function resolveMediaUrl(url) {
  const normalized = String(url || "").trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("blob:")
  ) {
    return normalized;
  }

  return `/${normalized.replace(/^\/+/, "")}`;
}

/**
 * Дополняет пул фильмов фолбэками до нужной длины.
 *
 * @param {Object[]} [movies=[]] исходный список фильмов
 * @param {number} [targetLength=0] желаемое количество карточек
 * @returns {Object[]} итоговый пул фильмов
 */
function fillMoviePool(movies = [], targetLength = 0) {
  const pool = movies.slice(0, targetLength);

  if (pool.length >= targetLength) {
    return pool;
  }

  let fallbackIndex = 0;

  while (pool.length < targetLength) {
    const fallbackMovie =
      FALLBACK_MOVIES[fallbackIndex % FALLBACK_MOVIES.length];

    pool.push({
      ...fallbackMovie,
      id: `${fallbackMovie.id}-${pool.length}`,
      href: `/movie/${encodeURIComponent(fallbackMovie.id)}`,
    });

    fallbackIndex += 1;
  }

  return pool;
}

/**
 * Фолбэк-набор фильмов для витринных секций профиля.
 * Используется, если бэкенд не вернул достаточно карточек.
 *
 * @type {Array<{id: string, title: string, posterUrl: string, backdropUrl: string, meta: string}>}
 */
const FALLBACK_MOVIES = [
  {
    id: "dune-fallback",
    title: "Дюна",
    posterUrl: "/img/image_10.jpg",
    backdropUrl: "/img/image_10.jpg",
    meta: "Фантастика • Эпос",
  },
  {
    id: "interstellar-fallback",
    title: "Интерстеллар",
    posterUrl: "/img/image_11.jpg",
    backdropUrl: "/img/image_11.jpg",
    meta: "Фантастика • Драма",
  },
  {
    id: "noir-fallback",
    title: "Неоновый город",
    posterUrl: "/img/image_12.jpg",
    backdropUrl: "/img/image_12.jpg",
    meta: "Триллер • Неонуар",
  },
  {
    id: "romance-fallback",
    title: "Полночь у моря",
    posterUrl: "/img/1.jpg",
    backdropUrl: "/img/1.jpg",
    meta: "Мелодрама • Приключение",
  },
  {
    id: "pulse-fallback",
    title: "Импульс",
    posterUrl: "/img/2.jpeg",
    backdropUrl: "/img/2.jpeg",
    meta: "Боевик • Драма",
  },
  {
    id: "sonic-fallback",
    title: "Соник 3",
    posterUrl: "/img/3.jpg",
    backdropUrl: "/img/3.jpg",
    meta: "Экшен • Семейный",
  },
  {
    id: "legacy-fallback",
    title: "Последний рейс",
    posterUrl: "/img/4.jpg",
    backdropUrl: "/img/4.jpg",
    meta: "Триллер • Детектив",
  },
  {
    id: "ember-fallback",
    title: "Пепел и свет",
    posterUrl: "/img/5.jpg",
    backdropUrl: "/img/5.jpg",
    meta: "Драма • Приключение",
  },
];

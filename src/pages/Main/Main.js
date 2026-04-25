import BasePage from "../BasePage.js";
import "./Main.precompiled.js";

import { extractSelections } from "../../utils/apiResponse.js";
import { consumePendingMainScrollTarget } from "../../components/Header/Header.js";
import { movieService } from "../../js/MovieService.js";
import HeaderComponent from "../../components/Header/Header.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";
import { MEDIA_BUCKETS, resolveMediaUrl } from "../../utils/media.js";

const HOME_SELECTION_TITLES = [
  "Новинки",
  "Популярные",
  "Фильмы",
  "Мультфильмы",
  "Сериалы",
];
const SUPPORT_WIDGET_FRAME_PATH = "/support/new?embed=1";
const SUPPORT_WIDGET_TOAST_DURATION = 4800;
const SUPPORT_WIDGET_EVENTS = {
  closeRequest: "vkino:support-widget-close-request",
  ticketCreated: "vkino:support-ticket-created",
};

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
    this._pendingScrollTarget = consumePendingMainScrollTarget();
    this._isSupportWidgetOpen = false;
    this._supportWidgetToastMessage = "";
    this._supportWidgetToastTone = "";
    this._supportWidgetToastTimeoutId = 0;
  }

  /**
   * Инициализирует страницу и загружает контекст при необходимости.
   * @override
   * @returns {this} Текущий экземпляр страницы.
   */
  init() {
    super.init();

    if (this._contextLoaded) {
      this._scrollToPendingSection();
    }

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
    const selectionsResult = await movieService.getSelectionsByTitles(
      HOME_SELECTION_TITLES,
    );
    const { ok, resp, status, error } = selectionsResult;
    const rawSelections = ok ? extractSelections(resp) : [];
    const selections = buildSelectionEntries(rawSelections);
    const heroEntry = buildHeroEntry(selections);

    const newContext = {
      ...this.context,
      selectionEntries: selections,
      heroEntry,
    };

    if (!ok) {
      console.error("MainPage: не удалось загрузить подборки", {
        status,
        error,
        resp,
      });
    }

    this._contextLoaded = true;
    this.refresh(newContext);
    this._scrollToPendingSection();
  }

  /**
   * Добавляет все обработчики событий для страницы.
   * @override
   */
  addEventListeners() {
    super.addEventListeners();
    this.el.addEventListener("click", this._onClick);
    document.addEventListener("click", this._onDocumentClick);
    document.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("message", this._onSupportFrameMessage);
    this._syncSupportWidget();
  }

  /**
   * Удаляет все обработчики событий для страницы.
   * @override
   */
  removeEventListeners() {
    if (this.el) {
      this.el.removeEventListener("click", this._onClick);
    }

    document.removeEventListener("click", this._onDocumentClick);
    document.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("message", this._onSupportFrameMessage);
    super.removeEventListeners();
  }

  beforeDestroy() {
    window.clearTimeout(this._supportWidgetToastTimeoutId);
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
    const heroEntry = this.context.heroEntry;

    if (
      !heroSlot ||
      !heroEntry ||
      !Array.isArray(heroEntry.movies) ||
      !heroEntry.movies.length
    ) {
      return;
    }

    this.addChild(
      "hero-carousel",
      new PosterCarouselComponent(
        {
          slug: "hero",
          title: heroEntry.title,
          titleHref: heroEntry.titleHref,
          movies: heroEntry.movies,
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
            titleHref: selection.titleHref,
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

  _scrollToPendingSection() {
    if (!this._pendingScrollTarget) {
      return;
    }

    const escapedTarget = window.CSS?.escape
      ? window.CSS.escape(this._pendingScrollTarget)
      : this._pendingScrollTarget;
    const section = this.el.querySelector(
      `[data-scroll-id="${escapedTarget}"]`,
    );

    if (!section) {
      return;
    }

    requestAnimationFrame(() => {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    this._pendingScrollTarget = "";
  }

  _onClick = (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    if (actionTarget.dataset.action === "toggle-support-widget") {
      event.preventDefault();
      if (this._isSupportWidgetOpen) {
        this._closeSupportWidget({ restoreFocus: false });
        return;
      }

      this._openSupportWidget();
      return;
    }

    if (actionTarget.dataset.action === "close-support-widget") {
      event.preventDefault();
      this._closeSupportWidget();
    }
  };

  _onDocumentClick = (event) => {
    if (!this._isSupportWidgetOpen || !this.el) {
      return;
    }

    const widget = this.el.querySelector('[data-role="support-widget"]');

    if (!widget || widget.contains(event.target)) {
      return;
    }

    this._closeSupportWidget({ restoreFocus: false });
  };

  _onKeyDown = (event) => {
    if (event.key !== "Escape" || !this._isSupportWidgetOpen) {
      return;
    }

    this._closeSupportWidget();
  };

  _onSupportFrameMessage = (event) => {
    if (!this.el || event.origin !== window.location.origin) {
      return;
    }

    const frame = this.el.querySelector('[data-role="support-widget-frame"]');
    const payload =
      event.data && typeof event.data === "object" ? event.data : null;

    if (!frame || event.source !== frame.contentWindow || !payload?.type) {
      return;
    }

    if (payload.type === SUPPORT_WIDGET_EVENTS.closeRequest) {
      this._closeSupportWidget();
      return;
    }

    if (payload.type === SUPPORT_WIDGET_EVENTS.ticketCreated) {
      this._closeSupportWidget({ restoreFocus: false });
      this._showSupportWidgetToast(
        payload.message || "Обращение отправлено в поддержку.",
        "success",
      );
    }
  };

  _openSupportWidget() {
    this._isSupportWidgetOpen = true;
    this._syncSupportWidget();
  }

  _closeSupportWidget({ restoreFocus = true } = {}) {
    this._isSupportWidgetOpen = false;
    this._syncSupportWidget();

    if (restoreFocus) {
      this.el?.querySelector('[data-action="toggle-support-widget"]')?.focus();
    }
  }

  _showSupportWidgetToast(message, tone = "") {
    window.clearTimeout(this._supportWidgetToastTimeoutId);

    this._supportWidgetToastMessage = String(message || "").trim();
    this._supportWidgetToastTone = this._supportWidgetToastMessage ? tone : "";
    this._syncSupportWidgetToast();

    if (!this._supportWidgetToastMessage) {
      return;
    }

    this._supportWidgetToastTimeoutId = window.setTimeout(() => {
      this._supportWidgetToastMessage = "";
      this._supportWidgetToastTone = "";
      this._syncSupportWidgetToast();
    }, SUPPORT_WIDGET_TOAST_DURATION);
  }

  _syncSupportWidget() {
    if (!this.el) {
      return;
    }

    const widget = this.el.querySelector('[data-role="support-widget"]');
    const panel = this.el.querySelector('[data-role="support-widget-panel"]');
    const trigger = this.el.querySelector(
      '[data-action="toggle-support-widget"]',
    );
    const frame = this.el.querySelector('[data-role="support-widget-frame"]');

    if (!widget || !panel || !trigger || !frame) {
      return;
    }

    widget.classList.toggle(
      "main-support-widget--open",
      this._isSupportWidgetOpen,
    );
    panel.setAttribute("aria-hidden", String(!this._isSupportWidgetOpen));
    trigger.setAttribute("aria-expanded", String(this._isSupportWidgetOpen));

    if (this._isSupportWidgetOpen && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.dataset.src || SUPPORT_WIDGET_FRAME_PATH);
    }

    this._syncSupportWidgetToast();
  }

  _syncSupportWidgetToast() {
    if (!this.el) {
      return;
    }

    const toast = this.el.querySelector('[data-role="support-widget-toast"]');

    if (!toast) {
      return;
    }

    toast.textContent = this._supportWidgetToastMessage || "";
    toast.className = "main-support-widget__toast";

    if (this._supportWidgetToastMessage && this._supportWidgetToastTone) {
      toast.classList.add(
        `main-support-widget__toast--${this._supportWidgetToastTone}`,
      );
    }
  }
}

function buildSelectionEntries(selections = []) {
  if (!Array.isArray(selections)) {
    return [];
  }

  return selections.map((selection, index) => ({
    title: selection.title || selection.Title || `Подборка ${index + 1}`,
    titleHref: buildSelectionHref(selection.title || `Подборка ${index + 1}`),
    slotKey: `selection-${index}`,
    movies: normalizeMovies(selection.movies || selection.Movies || []),
  }));
}

function buildHeroEntry(selectionEntries = []) {
  const featuredSelection =
    findSelectionEntryByTitle(selectionEntries, "Новинки") ||
    selectionEntries[0] ||
    null;

  if (!featuredSelection?.movies?.length) {
    return {
      title: "Новинки",
      titleHref: buildSelectionHref("Новинки"),
      movies: buildFallbackHeroMovies(),
    };
  }

  return {
    title: featuredSelection.title,
    titleHref: featuredSelection.titleHref,
    movies: featuredSelection.movies.slice(0, 3),
  };
}

function normalizeMovies(movies = []) {
  return movies.map((movie, index) => normalizeMovie(movie, index));
}

function normalizeMovie(movie = {}, index = 0) {
  const movieId = String(movie.id ?? `movie-${index}`).trim();

  return {
    id: movieId,
    title: movie.title || movie.name || "Фильм",
    posterUrl: resolveMediaUrl(
      movie.img_url || movie.posterUrl || movie.poster_url || "interstellar",
      MEDIA_BUCKETS.cards,
    ),
    backdropUrl: resolveMediaUrl(
      movie.poster_url ||
        movie.backdropUrl ||
        movie.backdrop_url ||
        movie.posterUrl ||
        movie.img_url,
      MEDIA_BUCKETS.posters,
    ),
    ageRating:
      movie.ageRating ||
      movie.age_rating ||
      movie.ageLimit ||
      movie.age_limit ||
      "18+",
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
      posterUrl: "/img/cards/interstellar.webp",
      backdropUrl: "/img/cards/interstellar.webp",
      ageRating: "16+",
      genres: ["Триллер", "Драма"],
      description:
        "История о случайной встрече, которая меняет планы на одну длинную ночь.",
      imdbRating: "7.8",
      kpRating: "7.6",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-1",
    },
    {
      id: "fallback-hero-2",
      title: "Гладиатор",
      posterUrl: "/img/cards/gladiator.webp",
      backdropUrl: "/img/cards/gladiator.webp",
      ageRating: "12+",
      genres: ["Мелодрама", "Приключения"],
      description:
        "Теплая история о выборе, свободе и людях, которые появляются в нужный момент.",
      imdbRating: "8.1",
      kpRating: "7.9",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-2",
    },
    {
      id: "fallback-hero-3",
      title: "Дюна",
      posterUrl: "/img/cards/inception.webp",
      backdropUrl: "/img/cards/inception.webp",
      ageRating: "18+",
      genres: ["Боевик", "Криминал"],
      description:
        "Одна поездка через весь город превращается в гонку, из которой нельзя выйти раньше времени.",
      imdbRating: "7.4",
      kpRating: "7.3",
      actionText: "Смотреть",
      href: "/movie/fallback-hero-3",
    },
  ];
}

function buildSelectionHref(title = "") {
  const normalizedTitle = String(title || "").trim();

  return normalizedTitle
    ? `/selection/${encodeURIComponent(normalizedTitle)}`
    : "/selection";
}

function findSelectionEntryByTitle(selectionEntries = [], title = "") {
  const normalizedTitle = String(title || "")
    .trim()
    .toLowerCase();

  if (!normalizedTitle) {
    return null;
  }

  return (
    selectionEntries.find(
      (selection) =>
        String(selection?.title || "")
          .trim()
          .toLowerCase() === normalizedTitle,
    ) || null
  );
}

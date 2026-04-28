import BasePage from "@/pages/BasePage";
import "@/pages/Catalog/Catalog.precompiled.js";
import "@/css/catalog.scss";

import HeaderComponent from "@/components/Header/Header.js";
import MoviePosterComponent from "@/components/MoviePoster/MoviePoster.js";
import PaginationComponent from "@/components/Pagination/Pagination.js";
import { movieService } from "@/js/MovieService.js";
import { MEDIA_BUCKETS, resolveMediaUrl } from "@/utils/media.js";

const DEFAULT_PAGE_SIZE = 12;

const CATALOG_CONFIGS = {
  selection: {
    title: "Каталог",
    requestSelectionTitles: [],
    selectionTitles: [],
    contentTypes: [],
  },
  favorites: {
    title: "Избранное",
    requestSelectionTitles: [],
    selectionTitles: [],
    contentTypes: [],
  },
  history: {
    title: "Недавно просмотренные",
    requestSelectionTitles: [],
    selectionTitles: [],
    contentTypes: [],
  },
  genres: {
    title: "Жанры",
    requestSelectionTitles: ["Жанры"],
    selectionTitles: [],
    contentTypes: [],
  },
  movies: {
    title: "Фильмы",
    requestSelectionTitles: ["Фильмы"],
    selectionTitles: ["фильмы"],
    contentTypes: ["film"],
  },
  serials: {
    title: "Сериалы",
    requestSelectionTitles: ["Сериалы"],
    selectionTitles: ["сериалы"],
    contentTypes: ["serial"],
  },
  cartoons: {
    title: "Мультфильмы",
    requestSelectionTitles: ["Мультфильмы"],
    selectionTitles: ["мультфильмы"],
    contentTypes: ["cartoon"],
  },
};

export default class CatalogPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("CatalogPage: не передан корневой элемент");
    }

    const hasProvidedItems = Object.prototype.hasOwnProperty.call(
      context,
      "items",
    );

    super(
      buildCatalogContext({
        isLoading: !hasProvidedItems,
        hasError: false,
        errorMessage: "",
        cacheMessage: "",
        catalogKey: "",
        items: hasProvidedItems ? context.items : [],
        ...context,
      }),
      Handlebars.templates["Catalog.hbs"],
      parent,
      el,
      "CatalogPage",
    );

    this._hasProvidedItems = hasProvidedItems;
  }

  init() {
    super.init();
    applyCatalogDocumentTitle(this.context.catalogKey, this.context.title);

    if (!this._hasProvidedItems && this.context.isLoading) {
      this.loadContext();
    }

    return this;
  }

  async loadContext() {
    const { ok, status, resp, error } = await movieService.getSelectionsByTitles(
      resolveRequestedSelectionTitles(this.context),
    );

    if (!ok) {
      this.refresh(
        buildCatalogContext({
          ...this.context,
          isLoading: false,
          hasError: true,
          errorMessage: mapCatalogLoadError(status, error),
          cacheMessage: "",
          items: [],
          totalPages: 1,
        }),
      );
      applyCatalogDocumentTitle(this.context.catalogKey, this.context.title);
      return;
    }

    const catalogPool = buildCatalogPool(resp, {
      catalogKey: this.context.catalogKey,
      selectionTitle: this.context.selectionTitle,
    });
    const paginationState = paginateItems(
      catalogPool,
      this.context.currentPage,
      this.context.pageSize,
    );

    this.refresh(
      buildCatalogContext({
        ...this.context,
        isLoading: false,
        hasError: false,
        errorMessage: "",
        cacheMessage: getCacheFallbackNotice(selectionsResult),
        items: paginationState.items,
        currentPage: paginationState.currentPage,
        totalPages: paginationState.totalPages,
      }),
    );
    applyCatalogDocumentTitle(this.context.catalogKey, this.context.title);
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error("CatalogPage: не найден header в шаблоне");
    }

    this.addChild("header", new HeaderComponent({}, this, header));
    this._setupPosterGrid();
    this._setupPagination();
  }

  addEventListeners() {
    const retryButton = this.el.querySelector('[data-action="retry-catalog"]');

    retryButton?.addEventListener("click", this._onRetryClick);
  }

  removeEventListeners() {
    const retryButton = this.el?.querySelector('[data-action="retry-catalog"]');

    retryButton?.removeEventListener("click", this._onRetryClick);
  }

  onShow() {}

  onHide() {}

  onRefresh() {}

  _setupPosterGrid() {
    if (this.context.isLoading || this.context.hasError) {
      return;
    }

    this.context.posterItems.forEach((posterItem) => {
      const slot = this.el.querySelector(
        `[data-catalog-poster="${posterItem.slotKey}"]`,
      );

      if (!slot) {
        return;
      }

      this.addChild(
        `catalog-poster-${posterItem.slotKey}`,
        new MoviePosterComponent(
          {
            ...posterItem,
            variant: "default",
            size: "medium",
          },
          this,
          slot,
        ),
      );
    });
  }

  _setupPagination() {
    const paginationSlot = this.el.querySelector("#catalog-pagination");

    if (!paginationSlot || !this.context.pagination?.shouldRender) {
      return;
    }

    this.addChild(
      "catalog-pagination",
      new PaginationComponent(this.context.pagination, this, paginationSlot),
    );
  }

  _onRetryClick = () => {
    if (this._hasProvidedItems || this.context.isLoading) {
      return;
    }

    this.refresh(
      buildCatalogContext({
        ...this.context,
        isLoading: true,
        hasError: false,
        errorMessage: "",
        cacheMessage: "",
        items: [],
      }),
    );
  };
}

function buildCatalogContext(context = {}) {
  const catalogConfig = resolveCatalogConfig(context.catalogKey);
  const selectionTitle = resolveSelectionTitle(context);
  const title =
    normalizeString(context.title) || selectionTitle || catalogConfig.title;
  const currentPage = normalizePositiveInteger(
    context.currentPage,
    readCurrentPageFromLocation(),
  );
  const totalPages = normalizePositiveInteger(context.totalPages, 1);
  const pageSize = normalizePositiveInteger(context.pageSize, DEFAULT_PAGE_SIZE);
  const basePath = normalizeString(context.basePath) || window.location.pathname;
  const items = normalizeCatalogItems(context.items);
  const catalogKeyNorm = normalizeString(context.catalogKey).toLowerCase();
  const isLoading = Boolean(context.isLoading);
  const hasError = Boolean(context.hasError);
  const showFavoritesEmpty =
    !isLoading &&
    !hasError &&
    catalogKeyNorm === "favorites" &&
    items.length === 0;

  return {
    ...context,
    title,
    selectionTitle,
    pageSize,
    currentPage,
    totalPages,
    basePath,
    posterItems: items.map((item, index) => ({
      ...item,
      slotKey: item.slotKey || `catalog-item-${index}`,
    })),
    pagination: buildPaginationContext(currentPage, totalPages, basePath),
    skeletonItems: buildSkeletonItems(pageSize),
    showFavoritesEmpty,
  };
}

function resolveCatalogConfig(catalogKey = "") {
  const normalizedKey = normalizeString(catalogKey).toLowerCase();

  return CATALOG_CONFIGS[normalizedKey] || CATALOG_CONFIGS.movies;
}

function resolveRequestedSelectionTitles(context = {}) {
  const selectionTitle = resolveSelectionTitle(context);

  if (selectionTitle) {
    return [selectionTitle];
  }

  const catalogConfig = resolveCatalogConfig(context.catalogKey);

  return normalizeRequestedSelectionTitles(catalogConfig.requestSelectionTitles);
}

function normalizeRequestedSelectionTitles(titles = []) {
  if (!Array.isArray(titles)) {
    return [];
  }

  return titles.map((title) => normalizeString(title)).filter(Boolean);
}

function buildCatalogPool(selections = [], options = {}) {
  const catalogKey = normalizeString(options.catalogKey).toLowerCase();
  const selectionTitle = normalizeString(options.selectionTitle);
  const normalizedSelections = normalizeSelections(selections);
  const allMovies = dedupeMovies(
    normalizedSelections.flatMap((selection) => selection.movies),
  );
  const catalogConfig = resolveCatalogConfig(catalogKey);

  if (!allMovies.length) {
    return [];
  }

  if (selectionTitle) {
    const selection = findSelectionByTitle(normalizedSelections, selectionTitle);
    return selection?.movies || [];
  }

  if (catalogKey === "genres") {
    const moviesWithGenres = allMovies.filter((movie) => movie.genres.length);

    return sortGenreCatalog(moviesWithGenres.length ? moviesWithGenres : allMovies);
  }

  const titledMovies = dedupeMovies(
    normalizedSelections
      .filter((selection) =>
        matchesSelectionTitle(selection.title, catalogConfig.selectionTitles),
      )
      .flatMap((selection) => selection.movies),
  );

  if (titledMovies.length) {
    return titledMovies;
  }

  const typedMovies = allMovies.filter((movie) =>
    catalogConfig.contentTypes.includes(movie.contentType),
  );

  if (typedMovies.length) {
    return typedMovies;
  }

  return allMovies;
}

function normalizeSelections(selections = []) {
  if (!Array.isArray(selections)) {
    return [];
  }

  return selections
    .map((selection, index) => {
      const title =
        normalizeString(selection?.title) ||
        normalizeString(selection?.name) ||
        `Подборка ${index + 1}`;
      const movies = extractSelectionMovies(selection).map((movie, movieIndex) =>
        normalizeCatalogItem(movie, movieIndex, title),
      );

      return {
        title,
        movies: movies.filter(Boolean),
      };
    })
    .filter((selection) => selection.movies.length);
}

function extractSelectionMovies(selection = {}) {
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
}

function normalizeCatalogItems(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => normalizeCatalogItem(item, index))
    .filter(Boolean);
}

function normalizeCatalogItem(movie = {}, index = 0, selectionTitle = "") {
  if (!movie || typeof movie !== "object") {
    return null;
  }

  const movieId = normalizeString(movie.id) || `catalog-movie-${index}`;
  const title =
    normalizeString(movie.title) ||
    normalizeString(movie.name) ||
    `Фильм ${index + 1}`;
  const posterUrl =
    movie.posterUrl ||
    movie.img_url ||
    movie.poster_url ||
    movie.backdropUrl ||
    movie.backdrop_url ||
    "interstellar";
  const backdropUrl =
    movie.backdropUrl ||
    movie.poster_url ||
    movie.backdrop_url ||
    movie.posterUrl ||
    movie.img_url ||
    posterUrl;
  const genres = normalizeGenres(movie.genres || movie.genre);
  const contentType = normalizeContentType(
    movie.contentType || movie.content_type,
    selectionTitle,
  );

  return {
    ...movie,
    id: movieId,
    title,
    href: movie.href || `/movie/${encodeURIComponent(movieId)}`,
    posterUrl: resolveMediaUrl(posterUrl, MEDIA_BUCKETS.cards),
    backdropUrl: resolveMediaUrl(backdropUrl, MEDIA_BUCKETS.posters),
    description:
      normalizeString(movie.description) ||
      normalizeString(movie.summary) ||
      normalizeString(movie.short_description) ||
      "",
    ageRating:
      movie.ageRating ||
      movie.age_rating ||
      movie.ageLimit ||
      movie.age_limit ||
      "",
    imdbRating: movie.imdbRating || movie.imdb_rating || movie.imdb_score || "",
    kpRating: movie.kpRating || movie.kp_rating || movie.kp_score || "",
    genres,
    contentType,
    selectionTitle,
  };
}

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

function normalizeContentType(value, selectionTitle = "") {
  const normalizedValue = normalizeString(value).toLowerCase();
  const normalizedSelectionTitle = normalizeString(selectionTitle).toLowerCase();

  if (normalizedValue.includes("serial")) {
    return "serial";
  }

  if (normalizedValue.includes("cartoon")) {
    return "cartoon";
  }

  if (normalizedValue.includes("film") || normalizedValue.includes("movie")) {
    return "film";
  }

  if (normalizedSelectionTitle.includes("сериал")) {
    return "serial";
  }

  if (normalizedSelectionTitle.includes("мульт")) {
    return "cartoon";
  }

  if (normalizedSelectionTitle.includes("фильм")) {
    return "film";
  }

  return "";
}

function dedupeMovies(movies = []) {
  const uniqueMovies = new Map();

  movies.forEach((movie, index) => {
    if (!movie) {
      return;
    }

    const key = normalizeString(movie.id) || `${movie.title}-${index}`;

    if (!uniqueMovies.has(key)) {
      uniqueMovies.set(key, movie);
    }
  });

  return Array.from(uniqueMovies.values());
}

function sortGenreCatalog(movies = []) {
  return movies.slice().sort((leftMovie, rightMovie) => {
    const leftGenre = leftMovie.genres[0] || "";
    const rightGenre = rightMovie.genres[0] || "";

    return (
      leftGenre.localeCompare(rightGenre, "ru") ||
      leftMovie.title.localeCompare(rightMovie.title, "ru")
    );
  });
}

function paginateItems(items = [], currentPage = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const normalizedPageSize = normalizePositiveInteger(pageSize, DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(items.length / normalizedPageSize));
  const safeCurrentPage = Math.min(
    normalizePositiveInteger(currentPage, 1),
    totalPages,
  );
  const startIndex = (safeCurrentPage - 1) * normalizedPageSize;

  return {
    items: items.slice(startIndex, startIndex + normalizedPageSize),
    currentPage: safeCurrentPage,
    totalPages,
  };
}

function buildPaginationContext(currentPage = 1, totalPages = 1, basePath = "/") {
  const safeCurrentPage = normalizePositiveInteger(currentPage, 1);
  const safeTotalPages = normalizePositiveInteger(totalPages, 1);

  return {
    shouldRender: safeTotalPages > 1,
    hasPrevPage: safeCurrentPage > 1,
    hasNextPage: safeCurrentPage < safeTotalPages,
    prevHref: buildPageHref(basePath, safeCurrentPage - 1),
    nextHref: buildPageHref(basePath, safeCurrentPage + 1),
    pageItems: buildPaginationItems(safeCurrentPage, safeTotalPages, basePath),
  };
}

function buildPaginationItems(currentPage = 1, totalPages = 1, basePath = "/") {
  const visiblePages = new Set([
    1,
    totalPages,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const sortedPages = Array.from(visiblePages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((leftPage, rightPage) => leftPage - rightPage);
  const items = [];

  sortedPages.forEach((page, index) => {
    const previousPage = sortedPages[index - 1];

    if (previousPage && page - previousPage > 1) {
      items.push({
        isEllipsis: true,
        label: "…",
      });
    }

    items.push({
      isEllipsis: false,
      isCurrent: page === currentPage,
      label: String(page),
      href: buildPageHref(basePath, page),
    });
  });

  return items;
}

function buildPageHref(basePath = "/", page = 1) {
  const safeBasePath = normalizeString(basePath) || "/";
  const safePage = normalizePositiveInteger(page, 1);

  if (safePage <= 1) {
    return safeBasePath;
  }

  return `${safeBasePath}?page=${safePage}`;
}

function buildSkeletonItems(count = DEFAULT_PAGE_SIZE) {
  return Array.from({ length: count }, (_, index) => ({
    id: `catalog-skeleton-${index}`,
  }));
}

function matchesSelectionTitle(title = "", titleVariants = []) {
  if (!titleVariants.length) {
    return false;
  }

  const normalizedTitle = normalizeString(title).toLowerCase();

  return titleVariants.some((variant) => normalizedTitle.includes(variant));
}

function applyCatalogDocumentTitle(catalogKey, titleFallback = "") {
  const key = normalizeString(catalogKey).toLowerCase();
  const fromConfig = CATALOG_CONFIGS[key]?.title;
  const title = normalizeString(titleFallback) || fromConfig || "";
  if (title) {
    document.title = `${title} — VKino`;
  }
}

function findSelectionByTitle(selections = [], title = "") {
  const normalizedTitle = normalizeString(title).toLowerCase();

  if (!normalizedTitle) {
    return null;
  }

  return (
    selections.find(
      (selection) =>
        normalizeString(selection?.title).toLowerCase() === normalizedTitle,
    ) || null
  );
}

function mapCatalogLoadError(status, errorMessage = "") {
  if (status === 404) {
    return "Каталог не найден";
  }

  if (status >= 500) {
    return "Сервис каталога временно недоступен";
  }

  return errorMessage || "Не удалось загрузить каталог";
}

function readCurrentPageFromLocation() {
  if (typeof window === "undefined") {
    return 1;
  }

  const params = new URLSearchParams(window.location.search);

  return normalizePositiveInteger(params.get("page"), 1);
}

function resolveSelectionTitle(context = {}) {
  const explicitTitle = normalizeString(context.selectionTitle);

  if (explicitTitle) {
    return explicitTitle;
  }

  if (normalizeString(context.catalogKey).toLowerCase() !== "selection") {
    return "";
  }

  return readSelectionTitleFromLocation();
}

function readSelectionTitleFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  const match = window.location.pathname.match(/^\/selection\/(.+)$/);

  if (!match?.[1]) {
    return "";
  }

  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return match[1].trim();
  }
}

function normalizePositiveInteger(value, fallback = 1) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 1) {
    return fallback;
  }

  return Math.floor(normalizedValue);
}

function normalizeString(value) {
  return String(value ?? "").trim();
}

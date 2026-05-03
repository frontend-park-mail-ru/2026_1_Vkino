import { BaseComponent } from "@/components/BaseComponent.js";
import "@/components/Header/Header.precompiled.js";
import { authStore } from "@/store/authStore.js";
import { router } from "@/router/index.js";
import { movieService } from "@/js/MovieService.js";
import { resolveAvatarUrl } from "@/utils/avatar.js";
import { getDisplayNameFromEmail } from "@/utils/user.js";
import { canManageSupportTicketStatus } from "@/utils/support.js";


const PENDING_SCROLL_TARGET_KEY = "vkino_pending_scroll_target";
const SEARCH_DEBOUNCE_MS = 2000;
const SEARCH_MOVIE_LIMIT = 4;
const SEARCH_GENRE_LIMIT = 3;
const SEARCH_ACTOR_LIMIT = 3;

let searchDiscoveryIndexPromise = null;

/**
 * Компонент header
 * Отображает навигацию, информацию о пользователе и кнопки авторизации/выхода + войти/зарегистрироваться.
 * Автоматически реагирует на изменения статуса авторизации через authStore.
 */
export default class HeaderComponent extends BaseComponent {
  /**
   * Конструирует header.
   * @constructor
   * @param {Object} context контекст отрисовки шаблона
   * @param {Element} parent элемент, в который будет отрисован шаблон
   * @param {Element} el корневой элемент компонента
   * @throws {Error} если не передан parent или el
   */
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error("Header: не передан parent для HeaderComponent");
    }

    if (!el) {
      throw new Error("Header: не передан el для HeaderComponent");
    }

    super(context, Handlebars.templates["Header.hbs"], parent, el);

    this._unsubscribe = null;
    this._searchDebounceTimer = null;
    this._searchRequestToken = 0;
    this._pendingSearchQuery = "";
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
    this._onWindowScrollBound = this._onWindowScroll.bind(this);
  }

  /**
   * Инициализирует компонент. Заполняет контекст данными о текущем пользователе.
   * @returns {Promise<HeaderComponent>} текущий экземпляр компонента
   */
  init() {
    this.context = this._buildContext(authStore.getState(), this.context);

    return super.init();
  }

  /**
   * Добавляет обработчики событий.
   * Подписывается на изменения в authStore и добавляет обработчик клика на кнопку выхода.
   */
  addEventListeners() {
    this._subscribeToAuth();
    this._bindToggleButton(
      '[data-action="toggle-burger-menu"]',
      this._onBurgerToggleClick,
    );
    this._bindToggleButton(
      '[data-action="toggle-profile-menu"]',
      this._onProfileToggleClick,
    );
    this._bindToggleButton(
      '[data-action="toggle-search"]',
      this._onSearchToggleClick,
    );
    this._bindToggleButton('[data-action="logout"]', this._onLogoutClick);
    this._bindNodeList(
      '[data-action="close-all-menus"]',
      this._onCloseAllMenusClick,
    );
    this._bindNodeList(
      '[data-action="scroll-to-section"]',
      this._onScrollToSectionClick,
    );
    this._bindSubmitForm('[data-menu="search"]', this._onSearchSubmit);
    this._bindInput('[data-role="header-search-input"]', this._onSearchInput);
    document.addEventListener("click", this._onDocumentClickBound);
    window.addEventListener("scroll", this._onWindowScrollBound, {
      passive: true,
    });
  }

  /**
   * Удаляет обработчики событий.
   * Отписывается от изменений в authStore и удаляет обработчик клика с кнопки выхода.
   */
  removeEventListeners() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }

    this._unbindToggleButton(
      '[data-action="toggle-burger-menu"]',
      this._onBurgerToggleClick,
    );
    this._unbindToggleButton(
      '[data-action="toggle-profile-menu"]',
      this._onProfileToggleClick,
    );
    this._unbindToggleButton(
      '[data-action="toggle-search"]',
      this._onSearchToggleClick,
    );
    this._unbindToggleButton('[data-action="logout"]', this._onLogoutClick);
    this._unbindNodeList(
      '[data-action="close-all-menus"]',
      this._onCloseAllMenusClick,
    );
    this._unbindNodeList(
      '[data-action="scroll-to-section"]',
      this._onScrollToSectionClick,
    );
    this._unbindSubmitForm('[data-menu="search"]', this._onSearchSubmit);
    this._unbindInput('[data-role="header-search-input"]', this._onSearchInput);
    document.removeEventListener("click", this._onDocumentClickBound);
    window.removeEventListener("scroll", this._onWindowScrollBound);
    window.clearTimeout(this._searchDebounceTimer);
  }

  /**
   * Обработчик клика по кнопке выхода.
   * @private
   * @param {Event} e событие клика
   */
  _onBurgerToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleBurgerMenu();
  };

  _onProfileToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggleProfileMenu();
  };

  _onSearchToggleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const nextIsOpen = !this.context.isSearchOpen;
    this.toggleSearch();

    if (nextIsOpen) {
      window.requestAnimationFrame(() => {
        const input = this.el?.querySelector('[data-role="header-search-input"]');
        input?.focus();
      });
    }
  };

  _onCloseAllMenusClick = () => {
    this.closeAllMenus();
  };

  _onScrollToSectionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const target = e.currentTarget.dataset.scrollTarget;
    if (!target) {
      return;
    }

    this.closeAllMenus();

    if (window.location.pathname !== "/") {
      sessionStorage.setItem(PENDING_SCROLL_TARGET_KEY, target);
      router.go("/");
      return;
    }

    scrollToMainSection(target);
  };

  _onSearchSubmit = (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form?.querySelector('[data-role="header-search-input"]');
    const query = normalizeText(input?.value);

    if (!query) {
      return;
    }

    this.closeAllMenus();
    router.go(`/search?query=${encodeURIComponent(query)}`);
  };

  _onSearchInput = (e) => {
    const query = normalizeText(e.currentTarget?.value);
    this._pendingSearchQuery = query;

    window.clearTimeout(this._searchDebounceTimer);

    if (!query) {
      this._searchRequestToken += 1;
      this._applyMenuState(buildSearchContextPatch("", false, [], [], []));
      return;
    }

    const requestToken = ++this._searchRequestToken;

    this._searchDebounceTimer = window.setTimeout(async () => {
      this._applyMenuState({
        ...buildSearchContextPatch(query, true, [], [], []),
        isSearchOpen: true,
      });

      const [movieResult, discoveryIndex] = await Promise.all([
        movieService.searchMovies(query),
        getSearchDiscoveryIndex(),
      ]);

      if (requestToken !== this._searchRequestToken) {
        return;
      }

      const movies = movieResult.ok
        ? normalizeSearchMovies(movieResult.resp?.movies, discoveryIndex).slice(
            0,
            SEARCH_MOVIE_LIMIT,
          )
        : [];
      const genres = filterSearchGenres(discoveryIndex.genres, query).slice(
        0,
        SEARCH_GENRE_LIMIT,
      );
      const actors = (
        movieResult.ok
          ? normalizeSearchActors(movieResult.resp?.actors, discoveryIndex)
          : filterSearchActors(discoveryIndex.actors, query)
      ).slice(0, SEARCH_ACTOR_LIMIT);

      this._applyMenuState(
        buildSearchContextPatch(query, false, movies, genres, actors),
      );

      window.requestAnimationFrame(() => {
        const input = this.el?.querySelector('[data-role="header-search-input"]');
        if (!input) {
          return;
        }

        input.focus();
        const caretPosition = input.value.length;
        input.setSelectionRange?.(caretPosition, caretPosition);
      });
    }, SEARCH_DEBOUNCE_MS);
  };

  _onLogoutClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.closeAllMenus();
    await authStore.logout();
    router.go("/");
  };

  _onDocumentClick(e) {
    if (!this.context.isAnyMenuOpen) {
      return;
    }

    if (this._isClickInsideMenu(e.target)) {
      return;
    }

    this.closeAllMenus();
  }

  _onWindowScroll() {
    if (!this.context.isAnyMenuOpen && !this.context.isSearchOpen) {
      return;
    }

    this.closeAllMenus();
  }

  toggleBurgerMenu() {
    this._applyMenuState({
      isBurgerMenuOpen: !this.context.isBurgerMenuOpen,
      isProfileMenuOpen: false,
      isSearchOpen: false,
    });
  }

  closeBurgerMenu() {
    if (!this.context.isBurgerMenuOpen) {
      return;
    }

    this._applyMenuState({ isBurgerMenuOpen: false });
  }

  toggleProfileMenu() {
    if (!this.context.isAuthorized) {
      return;
    }

    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: !this.context.isProfileMenuOpen,
      isSearchOpen: false,
    });
  }

  toggleSearch() {
    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: false,
      isSearchOpen: !this.context.isSearchOpen,
      ...(this.context.isSearchOpen
        ? buildSearchContextPatch("", false, [], [], [])
        : null),
    });
  }

  closeAllMenus() {
    if (!this.context.isAnyMenuOpen && !this.context.isSearchOpen) {
      return;
    }

    this._applyMenuState({
      isBurgerMenuOpen: false,
      isProfileMenuOpen: false,
      isSearchOpen: false,
      ...buildSearchContextPatch("", false, [], [], []),
    });
  }

  _subscribeToAuth() {
    this._unsubscribe = authStore.subscribe((state) => {
      this.refresh(this._buildContext(state, this.context));
    });
  }

  _buildContext(state, currentContext = {}) {
    const isAuthorized = state.status === "authenticated";
    const avatarUrl = resolveAvatarUrl(state.user?.avatar_url);
    const canManageSupportTickets = canManageSupportTicketStatus(
      state.user?.role,
    );
    const currentPath = window.location.pathname;
    const nextContext = {
      ...currentContext,
      isAuthorized,
      userName: getDisplayNameFromEmail(state.user?.email),
      avatarUrl,
      favoritesHref: isAuthorized ? "/favorites" : "/sign-in",
      supportTicketsHref: "/support",
      supportTicketsLabel: canManageSupportTickets
        ? "Панель поддержки"
        : "Мои обращения",
      isWatchPartyActive:
        currentPath === "/watch-party" || currentPath.startsWith("/watch-party/"),
      isBurgerMenuOpen: currentContext.isBurgerMenuOpen ?? false,
      isSearchOpen: currentContext.isSearchOpen ?? false,
      searchQuery: this._pendingSearchQuery || currentContext.searchQuery || "",
      isSearchLoading: currentContext.isSearchLoading ?? false,
      searchMovies: Array.isArray(currentContext.searchMovies)
        ? currentContext.searchMovies
        : [],
      searchGenres: Array.isArray(currentContext.searchGenres)
        ? currentContext.searchGenres
        : [],
      searchActors: Array.isArray(currentContext.searchActors)
        ? currentContext.searchActors
        : [],
      isProfileMenuOpen: isAuthorized
        ? (currentContext.isProfileMenuOpen ?? false)
        : false,
    };

    return {
      ...nextContext,
      isSearchPanelVisible: shouldShowSearchPanel(nextContext),
      hasSearchResults:
        nextContext.searchMovies.length > 0 ||
        nextContext.searchGenres.length > 0 ||
        nextContext.searchActors.length > 0,
      isAnyMenuOpen:
        nextContext.isBurgerMenuOpen || nextContext.isProfileMenuOpen,
    };
  }

  _applyMenuState(nextState) {
    const nextContext = {
      ...this.context,
      ...nextState,
    };

    nextContext.isAnyMenuOpen =
      nextContext.isBurgerMenuOpen || nextContext.isProfileMenuOpen;

    this.refresh(nextContext);
  }

  _isClickInsideMenu(target) {
    const burgerButton = this.el.querySelector(
      '[data-action="toggle-burger-menu"]',
    );
    const profileButton = this.el.querySelector(
      '[data-action="toggle-profile-menu"]',
    );
    const searchButton = this.el.querySelector('[data-action="toggle-search"]');
    const burgerMenu = this.el.querySelector('[data-menu="burger"]');
    const profileMenu = this.el.querySelector('[data-menu="profile"]');
    const searchMenu = this.el.querySelector('[data-menu="search"]');

    return (
      burgerButton?.contains(target) ||
      profileButton?.contains(target) ||
      searchButton?.contains(target) ||
      burgerMenu?.contains(target) ||
      profileMenu?.contains(target) ||
      searchMenu?.contains(target)
    );
  }

  _bindToggleButton(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.addEventListener("click", handler);
  }

  _unbindToggleButton(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.removeEventListener("click", handler);
  }

  _bindNodeList(selector, handler) {
    const nodes = this.el.querySelectorAll(selector);
    nodes.forEach((node) => {
      node.addEventListener("click", handler);
    });
  }

  _unbindNodeList(selector, handler) {
    const nodes = this.el.querySelectorAll(selector);
    nodes.forEach((node) => {
      node.removeEventListener("click", handler);
    });
  }

  _bindSubmitForm(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.addEventListener("submit", handler);
  }

  _unbindSubmitForm(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.removeEventListener("submit", handler);
  }

  _bindInput(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.addEventListener("input", handler);
  }

  _unbindInput(selector, handler) {
    const node = this.el.querySelector(selector);
    if (!node) {
      return;
    }

    node.removeEventListener("input", handler);
  }
}

function shouldShowSearchPanel(context = {}) {
  return Boolean(
    context.isSearchOpen &&
      (context.isSearchLoading || normalizeText(context.searchQuery)),
  );
}

function buildSearchContextPatch(
  searchQuery = "",
  isSearchLoading = false,
  searchMovies = [],
  searchGenres = [],
  searchActors = [],
) {
  return {
    searchQuery,
    isSearchLoading,
    searchMovies,
    searchGenres,
    searchActors,
  };
}

async function getSearchDiscoveryIndex() {
  if (searchDiscoveryIndexPromise) {
    return searchDiscoveryIndexPromise;
  }

  searchDiscoveryIndexPromise = movieService
    .getAllSelections()
    .then((result) => buildSearchDiscoveryIndex(result.ok ? result.resp : []))
    .catch(() => buildSearchDiscoveryIndex([]));

  return searchDiscoveryIndexPromise;
}

function buildSearchDiscoveryIndex(payload) {
  const selections = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.selections)
      ? payload.selections
      : [];
  const genresMap = new Map();
  const actorsMap = new Map();
  const moviesById = new Map();
  const moviesByTitle = new Map();

  selections.forEach((selection) => {
    extractSelectionMovies(selection).forEach((movie) => {
      const movieMeta = normalizeDiscoveryMovie(movie);
      const movieIdKey = normalizeText(movieMeta.id);
      const movieTitleKey = normalizeText(movieMeta.title).toLowerCase();

      if (movieIdKey) {
        moviesById.set(movieIdKey, movieMeta);
      }
      if (movieTitleKey && !moviesByTitle.has(movieTitleKey)) {
        moviesByTitle.set(movieTitleKey, movieMeta);
      }

      movieMeta.genres.forEach((genre) => {
        const key = genre.toLowerCase();
        const current = genresMap.get(key) || {
          title: genre,
          count: 0,
          imageUrl: movieMeta.imageUrl,
          href: `/search?query=${encodeURIComponent(genre)}`,
        };

        current.count += 1;
        if (!current.imageUrl) {
          current.imageUrl = movieMeta.imageUrl;
        }
        genresMap.set(key, current);
      });

      extractMovieActors(movie).forEach((actor) => {
        const actorName = normalizeText(actor.name);
        if (!actorName) {
          return;
        }

        const key = normalizeText(actor.id) || actorName.toLowerCase();
        const current = actorsMap.get(key) || {
          id: normalizeText(actor.id),
          title: actorName,
          count: 0,
          imageUrl: actor.imageUrl || movieMeta.imageUrl,
          href: actor.id
            ? `/actor/${encodeURIComponent(actor.id)}`
            : `/search?query=${encodeURIComponent(actorName)}`,
        };

        current.count += 1;
        if (!current.imageUrl && actor.imageUrl) {
          current.imageUrl = actor.imageUrl;
        }
        actorsMap.set(key, current);
      });
    });
  });

  return {
    genres: Array.from(genresMap.values()).sort((left, right) =>
      left.title.localeCompare(right.title, "ru"),
    ),
    actors: Array.from(actorsMap.values()).sort((left, right) =>
      left.title.localeCompare(right.title, "ru"),
    ),
    moviesById,
    moviesByTitle,
  };
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

function normalizeDiscoveryMovie(movie = {}) {
  const id = normalizeText(movie.id);
  const title = normalizeText(movie.title || movie.name);
  const imageUrl = normalizeText(
    movie.img_url || movie.poster_url || movie.posterUrl || "",
  );
  const year = normalizeText(
    movie.release_year || movie.year || movie.releaseYear || movie.production_year,
  );
  const country = normalizeText(
    movie.country || movie.country_name || movie.countryLabel || movie.country_label,
  );

  return {
    id,
    title,
    imageUrl,
    subtitle: [year, country].filter(Boolean).join(", "),
    genres: normalizeGenres(movie.genres || movie.genre),
  };
}

function extractMovieActors(movie = {}) {
  const people = [];

  [movie.actors, movie.cast].forEach((collection) => {
    if (!Array.isArray(collection)) {
      return;
    }

    collection.forEach((person) => {
      if (!person || typeof person !== "object") {
        return;
      }

      people.push({
        id: normalizeText(person.id || person.actor_id || person.ActorID),
        name: normalizeText(
          person.full_name ||
            person.fullName ||
            person.name ||
            person.actor_name ||
            [person.first_name, person.last_name].filter(Boolean).join(" "),
        ),
        imageUrl: normalizeText(
          person.img_url || person.picture || person.picture_src || person.avatar,
        ),
      });
    });
  });

  const singleActorName = normalizeText(movie.actor_name || movie.actor || movie.Actor);

  if (singleActorName) {
    people.push({
      id: normalizeText(movie.actor_id || movie.ActorID),
      name: singleActorName,
      imageUrl: "",
    });
  }

  return people;
}

function normalizeSearchMovies(movies = [], discoveryIndex = {}) {
  if (!Array.isArray(movies)) {
    return [];
  }

  return movies
    .map((movie, index) => {
      const movieId = normalizeText(movie?.id) || `search-movie-${index}`;
      const title = normalizeText(movie?.title || movie?.name);
      const fallback =
        discoveryIndex.moviesById?.get(movieId) ||
        discoveryIndex.moviesByTitle?.get(title.toLowerCase()) ||
        null;

      if (!title) {
        return null;
      }

      return {
        id: movieId,
        title,
        subtitle: normalizeText(fallback?.subtitle),
        imageUrl: normalizeText(
          movie?.img_url || movie?.poster_url || fallback?.imageUrl,
        ),
        href: `/movie/${encodeURIComponent(movieId)}`,
      };
    })
    .filter(Boolean);
}

function filterSearchGenres(genres = [], query = "") {
  const normalizedQuery = normalizeText(query).toLowerCase();

  return genres.filter((genre) =>
    normalizeText(genre.title).toLowerCase().includes(normalizedQuery),
  );
}

function filterSearchActors(actors = [], query = "") {
  const normalizedQuery = normalizeText(query).toLowerCase();

  return actors.filter((actor) =>
    normalizeText(actor.title).toLowerCase().includes(normalizedQuery),
  );
}

function normalizeSearchActors(actors = [], discoveryIndex = {}) {
  if (!Array.isArray(actors)) {
    return [];
  }

  return actors
    .map((actor, index) => {
      const actorId = normalizeText(actor?.id) || `search-actor-${index}`;
      const title = normalizeText(
        actor?.full_name || actor?.fullName || actor?.name,
      );
      const fallback =
        discoveryIndex.actors?.find(
          (item) =>
            normalizeText(item.id) === actorId ||
            normalizeText(item.title).toLowerCase() === title.toLowerCase(),
        ) || null;

      if (!title) {
        return null;
      }

      return {
        id: actorId,
        title,
        count: Number.isFinite(Number(actor?.movies_count))
          ? Number(actor.movies_count)
          : Number.isFinite(Number(fallback?.count))
            ? Number(fallback.count)
            : 0,
        imageUrl: normalizeText(
          actor?.img_url || actor?.image_url || fallback?.imageUrl,
        ),
        href: `/actor/${encodeURIComponent(actorId)}`,
      };
    })
    .filter(Boolean);
}

function normalizeGenres(genres) {
  if (Array.isArray(genres)) {
    return genres.map((genre) => normalizeText(genre)).filter(Boolean);
  }

  if (typeof genres === "string") {
    return genres
      .split(",")
      .map((genre) => normalizeText(genre))
      .filter(Boolean);
  }

  return [];
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function scrollToMainSection(target) {
  const escapedTarget = window.CSS?.escape ? window.CSS.escape(target) : target;
  const section = document.querySelector(
    `[data-scroll-id="${escapedTarget}"]`,
  );

  if (!section) {
    return false;
  }

  section.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  return true;
}

export function consumePendingMainScrollTarget() {
  const target = sessionStorage.getItem(PENDING_SCROLL_TARGET_KEY);

  if (!target) {
    return "";
  }

  sessionStorage.removeItem(PENDING_SCROLL_TARGET_KEY);
  return target;
}

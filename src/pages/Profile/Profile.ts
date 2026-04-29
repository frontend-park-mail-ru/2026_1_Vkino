import BasePage from "../BasePage.ts";
import "./Profile.precompiled.js";
import "@/css/profile.scss";

import HeaderComponent from "@/components/Header/Header.ts";
import PosterCarouselComponent from "@/components/PosterCarousel/PosterCarousel.ts";
import { userService } from "@/js/UserService.ts";
import { router } from "@/router/index.ts";
import { authStore } from "@/store/authStore.ts";
import { resolveAvatarUrl as resolveDefaultAvatarUrl } from "@/utils/avatar.ts";
import { MEDIA_BUCKETS, resolveAvatarUrl, resolveMediaUrl } from "@/utils/media.ts";
import { normalizeTimeFields } from "@/utils/time.ts";
import { formatBirthdate, getDisplayNameFromEmail } from "@/utils/user.ts";
import { extractProfile } from "@/utils/apiResponse.ts";

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
  constructor(
    context: AnyRecord = {},
    parent: BasePage | null = null,
    el: Element | null = null,
  ) {
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
        avatarUrl: resolveDefaultAvatarUrl(""),
        continueWatching: [],
        watchHistory: [],
        favorites: [],
        friendsPreview: [],
        hasMoreFriends: false,
        remainingCount: 0,
        isFavoritesEmpty: true,
        isFriendsEmpty: true,
        shouldGroupEmptyStates: false,
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
    const [profileResult, continueResult, historyResult, favoritesResult, friendsResult] =
      await Promise.all([
      userService.me(),
      userService.getContinueWatching({ limit: 5 }),
      userService.getWatchRecent({ limit: 10 }),
      userService.getFavorites({ limit: 10 }),
      userService.getFriendsList({ limit: 12, offset: 0 }),
    ]);

    if (profileResult.status === 401) {
      await authStore.logout();
      router.go("/sign-in");
      return;
    }

    const profile = profileResult.ok
      ? ((extractProfile(profileResult.resp) || {}) as AnyRecord)
      : fallbackProfile;

    if (profileResult.ok) {
      authStore.updateUserProfile(profile);
    }

    const continueWatching = continueResult.ok
      ? normalizeWatchProgress(continueResult.resp?.items || [], {
          actionText: "Продолжить просмотр",
        })
      : [];
    const watchHistory = historyResult.ok
      ? normalizeWatchProgress(historyResult.resp?.items || [], {
          actionText: "Смотреть",
        })
      : [];
    const favorites = favoritesResult.ok
      ? normalizeMovieCards(favoritesResult.resp?.movies || [])
      : [];
    const friendsPreview = friendsResult.ok
      ? normalizeFriendsPreview(friendsResult.resp?.friends || [])
      : [];
    const isFavoritesEmpty = favorites.length === 0;
    const isFriendsEmpty = friendsPreview.length === 0;

    this.refresh({
      ...this.context,
      ...buildProfileIdentity(profile),
      continueWatching,
      watchHistory,
      favorites,
      friendsPreview,
      hasMoreFriends: Boolean(
        friendsResult.ok &&
          Number(friendsResult.resp?.total_count || 0) >
            (friendsResult.resp?.friends?.length || 0),
      ),
      remainingCount: friendsResult.ok
        ? Math.max(
            0,
            Number(friendsResult.resp?.total_count || 0) -
              (friendsResult.resp?.friends?.length || 0),
          )
        : 0,
      isFavoritesEmpty,
      isFriendsEmpty,
      shouldGroupEmptyStates: isFavoritesEmpty && isFriendsEmpty,
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
            titleHref: carousel.titleHref || "",
            movies: carousel.movies,
            posterVariant: carousel.posterVariant,
            posterSize: carousel.posterSize,
            showArrows: carousel.showArrows,
            actionText: carousel.actionText || "",
            showProgress: carousel.showProgress || false,
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
function buildProfileIdentity(profile: AnyRecord = {}) {
  const email = String(profile.email || "").trim();
  const displayName = getDisplayNameFromEmail(email) || "Пользователь";

  return {
    displayName,
    email,
    birthdateLabel: formatBirthdate(profile.birthdate),
    avatarUrl: resolveDefaultAvatarUrl(profile.avatar_url),
  };
}

function buildProfileCarousels(context: AnyRecord = {}): AnyRecord[] {
  const carousels: AnyRecord[] = [
    {
      slotKey: "continue",
      title: "",
      movies: context.continueWatching,
      posterVariant: "landscape",
      posterSize: "large",
      showArrows: true,
      showProgress: true,
      actionText: "Продолжить просмотр",
    },
    {
      slotKey: "history",
      title: "",
      titleHref: "/profile/history",
      movies: context.watchHistory,
      posterVariant: "default",
      posterSize: "medium",
      showArrows: false,
    },
    {
      slotKey: "favorites",
      title: "",
      titleHref: "/favorites",
      movies: context.favorites,
      posterVariant: "compact",
      posterSize: "medium",
      showArrows: false,
    },
  ];

  return carousels.filter(
    (carousel) => Array.isArray(carousel.movies) && carousel.movies.length,
  );
}

function normalizeWatchProgress(
  items: AnyRecord[] = [],
  options: AnyRecord = {},
): AnyRecord[] {
  const actionText =
    options.actionText != null && options.actionText !== ""
      ? options.actionText
      : "Продолжить просмотр";

  return items.map((item) => {
    const { duration: durationRaw, position: positionRaw } = normalizeTimeFields(item);
    const duration = Number.isFinite(Number(durationRaw)) ? Number(durationRaw) : 0;
    const position = Number.isFinite(Number(positionRaw)) ? Number(positionRaw) : 0;

    const rawApiProgressPercent = Number(
      item.progress_percent ?? item.progressPercent ?? item.progress?.percent,
    );
    const apiProgressPercent = Number.isFinite(rawApiProgressPercent)
      ? (rawApiProgressPercent > 0 && rawApiProgressPercent <= 1
          ? rawApiProgressPercent * 100
          : rawApiProgressPercent)
      : Number.NaN;
    const computedProgressPercent =
      duration > 0 ? Math.round((position / duration) * 100) : 0;
    const progressPercent = Number.isFinite(apiProgressPercent)
      ? Math.round(apiProgressPercent)
      : computedProgressPercent;
    const normalizedProgressPercent = Math.max(
      0,
      Math.min(progressPercent, 100),
    );
    const visibleProgressPercent =
      normalizedProgressPercent > 0 && normalizedProgressPercent < 2
        ? 2
        : normalizedProgressPercent;
    const contentType = String(item.content_type || "").toLowerCase();
    const isSeries = contentType === "series" || contentType === "serial";
    const movieId = item.movie_id;
    const episodeId = normalizeId(item.episode_id);
    const seasonNumber = item.season_number;
    const episodeNumber = item.episode_number;
    const movieTitle = item.movie_title || "";
    const posterUrl = item.poster_url;
    const startPart = position > 0 ? `&start=${position}` : "";
    const episodePart = episodeId ? `&episode=${episodeId}` : "";
    const normalizedMovieId = normalizeId(movieId);

    return {
      id: normalizedMovieId,
      title: movieTitle,
      posterUrl: resolveMediaUrl(posterUrl, MEDIA_BUCKETS.cards),
      href: `/movie/${normalizedMovieId}?watch=1${episodePart}${startPart}`,
      meta: isSeries
        ? `Сезон ${seasonNumber}, Серия ${episodeNumber} • ${normalizedProgressPercent}%`
        : `${normalizedProgressPercent}%`,
      actionText,
      progress: {
        percent: normalizedProgressPercent,
        displayPercent: visibleProgressPercent,
        position,
        duration,
      },
    };
  });
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeFriendsPreview(friends: AnyRecord[] = []): AnyRecord[] {
  return friends.map((friend) => {
    const displayName = getDisplayNameFromEmail(friend.email) || "Пользователь";
    return {
      id: String(friend.id),
      displayName,
      avatarUrl: resolveAvatarUrl(friend, { resolveMediaUrl }),
      initials: displayName.charAt(0).toUpperCase(),
      href: `/profile/${friend.id}`,
    };
  });
}

/**
 * Нормализует список жанров к массиву строк.
 *
 * @param {string[]|string} genres жанры фильма
 * @returns {string[]} нормализованный список жанров
 */
function normalizeMovieCards(cards: AnyRecord[] = []): AnyRecord[] {
  return cards.map((card) => ({
    id: String(card.id),
    title: card.title,
    posterUrl: resolveMediaUrl(card.img_url || card.poster_url, MEDIA_BUCKETS.cards),
    href: `/movie/${card.id}`,
    variant: "compact",
    size: "medium",
  }));
}

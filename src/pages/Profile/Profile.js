import BasePage from "../BasePage.js";
import "./Profile.precompiled.js";
import "@/css/profile.scss";
import "@/css/subscription.scss";

import HeaderComponent from "@/components/Header/Header.js";
import PosterCarouselComponent from "@/components/PosterCarousel/PosterCarousel.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { resolveAvatarUrl as resolveDefaultAvatarUrl } from "@/utils/avatar.js";
import { MEDIA_BUCKETS, resolveAvatarUrl, resolveMediaUrl } from "@/utils/media.js";
import { normalizeTimeFields } from "@/utils/time.js";
import { formatBirthdate, getDisplayNameFromEmail } from "@/utils/user.js";
import { extractProfile, unwrapPayload } from "@/utils/apiResponse.js";
import { normalizeSubscriptionFromApi } from "@/utils/subscriptionDisplay.js";

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
        subscriptionTier: 0,
        subscriptionLabel: "Нет подписки",
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
    const [
      profileResult,
      continueResult,
      historyResult,
      favoritesResult,
      friendsResult,
      subscriptionResult,
    ] = await Promise.all([
      userService.me(),
      userService.getContinueWatching({ limit: 5 }),
      userService.getWatchRecent({ limit: 10 }),
      userService.getFavorites({ limit: 10 }),
      userService.getFriendsList({ limit: 12, offset: 0 }),
      userService.getCurrentUserSubscription(),
    ]);

    if (profileResult.status === 401) {
      await authStore.logout();
      router.go("/sign-in");
      return;
    }

    const profile = profileResult.ok
      ? extractProfile(profileResult.resp) || {}
      : fallbackProfile;

    if (profileResult.ok) {
      authStore.updateUserProfile(profile);
    }

    const continueWatching = continueResult.ok
      ? normalizeWatchProgress(extractListItems(continueResult.resp), {
          actionText: "Продолжить просмотр",
        })
      : [];
    const watchHistory = historyResult.ok
      ? normalizeWatchProgress(extractListItems(historyResult.resp), {
          actionText: "Смотреть",
        })
      : [];
    const favorites = favoritesResult.ok
      ? normalizeMovieCards(extractListItems(favoritesResult.resp))
      : [];
    const friendsPreview = friendsResult.ok
      ? normalizeFriendsPreview(friendsResult.resp?.friends || [])
      : [];
    const isFavoritesEmpty = favorites.length === 0;
    const isFriendsEmpty = friendsPreview.length === 0;

    const storeSubscription = authStore.getState().user?.subscription ?? null;
    const subscriptionNormalized = storeSubscription
      ?? (subscriptionResult.ok
        ? normalizeSubscriptionFromApi(subscriptionResult.resp?.subscription)
        : null);
    const subscriptionTier = subscriptionNormalized?.tier ?? 0;
    const subscriptionLabel =
      subscriptionNormalized?.label ?? "Нет подписки";

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
      subscriptionTier,
      subscriptionLabel,
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
function buildProfileIdentity(profile = {}) {
  const email = String(profile.email || "").trim();
  const displayName = getDisplayNameFromEmail(email) || "Пользователь";

  return {
    displayName,
    email,
    birthdateLabel: formatBirthdate(profile.birthdate),
    avatarUrl: resolveDefaultAvatarUrl(profile.avatar_url),
  };
}

function buildProfileCarousels(context = {}) {
  const continueWatching = Array.isArray(context.continueWatching)
    ? context.continueWatching
    : [];
  const watchHistory = Array.isArray(context.watchHistory)
    ? context.watchHistory
    : [];
  const favorites = Array.isArray(context.favorites) ? context.favorites : [];
  const carousels = [
    {
      slotKey: "continue",
      title: "",
      movies: continueWatching,
      posterVariant: "landscape",
      posterSize: "large",
      showArrows: continueWatching.length > 1,
      showProgress: true,
      actionText: "Продолжить просмотр",
    },
    {
      slotKey: "history",
      title: "",
      titleHref: "/profile/history",
      movies: watchHistory,
      posterVariant: "default",
      posterSize: "medium",
      showArrows: false,
    },
    {
      slotKey: "favorites",
      title: "",
      titleHref: "/favorites",
      movies: favorites,
      posterVariant: "compact",
      posterSize: "medium",
      showArrows: false,
    },
  ];

  return carousels.filter(
    (carousel) => Array.isArray(carousel.movies) && carousel.movies.length,
  );
}

function normalizeWatchProgress(items = [], options = {}) {
  const actionText =
    options.actionText != null && options.actionText !== ""
      ? options.actionText
      : "Продолжить просмотр";

  return items.map((item) => {
    const movie = getNestedObject(item, "movie");
    const content = getNestedObject(item, "content");
    const source = movie || content || item;
    const { duration: durationRaw, position: positionRaw } = normalizeTimeFields(item);
    const duration = Number.isFinite(durationRaw) ? durationRaw : 0;
    const position = Number.isFinite(positionRaw) ? positionRaw : 0;

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
    const contentType = String(
      item.content_type ||
        item.contentType ||
        source.content_type ||
        source.contentType ||
        "",
    ).toLowerCase();
    const isSeries = contentType === "series" || contentType === "serial";
    const movieId =
      item.movie_id ||
      item.movieId ||
      item.MovieID ||
      item.id_movie ||
      source.id ||
      source.ID ||
      item.id ||
      item.ID;
    const episodeId = normalizeId(
      item.episode_id ||
        item.episodeId ||
        item.EpisodeID ||
        getNestedObject(item, "episode")?.id ||
        getNestedObject(item, "episode")?.ID,
    );
    const seasonNumber =
      item.season_number ||
      item.seasonNumber ||
      item.SeasonNumber ||
      getNestedObject(item, "episode")?.season_number;
    const episodeNumber =
      item.episode_number ||
      item.episodeNumber ||
      item.EpisodeNumber ||
      getNestedObject(item, "episode")?.episode_number;
    const movieTitle =
      item.movie_title ||
      item.movieTitle ||
      item.MovieTitle ||
      source.title ||
      source.Title ||
      source.name ||
      source.Name ||
      "Фильм";
    const posterUrl = getMoviePosterSource(item);
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

function normalizeId(value) {
  return String(value ?? "").trim();
}

function normalizeFriendsPreview(friends = []) {
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
function normalizeMovieCards(cards = []) {
  return cards
    .map((card, index) => {
      const movie = getNestedObject(card, "movie");
      const content = getNestedObject(card, "content");
      const source = movie || content || card;
      const id = normalizeId(
        source.id ||
          source.ID ||
          card.movie_id ||
          card.movieId ||
          card.MovieID ||
          card.id_movie ||
          card.id ||
          card.ID ||
          `favorite-${index}`,
      );

      return {
        id,
        title:
          source.title ||
          source.Title ||
          source.name ||
          source.Name ||
          card.title ||
          card.Title ||
          card.name ||
          card.Name ||
          "Фильм",
        posterUrl: resolveMediaUrl(getMoviePosterSource(card), MEDIA_BUCKETS.cards),
        href: `/movie/${encodeURIComponent(id)}`,
        variant: "compact",
        size: "medium",
      };
    })
    .filter((card) => card.id);
}

function getMoviePosterSource(item = {}) {
  const movie = item.movie && typeof item.movie === "object" ? item.movie : {};
  const episode =
    item.episode && typeof item.episode === "object" ? item.episode : {};
  const content =
    item.content && typeof item.content === "object" ? item.content : {};

  return (
    item.posterUrl ||
    item.poster_url ||
    item.PosterURL ||
    item.poster ||
    item.posterSrc ||
    item.poster_src ||
    item.imgUrl ||
    item.img_url ||
    item.ImgURL ||
    item.image ||
    item.imageUrl ||
    item.image_url ||
    item.ImageURL ||
    item.imageSrc ||
    item.image_src ||
    item.card_url ||
    item.cardUrl ||
    item.CardURL ||
    item.card_image_url ||
    item.cardImageUrl ||
    item.movie_poster_url ||
    item.moviePosterUrl ||
    item.movie_img_url ||
    item.movieImgUrl ||
    item.picture_src ||
    item.picture_url ||
    item.pictureUrl ||
    item.PictureURL ||
    item.pictureFileKey ||
    item.picture_file_key ||
    item.PictureFileKey ||
    item.posterFileKey ||
    item.poster_file_key ||
    item.PosterFileKey ||
    item.file_key ||
    item.fileKey ||
    item.FileKey ||
    movie.posterUrl ||
    movie.poster_url ||
    movie.PosterURL ||
    movie.poster ||
    movie.posterSrc ||
    movie.poster_src ||
    movie.imgUrl ||
    movie.img_url ||
    movie.ImgURL ||
    movie.image ||
    movie.imageUrl ||
    movie.image_url ||
    movie.ImageURL ||
    movie.imageSrc ||
    movie.image_src ||
    movie.card_url ||
    movie.cardUrl ||
    movie.CardURL ||
    movie.card_image_url ||
    movie.cardImageUrl ||
    movie.picture_src ||
    movie.picture_url ||
    movie.pictureUrl ||
    movie.PictureURL ||
    movie.pictureFileKey ||
    movie.picture_file_key ||
    movie.PictureFileKey ||
    movie.posterFileKey ||
    movie.poster_file_key ||
    movie.PosterFileKey ||
    content.posterUrl ||
    content.poster_url ||
    content.imgUrl ||
    content.img_url ||
    content.imageUrl ||
    content.image_url ||
    content.card_url ||
    content.cardUrl ||
    episode.posterUrl ||
    episode.poster_url ||
    episode.poster ||
    episode.imgUrl ||
    episode.img_url ||
    episode.ImgURL ||
    episode.imageUrl ||
    episode.image_url ||
    episode.picture_src ||
    episode.picture_url ||
    episode.PictureFileKey ||
    ""
  );
}

function extractListItems(resp = {}) {
  const unwrapped = unwrapPayload(resp);

  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  const candidates = [
    unwrapped?.items,
    unwrapped?.Items,
    unwrapped?.movies,
    unwrapped?.Movies,
    unwrapped?.favorites,
    unwrapped?.Favorites,
    unwrapped?.history,
    unwrapped?.History,
    unwrapped?.results,
    unwrapped?.Results,
    unwrapped?.records,
    unwrapped?.Records,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getNestedObject(source = {}, key) {
  const capitalizedKey = key.charAt(0).toUpperCase() + key.slice(1);
  const value = source?.[key] || source?.[capitalizedKey];
  return value && typeof value === "object" ? value : null;
}

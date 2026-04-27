import BasePage from "../BasePage.js";
import "./Movie.precompiled.js";
import HeaderComponent from "../../components/Header/Header.js";
import { movieService } from "../../js/MovieService.js";
import PosterCarouselComponent from "../../components/PosterCarousel/PosterCarousel.js";
import MoviePlayerComponent from "../../components/MoviePlayer/MoviePlayer.js";
import { getCacheFallbackNotice } from "../../utils/apiMeta.js";
import { MEDIA_BUCKETS, resolveMediaUrl } from "../../utils/media.js";
import { extractMovie } from "../../utils/apiResponse.js";

const DEFAULT_POSTER_URL = "/img/cards/interstellar.webp";

const COUNTRY_BY_ID = {
  1: "Россия",
  2: "США",
};

const LANGUAGE_BY_ID = {
  1: "Русский",
  2: "Английский",
};

const CONTENT_TYPE_BY_KEY = {
  film: "Фильм",
  serial: "Сериал",
  cartoon: "Мультфильм",
};

export default class MoviePage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("Movie: не передан корневой элемент для Movie");
    }

    super(
      {
        loading: true,
        hasError: false,
        errorText: "",
        cacheMessage: "",
        movie: createEmptyMovieData(),
        ...context,
      },
      Handlebars.templates["Movie.hbs"],
      parent,
      el,
      "MoviePage",
    );

    this._contextLoaded = false;
    this._onOpenPlayerClickBound = this._onOpenPlayerClick.bind(this);
    this._onPopStateBound = this._onPopState.bind(this);
  }

  init() {
    super.init();

    window.addEventListener("popstate", this._onPopStateBound);

    if (!this._contextLoaded) {
      this.loadContext();
    } else {
      this._syncPlayerWithLocation();
    }

    return this;
  }

  async loadContext() {
    const movieId = getMovieIdFromLocation();

    if (!movieId) {
      this._contextLoaded = true;
      this.refresh({
        ...this.context,
        loading: false,
        hasError: true,
        errorText: "В URL не указан id фильма",
        cacheMessage: "",
        movie: createEmptyMovieData(),
      });
      return;
    }

    const movieResult = await movieService.getMovieById(movieId);
    const { ok, status, resp, error } = movieResult;

    if (!ok) {
      this._contextLoaded = true;
      this.refresh({
        ...this.context,
        loading: false,
        hasError: true,
        errorText: mapMovieLoadError(status, error),
        cacheMessage: "",
        movie: createEmptyMovieData(movieId),
      });
      return;
    }

    const moviePayload = extractMovie(resp);

    this._contextLoaded = true;
    this.refresh({
      ...this.context,
      loading: false,
      hasError: false,
      errorText: "",
      cacheMessage: getCacheFallbackNotice(movieResult),
      movie: mapMovieDtoToViewModel(moviePayload || {}),
    });

    this._syncPlayerWithLocation();
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error("Movie: не найден header в шаблоне Movie.hbs");
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

    this._setupCastCarousel();
    this._setupMoviePlayer();
  }

  addEventListeners() {
    const openPlayerButton = this.el.querySelector(
      '[data-action="open-player"]',
    );
    openPlayerButton?.addEventListener("click", this._onOpenPlayerClickBound);
  }

  removeEventListeners() {
    const openPlayerButton = this.el?.querySelector(
      '[data-action="open-player"]',
    );
    openPlayerButton?.removeEventListener(
      "click",
      this._onOpenPlayerClickBound,
    );
  }

  beforeDestroy() {
    window.removeEventListener("popstate", this._onPopStateBound);
  }

  _setupCastCarousel() {
    const carouselSlot = this.el.querySelector("#movie-cast-carousel");
    const cast = Array.isArray(this.context.movie?.cast)
      ? this.context.movie.cast
      : [];

    if (!carouselSlot || !cast.length) {
      return;
    }

    this.addChild(
      "movie-cast-carousel",
      new PosterCarouselComponent(
        {
          slug: "movie-cast",
          movies: cast,
          posterVariant: "person",
          posterSize: "small",
          showArrows: false,
        },
        this,
        carouselSlot,
      ),
    );
  }

  _setupMoviePlayer() {
    const playerRoot = this.el.querySelector("#movie-player-root");

    if (!playerRoot) {
      return;
    }

    this.addChild(
      "movie-player",
      new MoviePlayerComponent({}, this, playerRoot),
    );

    const player = this.getChild("movie-player");
    player?.setOnCloseRequested(() => {
      this._requestPlayerClose();
    });
  }

  async _onOpenPlayerClick(event) {
    event.preventDefault();

    if (this.context.loading || this.context.hasError) {
      return;
    }

    const player = this.getChild("movie-player");

    if (!player) {
      return;
    }

    const initialEpisode = resolveInitialEpisode(this.context.movie);
    await this._openPlayer(initialEpisode?.id || "");
  }

  async _openPlayer(initialEpisodeId = "") {
    const player = this.getChild("movie-player");

    if (!player || this.context.loading || this.context.hasError) {
      return;
    }

    const normalizedEpisodeId = normalizeString(initialEpisodeId);

    if (!isPlayerWatchLocation(window.location)) {
      window.history.pushState(
        {
          modal: "movie-player",
          movieId: this.context.movie.id,
          episodeId: normalizedEpisodeId,
        },
        "",
        buildWatchUrl(this.context.movie.id, normalizedEpisodeId),
      );
    }

    await player.open(this.context.movie, normalizedEpisodeId);
  }

  _requestPlayerClose() {
    if (isPlayerWatchLocation(window.location)) {
      window.history.back();
      return;
    }

    const player = this.getChild("movie-player");
    player?.close({ restoreHistory: false });
  }

  async _syncPlayerWithLocation() {
    const player = this.getChild("movie-player");

    if (!player || this.context.loading || this.context.hasError) {
      return;
    }

    const watchState = readWatchState(window.location, this.context.movie);

    if (!watchState.shouldOpen) {
      await player.close({ restoreHistory: false });
      return;
    }

    await player.open(this.context.movie, watchState.episodeId);
  }

  async _onPopState() {
    await this._syncPlayerWithLocation();
  }
}

function getMovieIdFromLocation() {
  const queryParams = new URLSearchParams(window.location.search);
  const idFromQuery = String(queryParams.get("id") || "").trim();

  if (idFromQuery) {
    return idFromQuery;
  }

  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const movieIndex = pathParts.indexOf("movie");
  const idFromPath =
    movieIndex >= 0 ? String(pathParts[movieIndex + 1] || "").trim() : "";

  if (idFromPath) {
    return decodeURIComponent(idFromPath);
  }

  return "";
}

function mapMovieLoadError(status, errorText = "") {
  if (status === 400) {
    return "Некорректный id фильма";
  }
  if (status === 404) {
    return "Фильм не найден";
  }
  if (status === 500) {
    return "Внутренняя ошибка сервера";
  }
  return errorText || "Не удалось загрузить данные фильма";
}

function createEmptyMovieData(movieId = "") {
  const normalizedId = normalizeString(movieId);
  const fallbackTitle = normalizedId ? `Фильм #${normalizedId}` : "Фильм";

  return {
    id: normalizedId,
    title: fallbackTitle,
    description: "Описание недоступно",
    director: "Не указан",
    contentType: "Не указан",
    releaseYear: "Не указан",
    duration: "Не указана",
    age: "Не указан",
    language: "Не указан",
    country: "Не указана",
    genres: "Не указаны",
    posterUrl: DEFAULT_POSTER_URL,
    trailerUrl: "",
    trailerPreviewUrl: DEFAULT_POSTER_URL,
    ratings: [],
    cast: [],
    similar: [],
  };
}

function mapMovieDtoToViewModel(dto) {
  if (!dto || typeof dto !== "object") {
    return createEmptyMovieData();
  }

  const fallbackMovie = createEmptyMovieData(dto.id);
  const posterUrl =
    normalizeImageUrl(dto.img_url) ||
    normalizePosterImageUrl(dto.poster_url) ||
    fallbackMovie.posterUrl;
  const trailerPreviewUrl =
      normalizePosterImageUrl(dto.poster_url) ||
  normalizeImageUrl(dto.img_url) ||
    normalizeEpisodePreviewUrl(dto.episodes) ||
    posterUrl ||
    fallbackMovie.trailerPreviewUrl;

  return {
    ...fallbackMovie,
    id: normalizeString(dto.id) || fallbackMovie.id,
    title: normalizeString(dto.title) || fallbackMovie.title,
    description: normalizeString(dto.description) || fallbackMovie.description,
    director: normalizeString(dto.director) || fallbackMovie.director,
    contentType: mapContentType(dto.content_type),
    releaseYear: mapReleaseYear(dto.release_year),
    duration: mapDurationSeconds(dto.duration_seconds),
    age: mapAgeLimit(dto.age_limit),
    language: mapLanguage(dto.original_language_id),
    country: mapCountry(dto.country_id),
    genres: mapGenres(dto.genres),
    posterUrl,
    trailerPreviewUrl,
    episodes: mapEpisodes(dto.episodes),
    cast: mapActors(dto.actors),
  };
}

function mapEpisodes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((episode, index) => {
      if (!episode || typeof episode !== "object") {
        return null;
      }

      const id = normalizeString(episode.id);

      if (!id) {
        return null;
      }

      return {
        id,
        movieId: normalizeString(episode.movie_id),
        seasonNumber: Number(episode.season_number) || 1,
        episodeNumber: Number(episode.episode_number) || index + 1,
        title: normalizeString(episode.title) || `Эпизод ${index + 1}`,
        description: normalizeString(episode.description),
        durationSeconds: Number(episode.duration_seconds) || 0,
        imgUrl: normalizeImageUrl(episode.img_url) || DEFAULT_POSTER_URL,
      };
    })
    .filter(Boolean)
    .sort((leftEpisode, rightEpisode) => {
      if (leftEpisode.seasonNumber !== rightEpisode.seasonNumber) {
        return leftEpisode.seasonNumber - rightEpisode.seasonNumber;
      }

      return leftEpisode.episodeNumber - rightEpisode.episodeNumber;
    });
}

function normalizeEpisodePreviewUrl(episodes) {
  if (!Array.isArray(episodes) || !episodes.length) {
    return "";
  }

  const firstEpisodeWithPreview = episodes.find(
    (episode) =>
      episode &&
      typeof episode === "object" &&
      normalizeString(episode.img_url),
  );

  if (!firstEpisodeWithPreview) {
    return "";
  }

  return normalizeImageUrl(firstEpisodeWithPreview.img_url);
}

function mapDurationSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Не указана";
  }

  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) {
    return `${minutes}м`;
  }

  if (!minutes) {
    return `${hours}ч`;
  }

  return `${hours}ч ${minutes}м`;
}

function mapAgeLimit(value) {
  const ageValue = Number(value);
  if (!Number.isFinite(ageValue) || ageValue <= 0) {
    return "Не указан";
  }
  return `${ageValue}+`;
}

function mapGenres(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "Не указаны";
  }

  const genres = value.map((genre) => normalizeString(genre)).filter(Boolean);

  return genres.length ? genres.join(", ") : "Не указаны";
}

function mapActors(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((actor) => {
      if (!actor || typeof actor !== "object") {
        return null;
      }

      const name = normalizeString(actor.full_name);
      if (!name) {
        return null;
      }

      return {
        id: normalizeString(actor.id),
        title: name,
        name,
        posterUrl:
          normalizeActorImageUrl(actor.img_url) || "/img/user-avatar.png",
        imgUrl: normalizeActorImageUrl(actor.img_url) || "/img/user-avatar.png",
        href: `/actor/${encodeURIComponent(normalizeString(actor.id))}`,
        actionText: "Об актере",
      };
    })
    .filter(Boolean);
}

function mapCountry(countryId) {
  const numericCountryId = Number(countryId);

  if (Number.isFinite(numericCountryId) && COUNTRY_BY_ID[numericCountryId]) {
    return COUNTRY_BY_ID[numericCountryId];
  }

  if (Number.isFinite(numericCountryId)) {
    return `ID ${numericCountryId}`;
  }

  return "Не указана";
}

function mapLanguage(languageId) {
  const numericLanguageId = Number(languageId);

  if (Number.isFinite(numericLanguageId) && LANGUAGE_BY_ID[numericLanguageId]) {
    return LANGUAGE_BY_ID[numericLanguageId];
  }

  if (Number.isFinite(numericLanguageId)) {
    return `ID ${numericLanguageId}`;
  }

  return "Не указан";
}

function mapContentType(value) {
  const normalizedValue = normalizeString(value).toLowerCase();
  if (!normalizedValue) {
    return "Не указан";
  }

  return CONTENT_TYPE_BY_KEY[normalizedValue] || normalizedValue;
}

function mapReleaseYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year) || year <= 0) {
    return "Не указан";
  }
  return String(year);
}

function normalizeImageUrl(value) {
  return resolveMediaUrl(normalizeString(value), MEDIA_BUCKETS.cards);
}

function normalizePosterImageUrl(value) {
  return resolveMediaUrl(normalizeString(value), MEDIA_BUCKETS.posters);
}

function normalizeActorImageUrl(value) {
  return resolveMediaUrl(normalizeString(value), MEDIA_BUCKETS.actors);
}

function normalizeString(value) {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return "";
}

function resolveInitialEpisode(movie = {}) {
  const episodes = Array.isArray(movie.episodes) ? movie.episodes : [];

  if (!episodes.length) {
    return null;
  }

  return episodes[0];
}

function isPlayerWatchLocation(location) {
  const params = new URLSearchParams(location.search);
  return params.get("watch") === "1";
}

function readWatchState(location, movie = {}) {
  const shouldOpen = isPlayerWatchLocation(location);

  if (!shouldOpen) {
    return {
      shouldOpen: false,
      episodeId: "",
    };
  }

  const params = new URLSearchParams(location.search);
  const requestedEpisodeId = normalizeString(params.get("episode"));
  const episodes = Array.isArray(movie.episodes) ? movie.episodes : [];
  const fallbackEpisodeId = resolveInitialEpisode(movie)?.id || "";
  const hasRequestedEpisode = episodes.some(
    (episode) => normalizeString(episode.id) === requestedEpisodeId,
  );

  return {
    shouldOpen: true,
    episodeId: hasRequestedEpisode ? requestedEpisodeId : fallbackEpisodeId,
  };
}

function buildWatchUrl(movieId, episodeId = "") {
  const encodedMovieId = encodeURIComponent(normalizeString(movieId));
  const params = new URLSearchParams();
  params.set("watch", "1");

  if (normalizeString(episodeId)) {
    params.set("episode", normalizeString(episodeId));
  }

  const query = params.toString();
  return `/movie/${encodedMovieId}${query ? `?${query}` : ""}`;
}

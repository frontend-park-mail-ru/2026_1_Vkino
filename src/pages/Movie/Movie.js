import BasePage from "../BasePage.js";
import "./Movie.precompiled.js";
import HeaderComponent from "../../components/Header/Header.js";
import { movieService } from "../../js/MovieService.js";
import { UUID_REGEXP } from "../../utils/regexp.js";

const DEFAULT_POSTER_URL = "img/image_12.jpg";

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
        movie: createEmptyMovieData(),
        ...context,
      },
      Handlebars.templates["Movie.hbs"],
      parent,
      el,
      "MoviePage",
    );

    this._contextLoaded = false;
  }

  init() {
    super.init();

    if (!this._contextLoaded) {
      this.loadContext();
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
        movie: createEmptyMovieData(),
      });
      return;
    }

    if (!isUuid(movieId)) {
      this._contextLoaded = true;
      this.refresh({
        ...this.context,
        loading: false,
        hasError: true,
        errorText: "Некорректный формат id фильма",
        movie: createEmptyMovieData(movieId),
      });
      return;
    }

    const { ok, status, resp, error } = await movieService.getMovieById(movieId);

    if (!ok) {
      this._contextLoaded = true;
      this.refresh({
        ...this.context,
        loading: false,
        hasError: true,
        errorText: mapMovieLoadError(status, error),
        movie: createEmptyMovieData(movieId),
      });
      return;
    }

    this._contextLoaded = true;
    this.refresh({
      ...this.context,
      loading: false,
      hasError: false,
      errorText: "",
      movie: mapMovieDtoToViewModel(resp),
    });
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
  }
}

function getMovieIdFromLocation() {
  const queryParams = new URLSearchParams(window.location.search);
  const idFromQuery = String(queryParams.get("id") || "").trim();

  if (idFromQuery) {
    return idFromQuery;
  }

  return "";
}

function isUuid(value) {
  return UUID_REGEXP.test(String(value || "").trim());
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

  const posterUrl = normalizeImageUrl(dto.img_url) || fallbackMovie.posterUrl;

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
    trailerPreviewUrl: posterUrl,
    cast: mapActors(dto.actors),
  };
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

  const genres = value
    .map((genre) => normalizeString(genre))
    .filter(Boolean);

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
        name,
        imgUrl: normalizeImageUrl(actor.img_url) || "img/user-avatar.png",
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

  if (
    Number.isFinite(numericLanguageId) &&
    LANGUAGE_BY_ID[numericLanguageId]
  ) {
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
  const normalizedPath = normalizeString(value);

  if (!normalizedPath) {
    return "";
  }

  if (
    normalizedPath.startsWith("http://") ||
    normalizedPath.startsWith("https://") ||
    normalizedPath.startsWith("data:") ||
    normalizedPath.startsWith("blob:")
  ) {
    return normalizedPath;
  }

  if (normalizedPath.startsWith("img/")) {
    return normalizedPath;
  }

  const path = normalizedPath.startsWith("/")
    ? normalizedPath
    : `/${normalizedPath}`;
  const baseUrl = window.APP_CONFIG?.BASE_URL || window.location.origin;

  try {
    return new URL(path, baseUrl).href;
  } catch {
    return normalizedPath;
  }
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

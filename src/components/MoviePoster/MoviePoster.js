import { BaseComponent } from "../BaseComponent.js";
import "./MoviePoster.precompiled.js";

const DEFAULT_VARIANT = "default";
const DEFAULT_SIZE = "medium";
const DEFAULT_ACTION_TEXT = "Смотреть";

export default class MoviePosterComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error("MoviePoster: не передан parent для MoviePosterComponent");
    }

    if (!el) {
      throw new Error("MoviePoster: не передан el для MoviePosterComponent");
    }

    super(context, Handlebars.templates["MoviePoster.hbs"], parent, el);
  }

  init() {
    this.context = buildPosterContext(this.context);
    return super.init();
  }
}

function buildPosterContext(context = {}) {
  const variant = context.variant || DEFAULT_VARIANT;
  const size = context.size || DEFAULT_SIZE;
  const genres = normalizeGenres(context.genres);
  const description = normalizeDescription(context.description);
  const ageRating = context.ageRating || context.age_rating || "";
  const metaParts = [ageRating, genres[0]].filter(Boolean);
  const imdbRating = normalizeRating(context.imdbRating || context.imdb_rating);
  const kpRating = normalizeRating(context.kpRating || context.kp_rating);
  const imageUrl =
    (variant === "hero" ? context.backdropUrl : null) ||
    context.posterUrl ||
    context.backdropUrl ||
    "img/image_11.jpg";

  const variantConfig = getVariantConfig(variant);

  return {
    ...context,
    variant,
    size,
    imageUrl,
    href: context.href || "/movie",
    actionText: context.actionText || DEFAULT_ACTION_TEXT,
    description,
    genreText: genres.join(" • "),
    metaLine: metaParts.join(" • "),
    imdbRating,
    kpRating,
    hasRatings: Boolean(imdbRating || kpRating),
    showAlwaysContent: variantConfig.showAlwaysContent,
    showOverlay: variantConfig.showOverlay,
    showDescription: variantConfig.showDescription && Boolean(description),
    showButton: variantConfig.showButton,
  };
}

function getVariantConfig(variant) {
  if (variant === "compact") {
    return {
      showAlwaysContent: false,
      showOverlay: true,
      showDescription: false,
      showButton: false,
    };
  }

  if (variant === "hero") {
    return {
      showAlwaysContent: true,
      showOverlay: false,
      showDescription: true,
      showButton: true,
    };
  }

  return {
    showAlwaysContent: false,
    showOverlay: true,
    showDescription: true,
    showButton: true,
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

function normalizeDescription(description) {
  const normalized = String(description || "").trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > 160
    ? `${normalized.slice(0, 157).trim()}...`
    : normalized;
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const normalized = Number(value);
  if (Number.isFinite(normalized)) {
    return normalized.toFixed(1);
  }

  return String(value).trim();
}

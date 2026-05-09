import { BaseComponent } from "@/components/BaseComponent.js";
import "@/components/MovieReviews/MovieReviews.precompiled.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { getApiErrorMessage } from "@/utils/apiError.js";

const REVIEW_REACTIONS = ["like", "dislike"];
const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default class MovieReviewsComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("MovieReviews: не передан el для MovieReviewsComponent");
    }

    super(context, Handlebars.templates["MovieReviews.hbs"], parent, el);

    this._draftRatingValue = null;
    this._draftMessageValue = null;
    this._formError = "";
    this._reactionError = "";
    this._isSaving = false;
    this._isDeleting = false;
    this._loadingReaction = null;

    this._onReviewSubmitBound = this._onReviewSubmit.bind(this);
    this._onDeleteReviewBound = this._onDeleteReview.bind(this);
    this._onReactionClickBound = this._onReactionClick.bind(this);
  }

  init() {
    this.context = buildReviewsContext(this.context, this._getUiState());
    return super.init();
  }

  addEventListeners() {
    const reviewForm = this.el.querySelector('[data-action="save-review"]');
    const deleteButton = this.el.querySelector('[data-action="delete-review"]');
    const reactionButtons = this.el.querySelectorAll(
      '[data-action="review-reaction"]',
    );

    reviewForm?.addEventListener("submit", this._onReviewSubmitBound);
    deleteButton?.addEventListener("click", this._onDeleteReviewBound);
    reactionButtons.forEach((button) => {
      button.addEventListener("click", this._onReactionClickBound);
    });
  }

  removeEventListeners() {
    const reviewForm = this.el?.querySelector('[data-action="save-review"]');
    const deleteButton = this.el?.querySelector(
      '[data-action="delete-review"]',
    );
    const reactionButtons = this.el?.querySelectorAll(
      '[data-action="review-reaction"]',
    );

    reviewForm?.removeEventListener("submit", this._onReviewSubmitBound);
    deleteButton?.removeEventListener("click", this._onDeleteReviewBound);
    reactionButtons?.forEach((button) => {
      button.removeEventListener("click", this._onReactionClickBound);
    });
  }

  async _onReviewSubmit(event) {
    event.preventDefault();

    if (!this.context.isAuthenticated) {
      this._redirectToSignIn();
      return;
    }

    const form = event.currentTarget;
    const { payload, ratingValue, messageValue, error } =
      normalizeReviewFormPayload(form);

    this._draftRatingValue = ratingValue;
    this._draftMessageValue = messageValue;

    if (error) {
      this._formError = error;
      this._refreshSelf();
      return;
    }

    this._formError = "";
    this._reactionError = "";
    this._isSaving = true;
    this._refreshSelf();

    const result = await userService.setMovieReview(
      this.context.movieId,
      payload,
    );

    if (!this.el) {
      return;
    }

    if (!result.ok) {
      this._isSaving = false;
      this._formError = getApiErrorMessage(result, {
        fallback: "Не удалось сохранить отзыв.",
      });
      this._refreshSelf();
      return;
    }

    const refreshResult = await this._notifyMovieChanged();

    if (!this.el || refreshResult?.ok !== false) {
      return;
    }

    this._isSaving = false;
    this._formError =
      refreshResult.error || "Отзыв сохранен, но список не удалось обновить.";
    this._refreshSelf();
  }

  async _onDeleteReview(event) {
    event.preventDefault();

    if (!this.context.isAuthenticated) {
      this._redirectToSignIn();
      return;
    }

    if (!this.context.hasOwnReview || this._isDeleting) {
      return;
    }

    this._formError = "";
    this._reactionError = "";
    this._isDeleting = true;
    this._refreshSelf();

    const result = await userService.deleteMovieReview(this.context.movieId);

    if (!this.el) {
      return;
    }

    if (!result.ok) {
      this._isDeleting = false;
      this._formError = getApiErrorMessage(result, {
        fallback: "Не удалось удалить отзыв.",
      });
      this._refreshSelf();
      return;
    }

    this._draftRatingValue = "";
    this._draftMessageValue = "";
    const refreshResult = await this._notifyMovieChanged();

    if (!this.el || refreshResult?.ok !== false) {
      return;
    }

    this._isDeleting = false;
    this._formError =
      refreshResult.error || "Отзыв удален, но список не удалось обновить.";
    this._refreshSelf();
  }

  async _onReactionClick(event) {
    event.preventDefault();

    if (!this.context.isAuthenticated) {
      this._redirectToSignIn();
      return;
    }

    const button = event.currentTarget;
    const reviewId = normalizeString(button.dataset.reviewId);
    const reaction = normalizeReaction(button.dataset.reaction);
    const review = this.context.reviews.find((item) => item.id === reviewId);

    if (
      !review ||
      !review.canReact ||
      !REVIEW_REACTIONS.includes(reaction) ||
      this._loadingReaction
    ) {
      return;
    }

    this._formError = "";
    this._reactionError = "";
    this._loadingReaction = { reviewId, reaction };
    this._refreshSelf();

    const result =
      review.viewerReaction === reaction
        ? await userService.deleteReviewReaction(reviewId)
        : await userService.setReviewReaction(reviewId, reaction);

    if (!this.el) {
      return;
    }

    if (!result.ok) {
      this._loadingReaction = null;
      this._reactionError = getApiErrorMessage(result, {
        fallback: "Не удалось обновить реакцию.",
      });
      this._refreshSelf();
      return;
    }

    const refreshResult = await this._notifyMovieChanged();

    if (!this.el || refreshResult?.ok !== false) {
      return;
    }

    this._loadingReaction = null;
    this._reactionError =
      refreshResult.error ||
      "Реакция сохранена, но список не удалось обновить.";
    this._refreshSelf();
  }

  async _notifyMovieChanged() {
    const onMovieChanged = this.context.onMovieChanged;

    if (typeof onMovieChanged !== "function") {
      return { ok: true };
    }

    try {
      const result = await onMovieChanged();
      return result || { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Не удалось обновить данные фильма.",
      };
    }
  }

  _redirectToSignIn() {
    router.go(this.context.signInHref || buildSignInHref());
  }

  _refreshSelf() {
    if (!this.el) {
      return;
    }

    this.refresh(this.context);
  }

  _getUiState() {
    return {
      draftRatingValue: this._draftRatingValue,
      draftMessageValue: this._draftMessageValue,
      formError: this._formError,
      reactionError: this._reactionError,
      isSaving: this._isSaving,
      isDeleting: this._isDeleting,
      loadingReaction: this._loadingReaction,
    };
  }
}

function buildReviewsContext(context = {}, uiState = {}) {
  const currentUser = context.currentUser || {};
  const currentUserId = normalizeUserId(currentUser);
  const movieId = normalizeString(context.movieId);
  const reviews = normalizeReviews(context.reviews, currentUserId, uiState);
  const ownReview = reviews.find((review) => review.isOwn) || null;
  const hasDraftRating = uiState.draftRatingValue !== null;
  const hasDraftMessage = uiState.draftMessageValue !== null;
  const formRatingValue = hasDraftRating
    ? uiState.draftRatingValue
    : ownReview?.ratingInputValue || "";
  const formMessageValue = hasDraftMessage
    ? uiState.draftMessageValue
    : ownReview?.comment || "";
  const isAuthenticated = Boolean(context.isAuthenticated || currentUserId);

  return {
    ...context,
    movieId,
    reviews,
    hasReviews: reviews.length > 0,
    reviewsCountLabel: getReviewsCountLabel(reviews.length),
    currentUser,
    currentUserId,
    isAuthenticated,
    signInHref: buildSignInHref(),
    ownReview,
    hasOwnReview: Boolean(ownReview),
    formTitle: ownReview ? "Ваш отзыв" : "Оставить отзыв",
    formSubmitLabel: ownReview ? "Сохранить изменения" : "Опубликовать",
    formRatingValue,
    formMessageValue,
    formError: uiState.formError || "",
    reactionError: uiState.reactionError || "",
    isSaving: Boolean(uiState.isSaving),
    isDeleting: Boolean(uiState.isDeleting),
    formControlsDisabled: Boolean(uiState.isSaving || uiState.isDeleting),
  };
}

function normalizeReviews(reviews, currentUserId, uiState = {}) {
  if (!Array.isArray(reviews)) {
    return [];
  }

  return reviews
    .map((review) => normalizeReview(review, currentUserId, uiState))
    .filter(Boolean);
}

function normalizeReview(review, currentUserId, uiState = {}) {
  if (!review || typeof review !== "object") {
    return null;
  }

  const id = normalizeString(review.id);

  if (!id) {
    return null;
  }

  const authorUserId = normalizeString(
    review.author_user_id || review.authorUserId || review.user_id,
  );
  const rating = normalizeNullableNumber(review.rating);
  const comment = normalizeString(review.comment || review.message);
  const viewerReaction = normalizeReaction(
    review.viewer_reaction || review.viewerReaction,
  );
  const isOwn = Boolean(currentUserId && authorUserId === currentUserId);
  const loadingReaction = uiState.loadingReaction || {};
  const isReactionLoading = loadingReaction.reviewId === id;
  const likeLoading = isReactionLoading && loadingReaction.reaction === "like";
  const dislikeLoading =
    isReactionLoading && loadingReaction.reaction === "dislike";

  return {
    ...review,
    id,
    author_user_id: authorUserId,
    author:
      normalizeString(
        review.author || review.author_name || review.authorEmail,
      ) || "Пользователь",
    rating,
    hasRating: rating !== null,
    ratingLabel: rating !== null ? formatRating(rating) : "",
    ratingInputValue: rating !== null ? formatRating(rating) : "",
    comment,
    hasComment: Boolean(comment),
    likesCount: normalizeCount(review.likes_count || review.likesCount),
    dislikesCount: normalizeCount(
      review.dislikes_count || review.dislikesCount,
    ),
    viewerReaction,
    createdAtLabel: formatReviewDate(review.created_at || review.createdAt),
    updatedAtLabel: formatReviewDate(review.updated_at || review.updatedAt),
    isEdited: isReviewEdited(
      review.created_at || review.createdAt,
      review.updated_at || review.updatedAt,
    ),
    isOwn,
    canReact: !isOwn,
    likeButtonClass: buildReactionButtonClass({
      active: viewerReaction === "like",
      loading: likeLoading,
    }),
    dislikeButtonClass: buildReactionButtonClass({
      active: viewerReaction === "dislike",
      loading: dislikeLoading,
    }),
    likeButtonDisabled: isOwn || isReactionLoading,
    dislikeButtonDisabled: isOwn || isReactionLoading,
  };
}

function normalizeReviewFormPayload(form) {
  const formData = new FormData(form);
  const rawRating = normalizeString(formData.get("rating")).replace(",", ".");
  const messageValue = normalizeString(formData.get("message"));
  const payload = {
    message: messageValue,
  };

  if (rawRating) {
    const rating = Number(rawRating);

    if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
      return {
        payload: {},
        ratingValue: rawRating,
        messageValue,
        error: "Оценка должна быть числом от 0 до 10.",
      };
    }

    payload.rating = rating;
  }

  if (!rawRating && !messageValue) {
    return {
      payload: {},
      ratingValue: rawRating,
      messageValue,
      error: "Добавьте оценку или текст отзыва.",
    };
  }

  return {
    payload,
    ratingValue: rawRating,
    messageValue,
    error: "",
  };
}

function normalizeUserId(user = {}) {
  return normalizeString(user.id || user.user_id || user.userId);
}

function normalizeNullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeCount(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.floor(numberValue)
    : 0;
}

function normalizeReaction(value) {
  const reaction = normalizeString(value).toLowerCase();
  return REVIEW_REACTIONS.includes(reaction) ? reaction : "";
}

function formatRating(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return "";
  }

  return Number.isInteger(numberValue)
    ? String(numberValue)
    : numberValue.toFixed(1);
}

function formatReviewDate(value) {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Дата неизвестна";
  }

  return DATE_FORMATTER.format(date);
}

function isReviewEdited(createdAt, updatedAt) {
  const createdTime = new Date(createdAt).getTime();
  const updatedTime = new Date(updatedAt).getTime();

  if (!Number.isFinite(createdTime) || !Number.isFinite(updatedTime)) {
    return false;
  }

  return Math.abs(updatedTime - createdTime) > 1000;
}

function buildReactionButtonClass({ active = false, loading = false } = {}) {
  return [
    "movie-review-card__reaction",
    active ? "is-active" : "",
    loading ? "is-loading" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function getReviewsCountLabel(count) {
  const normalizedCount = Number(count) || 0;
  const lastDigit = normalizedCount % 10;
  const lastTwoDigits = normalizedCount % 100;

  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return `${normalizedCount} отзыв`;
  }

  if ([2, 3, 4].includes(lastDigit) && ![12, 13, 14].includes(lastTwoDigits)) {
    return `${normalizedCount} отзыва`;
  }

  return `${normalizedCount} отзывов`;
}

function buildSignInHref() {
  const returnTo = encodeURIComponent(
    window.location.pathname + window.location.search,
  );

  return `/sign-in?return_to=${returnTo}`;
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

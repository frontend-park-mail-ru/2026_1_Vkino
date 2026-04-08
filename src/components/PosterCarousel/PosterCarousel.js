import { BaseComponent } from "../BaseComponent.js";
import MoviePosterComponent from "../MoviePoster/MoviePoster.js";
import "./PosterCarousel.precompiled.js";

export default class PosterCarouselComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error("PosterCarousel: не передан parent для PosterCarouselComponent");
    }

    if (!el) {
      throw new Error("PosterCarousel: не передан el для PosterCarouselComponent");
    }

    super(context, Handlebars.templates["PosterCarousel.hbs"], parent, el);

    this._dragState = null;
    this._onDocumentMouseMoveBound = this._onDocumentMouseMove.bind(this);
    this._onDocumentMouseUpBound = this._onDocumentMouseUp.bind(this);
  }

  init() {
    this.context = buildCarouselContext(this.context);
    return super.init();
  }

  setupChildren() {
    this.context.posterItems.forEach((posterItem) => {
      const slot = this.el.querySelector(`[data-poster-slot="${posterItem.slotKey}"]`);
      if (!slot) {
        return;
      }

      this.addChild(
        `poster-${posterItem.slotKey}`,
        new MoviePosterComponent(posterItem, this, slot),
      );
    });
  }

  addEventListeners() {
    const prevButton = this.el.querySelector('[data-action="scroll-prev"]');
    const nextButton = this.el.querySelector('[data-action="scroll-next"]');
    const viewport = this.el.querySelector('[data-role="viewport"]');

    prevButton?.addEventListener("click", this._onPrevClick);
    nextButton?.addEventListener("click", this._onNextClick);
    viewport?.addEventListener("mousedown", this._onViewportMouseDown);
    document.addEventListener("mousemove", this._onDocumentMouseMoveBound);
    document.addEventListener("mouseup", this._onDocumentMouseUpBound);
  }

  removeEventListeners() {
    const prevButton = this.el.querySelector('[data-action="scroll-prev"]');
    const nextButton = this.el.querySelector('[data-action="scroll-next"]');
    const viewport = this.el.querySelector('[data-role="viewport"]');

    prevButton?.removeEventListener("click", this._onPrevClick);
    nextButton?.removeEventListener("click", this._onNextClick);
    viewport?.removeEventListener("mousedown", this._onViewportMouseDown);
    document.removeEventListener("mousemove", this._onDocumentMouseMoveBound);
    document.removeEventListener("mouseup", this._onDocumentMouseUpBound);
  }

  _onPrevClick = () => {
    this._scrollByDirection(-1);
  };

  _onNextClick = () => {
    this._scrollByDirection(1);
  };

  _onViewportMouseDown = (e) => {
    if (e.button !== 0) {
      return;
    }

    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) {
      return;
    }

    this._dragState = {
      startX: e.pageX,
      scrollLeft: viewport.scrollLeft,
    };
    viewport.classList.add("is-dragging");
  };

  _onDocumentMouseMove(e) {
    if (!this._dragState) {
      return;
    }

    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) {
      return;
    }

    const delta = e.pageX - this._dragState.startX;
    viewport.scrollLeft = this._dragState.scrollLeft - delta;
  }

  _onDocumentMouseUp() {
    if (!this._dragState) {
      return;
    }

    const viewport = this.el.querySelector('[data-role="viewport"]');
    viewport?.classList.remove("is-dragging");
    this._dragState = null;
  }

  _scrollByDirection(direction) {
    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      left: viewport.clientWidth * 0.82 * direction,
      behavior: "smooth",
    });
  }
}

function buildCarouselContext(context = {}) {
  const movies = Array.isArray(context.movies) ? context.movies : [];
  const posterSize = context.posterSize || "medium";
  const posterVariant = context.posterVariant || "default";

  return {
    ...context,
    showArrows: context.showArrows !== false,
    centeredHero: Boolean(context.centeredHero),
    posterItems: movies.map((movie, index) => ({
      ...movie,
      size: movie.size || posterSize,
      variant: movie.variant || posterVariant,
      slotKey: movie.slotKey || `${context.slug || "carousel"}-${index}`,
    })),
  };
}

import { BaseComponent } from "@/components/BaseComponent.js";
import MoviePosterComponent from "@/components/MoviePoster/MoviePoster.js";
import "./PosterCarousel.precompiled.js";

export default class PosterCarouselComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error(
        "PosterCarousel: не передан parent для PosterCarouselComponent",
      );
    }
    if (!el) {
      throw new Error(
        "PosterCarousel: не передан el для PosterCarouselComponent",
      );
    }
    super(context, Handlebars.templates["PosterCarousel.hbs"], parent, el);

    this._dragState = null;
    this._isHeroCycling = false;
    this._onDocumentMouseMoveBound = this._onDocumentMouseMove.bind(this);
    this._onDocumentMouseUpBound = this._onDocumentMouseUp.bind(this);
    this._onDocumentMouseLeaveBound = this._onDocumentMouseLeave.bind(this);
    this._onWindowBlurBound = this._onWindowBlur.bind(this);
    this._onWindowResizeBound = this._onWindowResize.bind(this);
    this._onViewportScrollBound = this._updateScrollArrowState.bind(this);
    this._onSlideClickBound = this._onSlideClick.bind(this);
    this._onDragStartBound = this._onDragStart.bind(this);
  }

  init() {
    this.context = buildCarouselContext(this.context);
    return super.init();
  }

  setupChildren() {
    this.context.posterItems.forEach((posterItem) => {
      const slot = this.el.querySelector(
        `[data-poster-slot="${posterItem.slotKey}"]`,
      );
      if (!slot) return;
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
    const slides = this.el.querySelectorAll(".poster-carousel__slide");

    prevButton?.addEventListener("click", this._onPrevClick);
    nextButton?.addEventListener("click", this._onNextClick);
    viewport?.addEventListener("mousedown", this._onViewportMouseDown);
    viewport?.addEventListener("scroll", this._onViewportScrollBound, {
      passive: true,
    });
    slides.forEach((slide) => {
      slide.addEventListener("click", this._onSlideClickBound);
      slide.addEventListener("dragstart", this._onDragStartBound);
    });
    document.addEventListener("mousemove", this._onDocumentMouseMoveBound);
    document.addEventListener("mouseup", this._onDocumentMouseUpBound);
    document.addEventListener("mouseleave", this._onDocumentMouseLeaveBound);
    window.addEventListener("blur", this._onWindowBlurBound);
    window.addEventListener("resize", this._onWindowResizeBound);

    this._disableImageDragging();

    if (this.context.centeredHero) {
      this._applyActiveSlideState();
    } else {
      this._updateScrollArrowState();
    }
  }

  removeEventListeners() {
    const prevButton = this.el.querySelector('[data-action="scroll-prev"]');
    const nextButton = this.el.querySelector('[data-action="scroll-next"]');
    const viewport = this.el.querySelector('[data-role="viewport"]');
    const slides = this.el.querySelectorAll(".poster-carousel__slide");

    prevButton?.removeEventListener("click", this._onPrevClick);
    nextButton?.removeEventListener("click", this._onNextClick);
    viewport?.removeEventListener("mousedown", this._onViewportMouseDown);
    viewport?.removeEventListener("scroll", this._onViewportScrollBound);
    slides.forEach((slide) => {
      slide.removeEventListener("click", this._onSlideClickBound);
      slide.removeEventListener("dragstart", this._onDragStartBound);
    });
    document.removeEventListener("mousemove", this._onDocumentMouseMoveBound);
    document.removeEventListener("mouseup", this._onDocumentMouseUpBound);
    document.removeEventListener("mouseleave", this._onDocumentMouseLeaveBound);
    window.removeEventListener("blur", this._onWindowBlurBound);
    window.removeEventListener("resize", this._onWindowResizeBound);

    this._stopDragging();
    this._cancelHeroCycle();
  }

  _disableImageDragging() {
    const images = this.el.querySelectorAll(".poster-carousel__slide img");
    images.forEach((img) => {
      img.setAttribute("draggable", "false");
    });
  }

  _onDragStart(e) {
    e.preventDefault();
    return false;
  }

  _cancelHeroCycle() {
    if (!this.context.centeredHero) return;
    const track = this.el.querySelector(".poster-carousel__track");
    if (track) {
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
    }
    this._isHeroCycling = false;
  }

  _onPrevClick = () => {
    if (this.context.centeredHero) {
      this._cycleHero(-1);
      return;
    }
    this._scrollByDirection(-1);
  };

  _onNextClick = () => {
    if (this.context.centeredHero) {
      this._cycleHero(1);
      return;
    }
    this._scrollByDirection(1);
  };

  _onSlideClick(e) {
    if (!this.context.centeredHero) return;
    const slide = e.currentTarget;
    if (slide.classList.contains("is-prev")) {
      this._cycleHero(-1);
    } else if (slide.classList.contains("is-next")) {
      this._cycleHero(1);
    }
  }

  _onViewportMouseDown = (e) => {
    e.preventDefault();

    if (this.context.centeredHero) return;
    if (e.button !== 0) return;

    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) return;

    if (viewport.scrollWidth <= viewport.clientWidth) return;

    this._dragState = {
      startX: e.pageX,
      scrollLeft: viewport.scrollLeft,
    };
    viewport.classList.add("is-dragging");
  };

  _onDocumentMouseMove(e) {
    if (!this._dragState) return;
    if (e.buttons === 0) {
      this._stopDragging();
      return;
    }

    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) return;

    const delta = e.pageX - this._dragState.startX;
    viewport.scrollLeft = this._dragState.scrollLeft - delta;
  }

  _onDocumentMouseUp() {
    this._stopDragging();
  }

  _onDocumentMouseLeave() {
    this._stopDragging();
  }

  _onWindowBlur() {
    this._stopDragging();
  }

  _stopDragging() {
    if (!this._dragState) return;
    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (viewport) {
      viewport.classList.remove("is-dragging");
    }
    this._dragState = null;
  }

  _onWindowResize() {
    if (!this.context.centeredHero) {
      this._updateScrollArrowState();
      return;
    }

    if (this._isHeroCycling) {
      this._cancelHeroCycle();
    }

    const track = this.el.querySelector(".poster-carousel__track");
    if (!track) return;

    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    this._applyActiveSlideState();
  }

  _scrollByDirection(direction) {
    const viewport = this.el.querySelector('[data-role="viewport"]');
    if (!viewport) return;

    viewport.scrollBy({
      left: viewport.clientWidth * 0.82 * direction,
      behavior: "smooth",
    });
  }

  _updateScrollArrowState() {
    if (this.context.centeredHero) return;

    const viewport = this.el.querySelector('[data-role="viewport"]');
    const prevButton = this.el.querySelector('[data-action="scroll-prev"]');
    const nextButton = this.el.querySelector('[data-action="scroll-next"]');

    if (!viewport || (!prevButton && !nextButton)) {
      return;
    }

    const maxScrollLeft = Math.max(viewport.scrollWidth - viewport.clientWidth, 0);
    const canScrollBackward = viewport.scrollLeft > 1;
    const canScrollForward = viewport.scrollLeft < maxScrollLeft - 1;

    updateArrowAvailability(prevButton, canScrollBackward);
    updateArrowAvailability(nextButton, canScrollForward);
  }

  _applyActiveSlideState(nextActiveIndex = null) {
    const slides = Array.from(
      this.el.querySelectorAll(".poster-carousel__slide"),
    );
    const activeIndex =
      nextActiveIndex === null ? Math.floor(slides.length / 2) : nextActiveIndex;

    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === activeIndex);
      slide.classList.toggle("is-prev", index === activeIndex - 1);
      slide.classList.toggle("is-next", index === activeIndex + 1);
    });
  }

  _cycleHero(direction) {
    if (!this.context.centeredHero || this._isHeroCycling) return;

    const track = this.el.querySelector(".poster-carousel__track");
    const slides = Array.from(track?.children || []);

    if (!track || slides.length < 3) return;

    this._isHeroCycling = true;
    const gap = getTrackGap(track);
    const activeIndex = Math.floor(slides.length / 2);

    if (direction > 0) {
      const firstSlide = slides[0];
      const shift = firstSlide.offsetWidth + gap;

      this._applyActiveSlideState(activeIndex + 1);
      void track.offsetWidth;

      track.style.transition = `transform ${HERO_CYCLE_DURATION_MS}ms ${HERO_CYCLE_EASING}`;
      track.style.transform = `translateX(${-shift}px)`;
      const onTransitionEnd = (event) => {
        if (event.target !== track) return;

        track.removeEventListener("transitionend", onTransitionEnd);
        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        track.append(firstSlide);
        this._applyActiveSlideState();
        this._isHeroCycling = false;
      };
      track.addEventListener("transitionend", onTransitionEnd);
      return;
    }

    const lastSlide = slides[slides.length - 1];
    track.prepend(lastSlide);

    const shift = lastSlide.offsetWidth + gap;
    track.style.transition = "none";
    track.style.transform = `translateX(${-shift}px)`;
    this._applyActiveSlideState(activeIndex);
    void track.offsetWidth;

    track.style.transition = `transform ${HERO_CYCLE_DURATION_MS}ms ${HERO_CYCLE_EASING}`;
    track.style.transform = "translateX(0)";
    const onTransitionEnd = (event) => {
      if (event.target !== track) return;

      track.removeEventListener("transitionend", onTransitionEnd);
      track.style.transition = "none";
      track.style.transform = "translateX(0)";
      this._applyActiveSlideState();
      this._isHeroCycling = false;
    };
    track.addEventListener("transitionend", onTransitionEnd);
  }
}

const HERO_CYCLE_DURATION_MS = 620;
const HERO_CYCLE_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function buildCarouselContext(context = {}) {
  const movies = Array.isArray(context.movies) ? context.movies : [];
  const posterSize = context.posterSize || "medium";
  const posterVariant = context.posterVariant || "default";
  const centeredHero = Boolean(context.centeredHero);

  return {
    ...context,
    showTitle: !centeredHero && Boolean(context.title),
    showArrows: context.showArrows !== false,
    centeredHero,
    canScrollBackward: centeredHero,
    canScrollForward: true,
    posterItems: movies.map((movie, index) => ({
      ...movie,
      size: centeredHero ? "hero" : movie.size || posterSize,
      variant: centeredHero ? "hero" : movie.variant || posterVariant,
      actionText: movie.actionText || context.actionText,
      slotKey: movie.slotKey || `${context.slug || "carousel"}-${index}`,
      slideIndex: index,
      progress: movie.progress || null,
      showProgress: Boolean(context.showProgress && movie.progress),
    })),
  };
}

function getTrackGap(track) {
  const styles = window.getComputedStyle(track);
  return Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
}

function updateArrowAvailability(button, isAvailable) {
  if (!button) return;

  button.classList.toggle("is-hidden", !isAvailable);
  button.hidden = !isAvailable;
  button.disabled = !isAvailable;
}

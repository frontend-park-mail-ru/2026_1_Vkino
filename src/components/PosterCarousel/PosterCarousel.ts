// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import { BaseComponent } from "@/components/BaseComponent.ts";
import MoviePosterComponent from "@/components/MoviePoster/MoviePoster.ts";
import "./PosterCarousel.precompiled.js";
import type { AnyRecord } from "@/types/shared.ts";

export default class PosterCarouselComponent extends BaseComponent {
  constructor(
    context: AnyRecord = {},
    parent: BaseComponent | null = null,
    el: Element | null = null,
  ) {
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
    const viewport = this.el.querySelector<HTMLElement>('[data-role="viewport"]');
    const slides = this.el.querySelectorAll<HTMLElement>(".poster-carousel__slide");

    prevButton?.addEventListener("click", this._onPrevClick);
    nextButton?.addEventListener("click", this._onNextClick);
    viewport?.addEventListener("mousedown", this._onViewportMouseDown);
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
    }
  }

  removeEventListeners() {
    const prevButton = this.el.querySelector('[data-action="scroll-prev"]');
    const nextButton = this.el.querySelector('[data-action="scroll-next"]');
    const viewport = this.el.querySelector<HTMLElement>('[data-role="viewport"]');
    const slides = this.el.querySelectorAll<HTMLElement>(".poster-carousel__slide");

    prevButton?.removeEventListener("click", this._onPrevClick);
    nextButton?.removeEventListener("click", this._onNextClick);
    viewport?.removeEventListener("mousedown", this._onViewportMouseDown);
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
    const track = this.el.querySelector<HTMLElement>(".poster-carousel__track");
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

    const viewport = this.el.querySelector<HTMLElement>('[data-role="viewport"]');
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

    const viewport = this.el.querySelector<HTMLElement>('[data-role="viewport"]');
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
    const viewport = this.el.querySelector<HTMLElement>('[data-role="viewport"]');
    if (viewport) {
      viewport.classList.remove("is-dragging");
    }
    this._dragState = null;
  }

  _onWindowResize() {
    if (!this.context.centeredHero) return;

    if (this._isHeroCycling) {
      this._cancelHeroCycle();
    }

    const track = this.el.querySelector<HTMLElement>(".poster-carousel__track");
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

  _applyActiveSlideState() {
    const slides = Array.from(
      this.el.querySelectorAll<HTMLElement>(".poster-carousel__slide"),
    );
    const activeIndex = Math.floor(slides.length / 2);

    slides.forEach((slide, index) => {
      slide.classList.toggle("is-active", index === activeIndex);
      slide.classList.toggle("is-prev", index === activeIndex - 1);
      slide.classList.toggle("is-next", index === activeIndex + 1);
    });
  }

  _cycleHero(direction) {
    if (!this.context.centeredHero || this._isHeroCycling) return;

    const track = this.el.querySelector<HTMLElement>(".poster-carousel__track");
    const slides = Array.from(track?.children || []);

    if (!track || slides.length < 3) return;

    this._isHeroCycling = true;
    const gap = getTrackGap(track);

    if (direction > 0) {
      const firstSlide = slides[0];
      const shift = firstSlide.getBoundingClientRect().width + gap;

      track.style.transition = `transform ${HERO_CYCLE_DURATION_MS}ms ease`;
      track.style.transform = `translateX(${-shift}px)`;
      track.addEventListener(
        "transitionend",
        () => {
          track.style.transition = "none";
          track.style.transform = "translateX(0)";
          track.append(firstSlide);
          this._applyActiveSlideState();
          this._isHeroCycling = false;
        },
        { once: true },
      );
      return;
    }

    const lastSlide = slides[slides.length - 1];
    track.prepend(lastSlide);

    const shift = lastSlide.getBoundingClientRect().width + gap;
    track.style.transition = "none";
    track.style.transform = `translateX(${-shift}px)`;
    void track.offsetWidth;

    track.style.transition = `transform ${HERO_CYCLE_DURATION_MS}ms ease`;
    track.style.transform = "translateX(0)";
    track.addEventListener(
      "transitionend",
      () => {
        track.style.transition = "none";
        track.style.transform = "translateX(0)";
        this._applyActiveSlideState();
        this._isHeroCycling = false;
      },
      { once: true },
    );
  }
}

const HERO_CYCLE_DURATION_MS = 320;

function buildCarouselContext(context: AnyRecord = {}) {
  const movies = Array.isArray(context.movies) ? context.movies : [];
  const posterSize = context.posterSize || "medium";
  const posterVariant = context.posterVariant || "default";
  const centeredHero = Boolean(context.centeredHero);

  return {
    ...context,
    showArrows: context.showArrows !== false,
    centeredHero,
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

function getTrackGap(track: Element): number {
  const styles = window.getComputedStyle(track);
  return Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
}

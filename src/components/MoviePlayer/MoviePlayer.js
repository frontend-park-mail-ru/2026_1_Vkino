import { BaseComponent } from "@/components/BaseComponent.js";
import "./MoviePlayer.precompiled.js";
import MoviePlayerVolumeComponent from "@/components/MoviePlayerVolume/MoviePlayerVolume.js";
import { authStore } from "@/store/authStore.js";
import { playerService } from "@/js/PlayerService.js";
import { MEDIA_BUCKETS, resolveMediaUrl } from "@/utils/media.js";

const CONTROLS_HIDE_DELAY_MS = 2200;
const SEEK_STEP_SECONDS = 10;
const PROGRESS_SAVE_THROTTLE_MS = 10_000;
const DEFAULT_VOLUME = 1;

export default class MoviePlayerComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error(
        "MoviePlayer: не передан parent для MoviePlayerComponent",
      );
    }

    if (!el) {
      throw new Error("MoviePlayer: не передан el для MoviePlayerComponent");
    }

    super(
      {
        ...createInitialContext(),
        ...context,
      },
      Handlebars.templates["MoviePlayer.hbs"],
      parent,
      el,
    );

    this.playerService = playerService;
    this.videoEl = null;
    this._controlsHideTimeout = null;
    this._throttledProgressSaveAt = 0;
    this._pendingCurrentTime = 0;
    this._urlStartSeconds = 0;
    this._pendingAutoplay = false;
    this._isSeeking = false;
    this._bodyLockSnapshot = null;
    this._openedByPlayerState = false;
    this._isInitialized = false;
    this._isDestroyed = false;
    this._lastSavedSecond = -1;
    this._closeRequestedCallback = null;
    this._lastNonZeroVolume = DEFAULT_VOLUME;

    this._onDocumentKeyDownBound = this._onDocumentKeyDown.bind(this);
    this._onDocumentMouseMoveBound = this._onDocumentMouseMove.bind(this);
    this._onDocumentClickBound = this._onDocumentClick.bind(this);
    this._onFullscreenChangeBound = this._onFullscreenChange.bind(this);
    this._onBeforeUnloadBound = this._onBeforeUnload.bind(this);
  }

  init() {
    this.context = {
      ...createInitialContext(),
      ...this.context,
    };

    this._isInitialized = true;
    return super.init();
  }

  setupChildren() {
    const volumeRoot = this.el.querySelector('[data-role="volume-control"]');

    if (!volumeRoot || !this.context.showMuteControl) {
      return;
    }

    this.addChild(
      "movie-player-volume",
      new MoviePlayerVolumeComponent(
        buildVolumeControlContext(this.context, {
          onToggleMute: this.toggleMute.bind(this),
          onVolumeInput: this.setVolume.bind(this),
          onVolumeCommit: this.setVolume.bind(this),
        }),
        this,
        volumeRoot,
      ),
    );
  }

  addEventListeners() {
    this._bindDomEvents();
    if (!this.context.isEmbedded) {
      document.addEventListener("keydown", this._onDocumentKeyDownBound);
      document.addEventListener("mousemove", this._onDocumentMouseMoveBound);
    }
    document.addEventListener("click", this._onDocumentClickBound);
    document.addEventListener(
      "fullscreenchange",
      this._onFullscreenChangeBound,
    );
    window.addEventListener("beforeunload", this._onBeforeUnloadBound);
  }

  removeEventListeners() {
    this._unbindDomEvents();
    document.removeEventListener("keydown", this._onDocumentKeyDownBound);
    document.removeEventListener("mousemove", this._onDocumentMouseMoveBound);
    document.removeEventListener("click", this._onDocumentClickBound);
    document.removeEventListener(
      "fullscreenchange",
      this._onFullscreenChangeBound,
    );
    window.removeEventListener("beforeunload", this._onBeforeUnloadBound);
  }

  beforeDestroy() {
    this._isDestroyed = true;
    this.close({ restoreHistory: false });
    this._clearVideoSource();
    this.videoEl = null;
  }

  async open(movieData, initialEpisodeId = null, options = {}) {
    this._urlStartSeconds = Math.max(
      0,
      Math.floor(Number(options.startSeconds) || 0),
    );

    const normalizedMovie = normalizeMovieData(movieData);
    const initialEpisode = this._resolveInitialEpisode(
      normalizedMovie,
      initialEpisodeId,
    );
    const openOptions = normalizeOpenOptions(options);

    this.context = {
      ...this.context,
      ...buildOpenContext(normalizedMovie, initialEpisode?.id || ""),
      isAuthenticated: authStore.getState().status === "authenticated",
    };

    this._rerender();
    if (!this.context.isEmbedded) {
      this._lockBodyScroll();
    }
    this._showControls();

    if (!initialEpisode) {
      this.context = {
        ...this.context,
        isLoading: false,
        isEmpty: true,
        emptyText: "Для этого фильма пока нет доступных эпизодов.",
      };
      this.updateUI();
      return;
    }

    await this.loadEpisode(initialEpisode.id, {
      autoplay: openOptions.autoplay,
      restoreProgress: openOptions.restoreProgress,
      startAtSeconds: openOptions.startAtSeconds,
    });
  }

  async close({ restoreHistory = true } = {}) {
    if (!this.context.isOpen && !this.context.isFullscreenFallback) {
      return;
    }

    this.pause();
    await this.saveProgress({ force: true });
    this._urlStartSeconds = 0;
    this._clearControlsHideTimeout();
    await this._exitFullscreenIfNeeded();
    this._restoreBodyScroll();

    this.context = {
      ...this.context,
      isOpen: false,
      isPlaying: false,
      isFullscreen: false,
      isFullscreenFallback: false,
      areControlsVisible: true,
    };

    if (restoreHistory && this._openedByPlayerState) {
      this._openedByPlayerState = false;
    }

    this.updateUI();
  }

  setOnCloseRequested(callback) {
    this._closeRequestedCallback =
      typeof callback === "function" ? callback : null;
  }

  async loadEpisode(
    episodeId,
    { autoplay = true, restoreProgress = true, startAtSeconds = 0 } = {},
  ) {
    const normalizedEpisodeId = String(episodeId ?? "").trim();

    if (!normalizedEpisodeId) {
      this.context = {
        ...this.context,
        isLoading: false,
        hasError: true,
        errorText: "Не удалось определить эпизод для воспроизведения.",
      };
      this.updateUI();
      return;
    }

    if (
      this.context.activeEpisodeId &&
      this.context.activeEpisodeId !== normalizedEpisodeId
    ) {
      await this.saveProgress({ force: true });
    }

    const activeEpisode = this.context.episodes.find(
      (episode) => String(episode.id) === normalizedEpisodeId,
    );

    this.context = {
      ...this.context,
      activeEpisodeId: normalizedEpisodeId,
      activeEpisode,
      episodes: markActiveEpisode(this.context.episodes, normalizedEpisodeId),
      hasError: false,
      errorText: "",
      isEmpty: false,
      emptyText: "",
      isLoading: true,
      episodeTitle:
        activeEpisode?.displayTitle ||
        activeEpisode?.title ||
        this.context.movieTitle,
      episodeDescription:
        activeEpisode?.description || this.context.movieDescription,
    };

    this.pause();
    this._throttledProgressSaveAt = 0;
    this._lastSavedSecond = -1;
    this.updateUI();

    const directPlayback = resolveDirectPlaybackPayload(activeEpisode);
    let playbackResult = {
      ok: true,
      status: 200,
      resp: directPlayback,
      error: "",
    };

    if (!directPlayback) {
      playbackResult = await this.playerService.getEpisodePlayback(
        normalizedEpisodeId,
      );
    }

    const { ok, status, resp, error } = playbackResult;

    if (!ok) {
      this.context = {
        ...this.context,
        isLoading: false,
        hasError: true,
        errorText: mapPlaybackError(status, error),
      };
      this.updateUI();
      return;
    }

    const playbackUrl = normalizeString(resp?.playback_url);

    if (!playbackUrl) {
      this.context = {
        ...this.context,
        isLoading: false,
        isEmpty: true,
        emptyText: "Ссылка на видео отсутствует.",
      };
      this._clearVideoSource();
      this.updateUI();
      return;
    }

    const playbackPositionSeconds = Math.max(
      0,
      Number(resp?.position_seconds) || 0,
    );
    const resolvedStartAtSeconds = Math.max(0, Number(startAtSeconds) || 0);
    const restoredProgressSeconds =
      restoreProgress && !activeEpisode?.isDirectPlayback
        ? await this.restoreProgress(normalizedEpisodeId, playbackPositionSeconds)
        : Math.max(playbackPositionSeconds, resolvedStartAtSeconds);

    let seekSeconds = restoredProgressSeconds;
    if (this._urlStartSeconds > 0) {
      seekSeconds = this._urlStartSeconds;
    }
    this._urlStartSeconds = 0;

    this._pendingCurrentTime = seekSeconds;
    this._pendingAutoplay = Boolean(autoplay);

    this.context = {
      ...this.context,
      playback: {
        episodeId: normalizeString(resp?.episode_id) || normalizedEpisodeId,
        title: normalizeString(resp?.title) || this.context.episodeTitle,
        playbackUrl,
        durationSeconds: Number(resp?.duration_seconds) || 0,
        positionSeconds: seekSeconds,
      },
      isLoading: false,
      hasError: false,
      errorText: "",
      isEmpty: false,
      emptyText: "",
      duration:
        Number(resp?.duration_seconds) || activeEpisode?.durationSeconds || 0,
      durationLabel: formatTime(Number(resp?.duration_seconds) || 0),
      currentTime: this._pendingCurrentTime,
      currentTimeLabel: formatTime(this._pendingCurrentTime),
      progressPercent: calculateProgressPercent(
        this._pendingCurrentTime,
        Number(resp?.duration_seconds) || 0,
      ),
      posterUrl: activeEpisode?.imgUrl || this.context.posterUrl,
      episodeTitle: normalizeString(resp?.title) || this.context.episodeTitle,
    };

    this._setVideoSource(playbackUrl);
    this.updateUI();

    if (this.context.isOpen && !this.context.isEmbedded) {
      this._enterFullscreen().catch(() => {
        this.context = {
          ...this.context,
          isFullscreenFallback: true,
        };
        this.updateUI();
      });
    }
  }

  play() {
    if (!this.videoEl || !this.context.isOpen) {
      return;
    }

    const playPromise = this.videoEl.play();

    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        this.context = {
          ...this.context,
          isPlaying: false,
          hasError: true,
          errorText: "Браузер не разрешил автоматическое воспроизведение.",
        };
        this.updateUI();
      });
    }
  }

  pause() {
    if (!this.videoEl) {
      return;
    }

    this.videoEl.pause();
  }

  togglePlay() {
    if (this.videoEl?.paused) {
      this.play();
      return;
    }

    this.pause();
  }

  toggleMute() {
    if (!this.videoEl) {
      return;
    }

    const currentVolume = resolvePlayerVolume(
      this.videoEl.volume,
      this.context.volumePercent / 100,
    );

    if (this.videoEl.muted || currentVolume <= 0) {
      const restoreVolume = clampVolume(
        this._lastNonZeroVolume,
        DEFAULT_VOLUME,
      );

      this.videoEl.volume = restoreVolume;
      this.videoEl.muted = false;
    } else {
      this._lastNonZeroVolume = currentVolume;
      this.videoEl.muted = true;
    }

    this._syncVolumeState();
    this.updateUI();
  }

  setVolume(nextVolumePercent) {
    if (!this.videoEl) {
      return;
    }

    const normalizedPercent = clampPercent(
      nextVolumePercent,
      this.context.volumePercent,
    );
    const normalizedVolume = clampVolume(
      normalizedPercent / 100,
      this.context.volumePercent / 100,
    );

    this.videoEl.volume = normalizedVolume;
    this.videoEl.muted = normalizedVolume <= 0;

    if (normalizedVolume > 0) {
      this._lastNonZeroVolume = normalizedVolume;
    }

    this._syncVolumeState();
    this.updateUI();
  }

  restoreAudioState({ volumePercent = null, isMuted = null } = {}) {
    const normalizedPercent = clampPercent(
      volumePercent,
      this.context.volumePercent,
    );
    const normalizedVolume = clampVolume(
      normalizedPercent / 100,
      this.context.volumePercent / 100,
    );
    const nextIsMuted =
      typeof isMuted === "boolean" ? isMuted : normalizedVolume <= 0;

    if (this.videoEl) {
      this.videoEl.volume = normalizedVolume;
      this.videoEl.muted = nextIsMuted;
    }

    if (normalizedVolume > 0) {
      this._lastNonZeroVolume = normalizedVolume;
    }

    this.context = {
      ...this.context,
      volumePercent: normalizedPercent,
      isMuted: nextIsMuted,
      muteButtonLabel: nextIsMuted ? "Включить звук" : "Выключить звук",
    };
    this.updateUI();
  }

  async toggleFullscreen() {
    if (document.fullscreenElement) {
      await this._exitFullscreenIfNeeded();
      return;
    }

    try {
      await this._enterFullscreen();
    } catch {
      this.context = {
        ...this.context,
        isFullscreenFallback: !this.context.isFullscreenFallback,
      };
      this.updateUI();
    }
  }

  async saveProgress({ force = false, resetOnEnded = false } = {}) {
    const isAuthenticated = authStore.getState().status === "authenticated";
    if (this.context.isAuthenticated !== isAuthenticated) {
      this.context = {
        ...this.context,
        isAuthenticated,
      };
    }

    if (!this.context.isAuthenticated) {
      return {
        ok: true,
        skipped: true,
      };
    }

    const episodeId = normalizeString(this.context.activeEpisodeId);

    if (!episodeId || !this.videoEl) {
      return {
        ok: true,
        skipped: true,
      };
    }

    const duration =
      Number(this.videoEl.duration) || this.context.duration || 0;
    const rawCurrentTime = resetOnEnded
      ? 0
      : Number(this.videoEl.currentTime) || 0;
    const normalizedCurrentTime = Math.max(
      0,
      Math.min(Math.floor(rawCurrentTime), duration || Number.MAX_SAFE_INTEGER),
    );

    if (!force && normalizedCurrentTime === this._lastSavedSecond) {
      return {
        ok: true,
        skipped: true,
      };
    }

    const result = await this.playerService.saveEpisodeProgress(
      episodeId,
      normalizedCurrentTime,
    );

    if (result.ok) {
      this._lastSavedSecond = normalizedCurrentTime;
    }

    return result;
  }

  async restoreProgress(episodeId, playbackPositionSeconds = 0) {
    if (!this.context.isAuthenticated || this.context.isDirectPlayback) {
      return Math.max(0, Math.floor(Number(playbackPositionSeconds) || 0));
    }

    const result = await this.playerService.getEpisodeProgress(episodeId);

    if (!result.ok) {
      return Math.max(0, Math.floor(Number(playbackPositionSeconds) || 0));
    }

    const apiProgressSeconds = Number(result.resp?.position_seconds);

    if (!Number.isFinite(apiProgressSeconds) || apiProgressSeconds < 0) {
      return Math.max(0, Math.floor(Number(playbackPositionSeconds) || 0));
    }

    return Math.max(
      0,
      Math.floor(
        Math.max(apiProgressSeconds, Number(playbackPositionSeconds) || 0),
      ),
    );
  }

  updateUI() {
    if (!this.el || this._isDestroyed) {
      return;
    }

    const overlay = this.el.querySelector('[data-role="player-overlay"]');
    const progressInput = this.el.querySelector('[data-role="progress-input"]');
    const currentTimeEl = this.el.querySelector('[data-role="current-time"]');
    const durationTimeEl = this.el.querySelector('[data-role="duration-time"]');
    const playButtons = this.el.querySelectorAll('[data-action="toggle-play"]');
    const fullscreenButtons = this.el.querySelectorAll(
      '[data-action="toggle-fullscreen"]',
    );
    const titleEl = this.el.querySelector(".movie-player__title");
    const descriptionEl = this.el.querySelector(".movie-player__description");
    const posterLayer = this.el.querySelector('[data-role="poster-layer"]');

    overlay?.classList.toggle("is-open", this.context.isOpen);
    overlay?.classList.toggle(
      "is-controls-visible",
      this.context.areControlsVisible,
    );
    overlay?.classList.toggle(
      "is-fullscreen-fallback",
      this.context.isFullscreenFallback,
    );

    if (overlay) {
      overlay.setAttribute("aria-hidden", String(!this.context.isOpen));
    }

    if (progressInput && !this._isSeeking) {
      progressInput.value = String(this.context.progressPercent);
    }

    if (currentTimeEl) {
      currentTimeEl.textContent = this.context.currentTimeLabel;
    }

    if (durationTimeEl) {
      durationTimeEl.textContent = this.context.durationLabel;
    }

    playButtons.forEach((button) => {
      button.classList.toggle("is-playing", this.context.isPlaying);
    });

    fullscreenButtons.forEach((button) => {
      button.classList.toggle(
        "is-fullscreen",
        this.context.isFullscreen || this.context.isFullscreenFallback,
      );
    });

    this.getChild("movie-player-volume")?.sync(
      buildVolumeControlContext(this.context, {
        onToggleMute: this.toggleMute.bind(this),
        onVolumeInput: this.setVolume.bind(this),
        onVolumeCommit: this.setVolume.bind(this),
      }),
    );

    const episodeMenu = this.el.querySelector('[data-role="episode-menu"]');
    const episodeMenuTrigger = this.el.querySelector(
      '[data-action="toggle-episode-menu"]',
    );

    episodeMenu?.classList.toggle("is-open", this.context.isEpisodeMenuOpen);
    episodeMenuTrigger?.setAttribute(
      "aria-expanded",
      this.context.isEpisodeMenuOpen ? "true" : "false",
    );

    this.el.querySelectorAll('[data-action="select-episode"]').forEach((node) => {
      const isActive =
        normalizeString(node.dataset?.episodeId) ===
        normalizeString(this.context.activeEpisodeId);

      node.classList.toggle("is-active", isActive);
    });

    if (titleEl) {
      titleEl.textContent = this.context.episodeTitle;
    }

    if (descriptionEl) {
      descriptionEl.textContent = this.context.episodeDescription;
    }

    posterLayer?.classList.toggle(
      "is-hidden",
      this.context.isPlaying ||
        this.context.isLoading ||
        this.context.hasError ||
        this.context.isEmpty,
    );
  }

  getPlaybackState() {
    return {
      activeEpisodeId: this.context.activeEpisodeId,
      currentTime:
        Number(this.videoEl?.currentTime) || Number(this.context.currentTime) || 0,
      isPlaying: Boolean(this.context.isPlaying),
      isMuted: Boolean(this.context.isMuted),
      volumePercent: clampPercent(this.context.volumePercent, 100),
      volume:
        resolvePlayerVolume(
          this.videoEl?.volume,
          this.context.volumePercent / 100,
        ) || 0,
    };
  }

  _rerender() {
    if (!this._isInitialized || !this.el) {
      return;
    }

    this.removeEventListeners();
    this.destroyChildren();
    this.render();
    this.setupChildren();
    this.initChildren();
    this.addEventListeners();
    this._bindElements();
  }

  _bindElements() {
    this.videoEl = this.el.querySelector('[data-role="video"]');

    if (this.videoEl) {
      this.videoEl.volume = clampVolume(
        this.context.volumePercent / 100,
        DEFAULT_VOLUME,
      );
      this.videoEl.muted = this.context.isMuted;
      this._syncVolumeState();
    }
  }

  _bindDomEvents() {
    this._bindAction('[data-action="close"]', this._onCloseClick, true);
    this._bindAction(
      '[data-action="toggle-play"]',
      this._onTogglePlayClick,
      true,
    );
    this._bindAction(
      '[data-action="seek-backward"]',
      this._onSeekBackwardClick,
    );
    this._bindAction('[data-action="seek-forward"]', this._onSeekForwardClick);
    this._bindAction(
      '[data-action="toggle-episode-menu"]',
      this._onToggleEpisodeMenuClick,
    );
    this._bindAction(
      '[data-action="toggle-fullscreen"]',
      this._onToggleFullscreenClick,
      true,
    );
    this._bindAction('[data-action="open-chat"]', this._onOpenChatClick, true);
    this._bindAction(
      '[data-action="select-episode"]',
      this._onSelectEpisodeClick,
      true,
    );

    const progressInput = this.el.querySelector('[data-role="progress-input"]');
    progressInput?.addEventListener("input", this._onProgressInput);
    progressInput?.addEventListener("change", this._onProgressChange);

    const shell = this.el.querySelector('[data-role="player-shell"]');
    shell?.addEventListener("mousemove", this._onShellMouseMove);

    this.videoEl = this.el.querySelector('[data-role="video"]');

    this.videoEl?.addEventListener("click", this._onVideoClick);
    this.videoEl?.addEventListener("loadedmetadata", this._onLoadedMetadata);
    this.videoEl?.addEventListener("timeupdate", this._onTimeUpdate);
    this.videoEl?.addEventListener("play", this._onPlay);
    this.videoEl?.addEventListener("pause", this._onPause);
    this.videoEl?.addEventListener("ended", this._onEnded);
    this.videoEl?.addEventListener("volumechange", this._onVolumeChange);
    this.videoEl?.addEventListener("error", this._onVideoError);
  }

  _unbindDomEvents() {
    this._unbindAction('[data-action="close"]', this._onCloseClick, true);
    this._unbindAction(
      '[data-action="toggle-play"]',
      this._onTogglePlayClick,
      true,
    );
    this._unbindAction(
      '[data-action="seek-backward"]',
      this._onSeekBackwardClick,
    );
    this._unbindAction(
      '[data-action="seek-forward"]',
      this._onSeekForwardClick,
    );
    this._unbindAction(
      '[data-action="toggle-episode-menu"]',
      this._onToggleEpisodeMenuClick,
    );
    this._unbindAction(
      '[data-action="toggle-fullscreen"]',
      this._onToggleFullscreenClick,
      true,
    );
    this._unbindAction(
      '[data-action="open-chat"]',
      this._onOpenChatClick,
      true,
    );
    this._unbindAction(
      '[data-action="select-episode"]',
      this._onSelectEpisodeClick,
      true,
    );

    const progressInput = this.el?.querySelector(
      '[data-role="progress-input"]',
    );
    progressInput?.removeEventListener("input", this._onProgressInput);
    progressInput?.removeEventListener("change", this._onProgressChange);

    const shell = this.el?.querySelector('[data-role="player-shell"]');
    shell?.removeEventListener("mousemove", this._onShellMouseMove);

    this.videoEl?.removeEventListener("click", this._onVideoClick);
    this.videoEl?.removeEventListener("loadedmetadata", this._onLoadedMetadata);
    this.videoEl?.removeEventListener("timeupdate", this._onTimeUpdate);
    this.videoEl?.removeEventListener("play", this._onPlay);
    this.videoEl?.removeEventListener("pause", this._onPause);
    this.videoEl?.removeEventListener("ended", this._onEnded);
    this.videoEl?.removeEventListener("volumechange", this._onVolumeChange);
    this.videoEl?.removeEventListener("error", this._onVideoError);
  }

  _bindAction(selector, handler, multiple = false) {
    if (multiple) {
      this.el.querySelectorAll(selector).forEach((node) => {
        node.addEventListener("click", handler);
      });
      return;
    }

    this.el.querySelector(selector)?.addEventListener("click", handler);
  }

  _unbindAction(selector, handler, multiple = false) {
    if (multiple) {
      this.el?.querySelectorAll(selector).forEach((node) => {
        node.removeEventListener("click", handler);
      });
      return;
    }

    this.el?.querySelector(selector)?.removeEventListener("click", handler);
  }

  _setVideoSource(playbackUrl) {
    if (!this.videoEl) {
      this.videoEl = this.el.querySelector('[data-role="video"]');
    }

    if (!this.videoEl) {
      return;
    }

    this.videoEl.src = playbackUrl;
    this.videoEl.load();
  }

  _clearVideoSource() {
    if (!this.videoEl) {
      return;
    }

    this.videoEl.removeAttribute("src");
    this.videoEl.load();
  }

  async _enterFullscreen() {
    const shell = this.el.querySelector('[data-role="player-shell"]');
    const fullscreenTarget = this._resolveFullscreenTarget(shell);

    if (
      !fullscreenTarget ||
      typeof fullscreenTarget.requestFullscreen !== "function"
    ) {
      throw new Error("Fullscreen API unavailable");
    }

    await fullscreenTarget.requestFullscreen();
  }

  _resolveFullscreenTarget(fallbackTarget) {
    const selector = normalizeString(this.context.fullscreenTargetSelector);

    if (!selector) {
      return fallbackTarget;
    }

    try {
      return this.el.closest(selector) || fallbackTarget;
    } catch {
      return fallbackTarget;
    }
  }

  async _exitFullscreenIfNeeded() {
    if (
      document.fullscreenElement &&
      typeof document.exitFullscreen === "function"
    ) {
      await document.exitFullscreen();
    }
  }

  _showControls() {
    this.context = {
      ...this.context,
      areControlsVisible: true,
    };
    this.updateUI();
    this._scheduleControlsHide();
  }

  _hideControls() {
    if (!this.context.isPlaying) {
      return;
    }

    this.context = {
      ...this.context,
      areControlsVisible: false,
    };
    this.updateUI();
  }

  _scheduleControlsHide() {
    this._clearControlsHideTimeout();

    if (!this.context.isPlaying) {
      return;
    }

    this._controlsHideTimeout = window.setTimeout(() => {
      this._hideControls();
    }, CONTROLS_HIDE_DELAY_MS);
  }

  _clearControlsHideTimeout() {
    if (this._controlsHideTimeout) {
      window.clearTimeout(this._controlsHideTimeout);
      this._controlsHideTimeout = null;
    }
  }

  _lockBodyScroll() {
    if (this._bodyLockSnapshot) {
      return;
    }

    this._bodyLockSnapshot = {
      overflow: document.body.style.overflow,
    };

    document.body.style.overflow = "hidden";
  }

  _restoreBodyScroll() {
    if (!this._bodyLockSnapshot) {
      return;
    }

    document.body.style.overflow = this._bodyLockSnapshot.overflow;
    this._bodyLockSnapshot = null;
  }

  _resolveInitialEpisode(movieData, initialEpisodeId) {
    const episodes = Array.isArray(movieData?.episodes)
      ? movieData.episodes
      : [];
    const normalizedEpisodeId = String(initialEpisodeId ?? "").trim();

    if (!episodes.length) {
      return null;
    }

    if (normalizedEpisodeId) {
      const matchedEpisode = episodes.find(
        (episode) => String(episode.id) === normalizedEpisodeId,
      );

      if (matchedEpisode) {
        return matchedEpisode;
      }
    }

    return episodes[0];
  }

  _seekTo(nextTime) {
    if (!this.videoEl) {
      return;
    }

    const duration =
      Number(this.videoEl.duration) || this.context.duration || 0;
    const boundedTime = Math.min(
      Math.max(Number(nextTime) || 0, 0),
      duration || Number.MAX_SAFE_INTEGER,
    );

    this.videoEl.currentTime = boundedTime;
    this.context = {
      ...this.context,
      currentTime: boundedTime,
      currentTimeLabel: formatTime(boundedTime),
      progressPercent: calculateProgressPercent(boundedTime, duration),
    };
    this.updateUI();
  }

  _onCloseClick = async (event) => {
    event.preventDefault();
    if (this._closeRequestedCallback) {
      this._closeRequestedCallback();
      return;
    }

    await this.close();
  };

  _onTogglePlayClick = (event) => {
    event.preventDefault();
    this.togglePlay();
  };
  _onToggleEpisodeMenuClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    this.context = {
      ...this.context,
      isEpisodeMenuOpen: !this.context.isEpisodeMenuOpen,
    };
    this.updateUI();
  };

  _onSeekBackwardClick = (event) => {
    event.preventDefault();
    this._seekTo((Number(this.videoEl?.currentTime) || 0) - SEEK_STEP_SECONDS);
  };

  _onSeekForwardClick = (event) => {
    event.preventDefault();
    this._seekTo((Number(this.videoEl?.currentTime) || 0) + SEEK_STEP_SECONDS);
  };

  _onToggleFullscreenClick = async (event) => {
    event.preventDefault();
    await this.toggleFullscreen();
  };

  _onOpenChatClick = (event) => {
    event.preventDefault();

    if (typeof this.context.onChatRequested === "function") {
      this.context.onChatRequested();
    }
  };

  _onSelectEpisodeClick = async (event) => {
    event.preventDefault();
    this.context = {
      ...this.context,
      isEpisodeMenuOpen: false,
    };
    const episodeId = event.currentTarget?.dataset?.episodeId;

    if (!episodeId || episodeId === this.context.activeEpisodeId) {
      return;
    }

    await this.loadEpisode(episodeId, {
      autoplay: true,
      restoreProgress: true,
    });
  };

  _onDocumentClick(event) {
    if (!this.context.isEpisodeMenuOpen || !this.el) {
      return;
    }

    const menu = this.el.querySelector('[data-role="episode-menu"]');

    if (menu?.contains(event.target)) {
      return;
    }

    this.context = {
      ...this.context,
      isEpisodeMenuOpen: false,
    };
    this.updateUI();
  }

  _onProgressInput = (event) => {
    const target = event.currentTarget;
    const duration =
      Number(this.videoEl?.duration) || this.context.duration || 0;
    const nextPercent = Number(target?.value) || 0;
    const nextTime = duration > 0 ? (duration * nextPercent) / 100 : 0;

    this._isSeeking = true;
    this.context = {
      ...this.context,
      currentTime: nextTime,
      currentTimeLabel: formatTime(nextTime),
      progressPercent: nextPercent,
    };
    this.updateUI();
  };

  _onProgressChange = (event) => {
    const target = event.currentTarget;
    const duration =
      Number(this.videoEl?.duration) || this.context.duration || 0;
    const nextPercent = Number(target?.value) || 0;
    const nextTime = duration > 0 ? (duration * nextPercent) / 100 : 0;

    this._isSeeking = false;
    this._seekTo(nextTime);
  };

  _onShellMouseMove = () => {
    if (!this.context.isOpen) {
      return;
    }

    this._showControls();
  };

  _onVideoClick = () => {
    this.togglePlay();
  };

  _onLoadedMetadata = () => {
    if (!this.videoEl) {
      return;
    }

    const duration =
      Number(this.videoEl.duration) || this.context.duration || 0;

    if (this._pendingCurrentTime > 0) {
      try {
        this.videoEl.currentTime = this._pendingCurrentTime;
      } catch {
        this.videoEl.currentTime = 0;
      }
    }

    this.context = {
      ...this.context,
      duration,
      durationLabel: formatTime(duration),
      currentTime: Number(this.videoEl.currentTime) || 0,
      currentTimeLabel: formatTime(Number(this.videoEl.currentTime) || 0),
      progressPercent: calculateProgressPercent(
        Number(this.videoEl.currentTime) || 0,
        duration,
      ),
    };
    this.updateUI();

    if (this._pendingAutoplay) {
      this.play();
    }
  };

  _onTimeUpdate = () => {
    if (!this.videoEl || this._isSeeking) {
      return;
    }

    const currentTime = Number(this.videoEl.currentTime) || 0;
    const duration =
      Number(this.videoEl.duration) || this.context.duration || 0;

    this.context = {
      ...this.context,
      currentTime,
      currentTimeLabel: formatTime(currentTime),
      progressPercent: calculateProgressPercent(currentTime, duration),
    };
    this.updateUI();
    this._maybeThrottledProgressSave();
  };

  _maybeThrottledProgressSave() {
    const isAuthenticated = authStore.getState().status === "authenticated";
    if (this.context.isAuthenticated !== isAuthenticated) {
      this.context = {
        ...this.context,
        isAuthenticated,
      };
    }

    if (!this.context.isPlaying || !this.context.isAuthenticated) {
      return;
    }

    const now = Date.now();
    const throttleMs = PROGRESS_SAVE_THROTTLE_MS;
    if (now - this._throttledProgressSaveAt < throttleMs) {
      return;
    }
    this._throttledProgressSaveAt = now;
    void this.saveProgress();
  }


  _onPlay = () => {
    this.context = {
      ...this.context,
      isPlaying: true,
      playButtonLabel: "Pause",
      hasError: false,
    };
    this.updateUI();
    this._throttledProgressSaveAt = Date.now();
    this._scheduleControlsHide();
  };

  _onPause = () => {
    void this.saveProgress({ force: true });
    this.context = {
      ...this.context,
      isPlaying: false,
      playButtonLabel: "Play",
      areControlsVisible: true,
    };
    this.updateUI();
    this._clearControlsHideTimeout();
    this._throttledProgressSaveAt = 0;
  };

  _onEnded = () => {
    void this.saveProgress({ force: true, resetOnEnded: true });
    this.context = {
      ...this.context,
      isPlaying: false,
      playButtonLabel: "Replay",
      areControlsVisible: true,
    };
    this.updateUI();
    this._throttledProgressSaveAt = 0;
  };

  _onVolumeChange = () => {
    this._syncVolumeState();
    this.updateUI();
  };

  _syncVolumeState() {
    const normalizedVolume = resolvePlayerVolume(
      this.videoEl?.volume,
      this.context.volumePercent / 100,
    );
    const volumePercent = clampPercent(normalizedVolume * 100, 100);
    const isMuted = Boolean(this.videoEl?.muted) || normalizedVolume <= 0;

    if (normalizedVolume > 0) {
      this._lastNonZeroVolume = normalizedVolume;
    }

    this.context = {
      ...this.context,
      volumePercent,
      isMuted,
      muteButtonLabel: isMuted ? "Включить звук" : "Выключить звук",
    };
  }

  _onVideoError = () => {
    this.context = {
      ...this.context,
      hasError: true,
      isLoading: false,
      errorText: "Не удалось воспроизвести видео.",
    };
    this.updateUI();
  };

  _onDocumentMouseMove() {
    if (!this.context.isOpen) {
      return;
    }

    this._showControls();
  }

  _onDocumentKeyDown(event) {
    if (!this.context.isOpen) {
      return;
    }

    const target = event.target;
    const isFormField =
      target instanceof HTMLElement &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable);

    if (isFormField && event.code !== "Space") {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();
      this.togglePlay();
      return;
    }

    if (event.code === "ArrowLeft") {
      event.preventDefault();
      this._seekTo(
        (Number(this.videoEl?.currentTime) || 0) - SEEK_STEP_SECONDS,
      );
      return;
    }

    if (event.code === "ArrowRight") {
      event.preventDefault();
      this._seekTo(
        (Number(this.videoEl?.currentTime) || 0) + SEEK_STEP_SECONDS,
      );
      return;
    }

    if (event.code === "Escape") {
      event.preventDefault();

      if (document.fullscreenElement || this.context.isFullscreenFallback) {
        this.toggleFullscreen();
        return;
      }

      if (this._closeRequestedCallback) {
        this._closeRequestedCallback();
        return;
      }

      this.close();
    }
  }

  _onFullscreenChange() {
    this.context = {
      ...this.context,
      isFullscreen: Boolean(document.fullscreenElement),
    };

    if (!this.context.isFullscreen) {
      this.context = {
        ...this.context,
        isFullscreenFallback: false,
      };
    }

    this.updateUI();
  }

  _onBeforeUnload() {
    this.saveProgress({ force: true });
  }
}

function createInitialContext() {
  return {
    isOpen: false,
    isEmbedded: false,
    showTopbar: true,
    showCloseButton: true,
    showSeekControls: true,
    showMuteControl: true,
    showFullscreenControl: true,
    showChatControl: false,
    fullscreenTargetSelector: "",
    onChatRequested: null,
    isLoading: false,
    hasError: false,
    errorText: "",
    isEmpty: false,
    emptyText: "",
    areControlsVisible: true,
    isPlaying: false,
    isMuted: false,
    volumePercent: 100,
    isFullscreen: false,
    isFullscreenFallback: false,
    isAuthenticated: false,
    movieId: "",
    movieTitle: "Плеер",
    movieDescription: "",
    contentType: "",
    posterUrl: "",
    activeEpisodeId: "",
    activeEpisode: null,
    episodes: [],
    hasEpisodes: false,
    showEpisodeMenuButton: false,
    isEpisodeMenuOpen: false,
    episodesCountLabel: "",
    episodeTitle: "Видео",
    episodeDescription: "",
    currentTime: 0,
    currentTimeLabel: "0:00",
    duration: 0,
    durationLabel: "0:00",
    progressPercent: 0,
    playButtonLabel: "Play",
    muteButtonLabel: "Выключить звук",
    playback: null,
    isDirectPlayback: false,
  };
}

function buildOpenContext(movieData, activeEpisodeId) {
  const episodes = markActiveEpisode(movieData.episodes, activeEpisodeId);
  const activeEpisode =
    episodes.find((episode) => episode.isActive) || episodes[0] || null;
  const normalizedContentType = normalizeString(movieData.contentType).toLowerCase();
  const shouldShowEpisodeMenu =
    (normalizedContentType === "series" ||
      normalizedContentType === "serial") &&
    episodes.length > 0;

  return {
    isOpen: true,
    isLoading: false,
    hasError: false,
    errorText: "",
    isEmpty: false,
    emptyText: "",
    areControlsVisible: true,
    isPlaying: false,
    movieId: movieData.id,
    movieTitle: movieData.title,
    movieDescription: movieData.description,
    contentType: movieData.contentType,
    posterUrl: activeEpisode?.imgUrl || movieData.posterUrl,
    activeEpisodeId: activeEpisode?.id || "",
    activeEpisode,
    episodes,
    hasEpisodes: episodes.length > 1,
    showEpisodeMenuButton: shouldShowEpisodeMenu,
    isEpisodeMenuOpen: false,
    episodesCountLabel: `${episodes.length} ${pluralizeEpisodes(episodes.length)}`,
    episodeTitle: activeEpisode?.displayTitle || movieData.title,
    episodeDescription: activeEpisode?.description || movieData.description,
    currentTime: 0,
    currentTimeLabel: "0:00",
    duration: 0,
    durationLabel: "0:00",
    progressPercent: 0,
    playButtonLabel: "Play",
    muteButtonLabel: "Выключить звук",
    playback: null,
    isDirectPlayback: false,
  };
}

function normalizeOpenOptions(options = {}) {
  return {
    autoplay: options.autoplay !== false,
    restoreProgress: options.restoreProgress !== false,
    startAtSeconds: Math.max(0, Number(options.startAtSeconds) || 0),
  };
}

function normalizeMovieData(movieData = {}) {
  const episodes = Array.isArray(movieData.episodes)
    ? movieData.episodes.map((episode, index) =>
        normalizeEpisodeData(episode, index),
      )
    : [];

  return {
    id: normalizeString(movieData.id),
    title: normalizeString(movieData.title) || "Видео",
    description: normalizeString(movieData.description),
    contentType: normalizeString(
      movieData.contentType || movieData.content_type,
    ),
    posterUrl: resolveMediaUrl(
      movieData.posterUrl || movieData.img_url,
      MEDIA_BUCKETS.cards,
    ),
    episodes,
  };
}

function normalizeEpisodeData(episode = {}, index = 0) {
  const seasonNumber =
    Number(episode.seasonNumber ?? episode.season_number) || 1;
  const episodeNumber =
    Number(episode.episodeNumber ?? episode.episode_number) || index + 1;
  const durationSeconds =
    Number(episode.durationSeconds ?? episode.duration_seconds) || 0;
  const title = normalizeString(episode.title) || `Эпизод ${episodeNumber}`;

  return {
    id: normalizeString(episode.id),
    title,
    description: normalizeString(episode.description),
    imgUrl: resolveMediaUrl(
      episode.imgUrl || episode.img_url,
      MEDIA_BUCKETS.cards,
    ),
    seasonNumber,
    episodeNumber,
    durationSeconds,
    durationLabel: formatTime(durationSeconds),
    metaLabel: `S${String(seasonNumber).padStart(2, "0")} · E${String(episodeNumber).padStart(2, "0")}`,
    displayTitle: buildEpisodeDisplayTitle(title, seasonNumber, episodeNumber),
    isActive: false,
    playbackUrl: normalizeString(episode.playbackUrl || episode.playback_url),
    playbackPositionSeconds:
      Number(episode.playbackPositionSeconds ?? episode.position_seconds) || 0,
    isDirectPlayback: Boolean(
      episode.isDirectPlayback ??
        episode.directPlayback ??
        episode.playbackUrl ??
        episode.playback_url,
    ),
  };
}

function resolveDirectPlaybackPayload(episode = null) {
  if (!episode?.isDirectPlayback) {
    return null;
  }

  const playbackUrl = normalizeString(episode.playbackUrl);

  if (!playbackUrl) {
    return {
      playback_url: "",
      episode_id: normalizeString(episode.id),
      title: normalizeString(episode.displayTitle || episode.title),
      duration_seconds: Number(episode.durationSeconds) || 0,
      position_seconds: Number(episode.playbackPositionSeconds) || 0,
    };
  }

  return {
    playback_url: playbackUrl,
    episode_id: normalizeString(episode.id),
    title: normalizeString(episode.displayTitle || episode.title),
    duration_seconds: Number(episode.durationSeconds) || 0,
    position_seconds: Number(episode.playbackPositionSeconds) || 0,
  };
}

function markActiveEpisode(episodes = [], activeEpisodeId = "") {
  return episodes.map((episode) => ({
    ...episode,
    isActive: String(episode.id) === String(activeEpisodeId),
  }));
}

function buildEpisodeDisplayTitle(title, seasonNumber, episodeNumber) {
  return `Сезон ${seasonNumber}, серия ${episodeNumber} · ${title}`;
}

function formatTime(value) {
  const totalSeconds = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function calculateProgressPercent(currentTime, duration) {
  const normalizedDuration = Number(duration) || 0;

  if (normalizedDuration <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min((Number(currentTime) / normalizedDuration) * 100, 100),
  );
}

function buildVolumeControlContext(context = {}, callbacks = {}) {
  return {
    volumePercent: clampPercent(context.volumePercent, 100),
    isMuted: Boolean(context.isMuted),
    buttonLabel: context.muteButtonLabel || "Выключить звук",
    onToggleMute: callbacks.onToggleMute || null,
    onVolumeInput: callbacks.onVolumeInput || null,
    onVolumeCommit: callbacks.onVolumeCommit || null,
  };
}

function clampVolume(value, fallback = DEFAULT_VOLUME) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(normalizedValue, 1));
}

function clampPercent(value, fallback = 100) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.round(normalizedValue), 100));
}

function resolvePlayerVolume(value, fallback = DEFAULT_VOLUME) {
  return clampVolume(value, clampVolume(fallback, DEFAULT_VOLUME));
}

function mapPlaybackError(status, errorText = "") {
  if (status === 401) {
    return "Для доступа к видео нужна авторизация.";
  }
  if (status === 403) {
    return "У вас нет доступа к этому видео.";
  }
  if (status === 404) {
    return "Эпизод или поток воспроизведения не найден.";
  }
  if (status === 500) {
    return "Сервер не смог подготовить видео.";
  }

  return errorText || "Не удалось загрузить видео.";
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

function pluralizeEpisodes(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "эпизодов";
  }

  if (lastDigit === 1) {
    return "эпизод";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "эпизода";
  }

  return "эпизодов";
}

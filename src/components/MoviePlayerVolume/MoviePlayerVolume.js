import { BaseComponent } from "@/components/BaseComponent.js";
import "./MoviePlayerVolume.precompiled.js";

export default class MoviePlayerVolumeComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error(
        "MoviePlayerVolume: не передан parent для MoviePlayerVolumeComponent",
      );
    }

    if (!el) {
      throw new Error(
        "MoviePlayerVolume: не передан корневой элемент компонента",
      );
    }

    super(
      buildVolumeContext(context),
      Handlebars.templates["MoviePlayerVolume.hbs"],
      parent,
      el,
    );
  }

  init() {
    this.context = buildVolumeContext(this.context);
    return super.init();
  }

  addEventListeners() {
    this.el
      .querySelector('[data-action="toggle-mute"]')
      ?.addEventListener("click", this._onToggleMuteClick);

    const volumeInput = this.el.querySelector('[data-role="volume-input"]');
    volumeInput?.addEventListener("input", this._onVolumeInput);
    volumeInput?.addEventListener("change", this._onVolumeChange);
  }

  removeEventListeners() {
    this.el
      ?.querySelector('[data-action="toggle-mute"]')
      ?.removeEventListener("click", this._onToggleMuteClick);

    const volumeInput = this.el?.querySelector('[data-role="volume-input"]');
    volumeInput?.removeEventListener("input", this._onVolumeInput);
    volumeInput?.removeEventListener("change", this._onVolumeChange);
  }

  sync(context = {}) {
    this.context = buildVolumeContext({
      ...this.context,
      ...context,
    });

    if (!this.el) {
      return;
    }

    this._updateUI();
  }

  _updateUI() {
    const root = this.el.querySelector('[data-role="volume-root"]');
    const volumeInput = this.el.querySelector('[data-role="volume-input"]');
    const muteButton = this.el.querySelector('[data-action="toggle-mute"]');

    if (!root || !volumeInput || !muteButton) {
      return;
    }

    const volumePercent = clampPercent(
      this.context.volumePercent,
      DEFAULT_VOLUME_PERCENT,
    );

    root.classList.toggle("is-muted", this.context.isMuted);
    root.style.setProperty(
      "--movie-player-volume-percent",
      `${volumePercent}%`,
    );

    muteButton.classList.toggle("is-muted", this.context.isMuted);
    muteButton.setAttribute("aria-label", this.context.buttonLabel);

    if (document.activeElement !== volumeInput) {
      volumeInput.value = String(volumePercent);
    }

    volumeInput.setAttribute("aria-valuenow", String(volumePercent));
    volumeInput.setAttribute("aria-valuetext", this.context.volumeValueText);
  }

  _onToggleMuteClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (typeof this.context.onToggleMute === "function") {
      this.context.onToggleMute();
    }
  };

  _onVolumeInput = (event) => {
    const nextPercent = Number(event.currentTarget?.value);

    if (typeof this.context.onVolumeInput === "function") {
      this.context.onVolumeInput(
        clampPercent(nextPercent, this.context.volumePercent),
      );
    }
  };

  _onVolumeChange = (event) => {
    const nextPercent = Number(event.currentTarget?.value);

    if (typeof this.context.onVolumeCommit === "function") {
      this.context.onVolumeCommit(
        clampPercent(nextPercent, this.context.volumePercent),
      );
    }
  };
}

const DEFAULT_VOLUME_PERCENT = 100;

function buildVolumeContext(context = {}) {
  const volumePercent = clampPercent(
    context.volumePercent,
    DEFAULT_VOLUME_PERCENT,
  );
  const isMuted = Boolean(context.isMuted);

  return {
    ...context,
    isMuted,
    volumePercent,
    buttonLabel:
      context.buttonLabel || (isMuted ? "Включить звук" : "Выключить звук"),
    volumeValueText: `${volumePercent}%`,
  };
}

function clampPercent(value, fallback = DEFAULT_VOLUME_PERCENT) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(Math.round(normalizedValue), 100));
}

// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
const SUPPORT_WIDGET_FRAME_PATH = "/support/new?embed=1";
const SUPPORT_WIDGET_TOAST_DURATION = 4800;
const SUPPORT_WIDGET_EVENTS = {
  closeRequest: "vkino:support-widget-close-request",
  ticketCreated: "vkino:support-ticket-created",
};

export class SupportWidgetController {
  constructor(root, options = {}) {
    this.root = root;
    this.framePath =
      options.framePath || SUPPORT_WIDGET_FRAME_PATH;
    this.toastDuration =
      options.toastDuration || SUPPORT_WIDGET_TOAST_DURATION;
    this._isOpen = false;
    this._toastMessage = "";
    this._toastTone = "";
    this._toastTimeoutId = 0;
  }

  init() {
    if (!this.root) {
      return this;
    }

    this.root.addEventListener("click", this._onClick);
    document.addEventListener("click", this._onDocumentClick);
    document.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("message", this._onSupportFrameMessage);
    this._syncSupportWidget();

    return this;
  }

  destroy() {
    if (this.root) {
      this.root.removeEventListener("click", this._onClick);
    }

    document.removeEventListener("click", this._onDocumentClick);
    document.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("message", this._onSupportFrameMessage);
    window.clearTimeout(this._toastTimeoutId);
  }

  open() {
    this._isOpen = true;
    this._syncSupportWidget();
  }

  close({ restoreFocus = true } = {}) {
    this._isOpen = false;
    this._syncSupportWidget();

    if (restoreFocus) {
      this.root
        ?.querySelector('[data-action="toggle-support-widget"]')
        ?.focus();
    }
  }

  showToast(message, tone = "") {
    window.clearTimeout(this._toastTimeoutId);

    this._toastMessage = String(message || "").trim();
    this._toastTone = this._toastMessage ? tone : "";
    this._syncSupportWidgetToast();

    if (!this._toastMessage) {
      return;
    }

    this._toastTimeoutId = window.setTimeout(() => {
      this._toastMessage = "";
      this._toastTone = "";
      this._syncSupportWidgetToast();
    }, this.toastDuration);
  }

  _onClick = (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget || !this.root?.contains(actionTarget)) {
      return;
    }

    if (actionTarget.dataset.action === "toggle-support-widget") {
      event.preventDefault();

      if (this._isOpen) {
        this.close({ restoreFocus: false });
        return;
      }

      this.open();
      return;
    }

    if (actionTarget.dataset.action === "close-support-widget") {
      event.preventDefault();
      this.close();
    }
  };

  _onDocumentClick = (event) => {
    if (!this._isOpen || !this.root) {
      return;
    }

    const widget = this.root.querySelector('[data-role="support-widget"]');

    if (!widget || widget.contains(event.target)) {
      return;
    }

    this.close({ restoreFocus: false });
  };

  _onKeyDown = (event) => {
    if (event.key !== "Escape" || !this._isOpen) {
      return;
    }

    this.close();
  };

  _onSupportFrameMessage = (event) => {
    if (!this.root || event.origin !== window.location.origin) {
      return;
    }

    const frame = this.root.querySelector('[data-role="support-widget-frame"]');
    const payload =
      event.data && typeof event.data === "object" ? event.data : null;

    if (!frame || event.source !== frame.contentWindow || !payload?.type) {
      return;
    }

    if (payload.type === SUPPORT_WIDGET_EVENTS.closeRequest) {
      this.close();
      return;
    }

    if (payload.type === SUPPORT_WIDGET_EVENTS.ticketCreated) {
      this.close({ restoreFocus: false });
      this.showToast(
        payload.message || "Обращение отправлено в поддержку.",
        "success",
      );
    }
  };

  _syncSupportWidget() {
    if (!this.root) {
      return;
    }

    const widget = this.root.querySelector('[data-role="support-widget"]');
    const panel = this.root.querySelector('[data-role="support-widget-panel"]');
    const trigger = this.root.querySelector(
      '[data-action="toggle-support-widget"]',
    );
    const frame = this.root.querySelector('[data-role="support-widget-frame"]');

    if (!widget || !panel || !trigger || !frame) {
      return;
    }

    widget.classList.toggle("main-support-widget--open", this._isOpen);
    panel.setAttribute("aria-hidden", String(!this._isOpen));
    trigger.setAttribute("aria-expanded", String(this._isOpen));

    if (this._isOpen && !frame.getAttribute("src")) {
      frame.setAttribute("src", frame.dataset.src || this.framePath);
    }

    this._syncSupportWidgetToast();
  }

  _syncSupportWidgetToast() {
    if (!this.root) {
      return;
    }

    const toast = this.root.querySelector('[data-role="support-widget-toast"]');

    if (!toast) {
      return;
    }

    toast.textContent = this._toastMessage || "";
    toast.className = "main-support-widget__toast";

    if (this._toastMessage && this._toastTone) {
      toast.classList.add(`main-support-widget__toast--${this._toastTone}`);
    }
  }
}

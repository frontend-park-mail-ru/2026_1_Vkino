import { BaseComponent } from "@/components/BaseComponent.js";
import "@/components/WatchPartyRoomChat/WatchPartyRoomChat.precompiled.js";

export default class WatchPartyRoomChatComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!parent) {
      throw new Error(
        "WatchPartyRoomChat: не передан parent для WatchPartyRoomChatComponent",
      );
    }

    if (!el) {
      throw new Error(
        "WatchPartyRoomChat: не передан el для WatchPartyRoomChatComponent",
      );
    }

    super(context, Handlebars.templates["WatchPartyRoomChat.hbs"], parent, el);

    this._draft = {
      messageText: "",
      betQuestion: "",
      betOptions: ["", ""],
    };
    this._skipMessageCapture = false;
    this._skipBetComposerCapture = false;
  }

  init() {
    this.context = this._buildContext(this.context);
    super.init();
    this._scrollMessagesToBottom();
    return this;
  }

  refresh(newContext) {
    this._captureDraft();
    return super.refresh(this._buildContext(newContext));
  }

  addBetOption() {
    this._captureDraft();

    if (this._draft.betOptions.length >= 6) {
      return this._draft.betOptions.length;
    }

    this._draft.betOptions.push("");
    this._refreshWithDraft();
    return this._draft.betOptions.length;
  }

  removeBetOption(trigger) {
    this._captureDraft();

    if (this._draft.betOptions.length <= 2) {
      return this._draft.betOptions.length;
    }

    const optionRows = Array.from(
      this.el.querySelectorAll(".watch-room-chat__composer-option"),
    );
    const optionRow = trigger.closest(".watch-room-chat__composer-option");
    const optionIndex = optionRows.indexOf(optionRow);

    if (optionIndex === -1) {
      return this._draft.betOptions.length;
    }

    this._draft.betOptions.splice(optionIndex, 1);
    this._refreshWithDraft();
    return this._draft.betOptions.length;
  }

  clearMessageDraft() {
    this._draft.messageText = "";
    this._skipMessageCapture = true;
  }

  clearBetComposerDraft() {
    this._draft.betQuestion = "";
    this._draft.betOptions = ["", ""];
    this._skipBetComposerCapture = true;
  }

  _refreshWithDraft() {
    super.refresh(this._buildContext(this.context));
  }

  _buildContext(context = {}) {
    const betOptions = normalizeBetOptions(this._draft.betOptions);

    this._draft.betOptions = betOptions.map((option) => option.value);

    return {
      ...context,
      messageText: this._draft.messageText,
      betQuestion: this._draft.betQuestion,
      canAddBetOption: betOptions.length < 6,
      roomBetComposerOptions: betOptions.map((option, index) => ({
        ...option,
        index: index + 1,
        canRemove: betOptions.length > 2,
      })),
    };
  }

  _captureDraft() {
    if (!this.el) {
      return;
    }

    const messageInput = this.el.querySelector(
      '.watch-room-chat__form input[name="message"]',
    );

    if (this._skipMessageCapture) {
      this._skipMessageCapture = false;
    } else if (messageInput) {
      this._draft.messageText = messageInput.value;
    }

    const betForm = this.el.querySelector('[data-action="create-bet"]');

    if (!betForm || this._skipBetComposerCapture) {
      this._skipBetComposerCapture = false;
      return;
    }

    const questionInput = betForm.querySelector('input[name="question"]');
    const optionInputs = Array.from(
      betForm.querySelectorAll('input[name="option"]'),
    );

    this._draft.betQuestion = questionInput?.value || "";
    this._draft.betOptions = normalizeBetOptions(
      optionInputs.map((input) => input.value),
    ).map((option) => option.value);
  }

  _scrollMessagesToBottom() {
    const messages = this.el?.querySelector(".watch-room-chat__messages");

    if (!messages) {
      return;
    }

    messages.scrollTop = messages.scrollHeight;
  }
}

function normalizeBetOptions(options) {
  const normalizedOptions = Array.isArray(options) ? options.slice(0, 6) : [];

  while (normalizedOptions.length < 2) {
    normalizedOptions.push("");
  }

  return normalizedOptions.map((value) => ({
    value: String(value || ""),
  }));
}

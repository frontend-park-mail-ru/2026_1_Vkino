import BasePage from "@/pages/BasePage.js";
import "@/pages/WatchParty/WatchParty.precompiled.js";
import "@/css/watch-party.scss";

import HeaderComponent from "@/components/Header/Header.js";
import MoviePlayerComponent from "@/components/MoviePlayer/MoviePlayer.js";
import WatchPartyRoomChatComponent from "@/components/WatchPartyRoomChat/WatchPartyRoomChat.js";
import {
  buildWatchPartyFallbackOverview,
  buildWatchPartyFallbackRoom,
  buildWatchPartyRoomPath,
  deleteLocalWatchPartyRoom,
  listLocalWatchPartyRooms,
  saveLocalWatchPartyRoom,
  watchPartyService,
} from "@/js/WatchPartyService.js";
import {
  extractWatchPartyOverview,
  extractWatchPartyRoom,
} from "@/utils/apiResponse.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getDisplayNameFromEmail } from "@/utils/user.js";

const HERO_COPY = {
  heroEyebrow: "Совместный просмотр",
  heroTitle: "Смотрите вместе с друзьями",
  heroSubtitle: "Одна комната, один таймлайн, одни эмоции.",
  heroDescription:
    "Создайте комнату, настройте доступ и переходите в комнату проекта без отдельного шаблона.",
};

export default class WatchPartyPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "WatchPartyPage: не передан корневой элемент для WatchPartyPage",
      );
    }

    const routeState = readWatchPartyRouteState(window.location.pathname);
    const mode = routeState.isRoomView ? "room" : "lobby";
    const overviewData = buildWatchPartyFallbackOverview();
    const roomData = buildWatchPartyFallbackRoom(routeState.roomId);
    const uiState =
      mode === "room"
        ? createInitialRoomUiState()
        : createInitialLobbyUiState();

    super(
      {
        ...context,
        ...buildPageContext({
          mode,
          overviewData,
          roomData,
          uiState,
        }),
      },
      Handlebars.templates["WatchParty.hbs"],
      parent,
      el,
      "WatchPartyPage",
    );

    this._routeState = routeState;
    this._mode = mode;
    this._contextLoaded = false;
    this._overviewData = overviewData;
    this._roomData = roomData;
    this._uiState = uiState;
    this._nextRoomIndex = listLocalWatchPartyRooms().length + 1;
    this._roomPlayerSnapshot = null;
  }

  init() {
    super.init();

    if (!this._contextLoaded) {
      this.loadContext();
    }

    return this;
  }

  async loadContext({ showLoading = false } = {}) {
    if (this._mode === "room") {
      return this._loadRoomContext({ showLoading });
    }

    return this._loadLobbyContext({ showLoading });
  }

  addEventListeners() {
    this.el.addEventListener("click", this._onClick);
    this.el.addEventListener("submit", this._onSubmit);

    if (
      this._mode === "room" &&
      !this._uiState.loading &&
      !this._uiState.hasError
    ) {
      this._syncRoomPlayer();
    }
  }

  removeEventListeners() {
    if (!this.el) {
      return;
    }

    this.el.removeEventListener("click", this._onClick);
    this.el.removeEventListener("submit", this._onSubmit);
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "WatchPartyPage: не найден header в шаблоне WatchParty.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));

    if (
      this._mode === "room" &&
      !this._uiState.loading &&
      !this._uiState.hasError
    ) {
      this._setupRoomPlayer();
      this._setupRoomChat();
    }
  }

  _onClick = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    switch (actionTarget.dataset.action) {
      case "retry-overview":
        event.preventDefault();
        await this.loadContext({ showLoading: true });
        break;
      case "scroll-to-section":
        event.preventDefault();
        this._scrollToSection(actionTarget.dataset.target);
        break;
      case "copy-link":
      case "copy-room-link":
        event.preventDefault();
        await this._copyRoomLink(actionTarget.dataset.link || "");
        break;
      case "delete-room":
        event.preventDefault();
        await this._deleteRoom(
          actionTarget.dataset.roomId || "",
          actionTarget.dataset.roomTitle || "Комната",
        );
        break;
      case "join-featured-room":
      case "open-my-room":
        event.preventDefault();
        this._openRoom(actionTarget.dataset.roomId || "");
        break;
      case "watch-party-back":
        event.preventDefault();
        router.go("/watch-party");
        break;
      case "open-room-members":
        event.preventDefault();
        this._setRoomPanel("members");
        break;
      case "open-room-chat":
        event.preventDefault();
        this._setRoomPanel("chat");
        break;
      case "close-room-panel":
        event.preventDefault();
        this._setRoomPanel("");
        break;
      case "toggle-bet-composer":
        event.preventDefault();
        this._toggleBetComposer();
        break;
      case "close-bet-composer":
        event.preventDefault();
        this._clearRoomChatBetComposerDraft();
        this._refreshRoomChat({
          isBetComposerOpen: false,
          betComposerOptionCount: 2,
        });
        break;
      case "add-bet-option":
        event.preventDefault();
        this._addBetOption(actionTarget);
        break;
      case "remove-bet-option":
        event.preventDefault();
        this._removeBetOption(actionTarget);
        break;
      case "select-bet-option":
        event.preventDefault();
        this._selectBetOption(
          actionTarget.dataset.messageId || "",
          actionTarget.dataset.optionId || "",
        );
        break;
      default:
        break;
    }
  };

  _onSubmit = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    switch (actionTarget.dataset.action) {
      case "create-room":
        event.preventDefault();
        await this._handleCreateRoom(actionTarget);
        break;
      case "join-room":
        event.preventDefault();
        await this._handleJoinRoom(actionTarget);
        break;
      case "send-chat-message":
        event.preventDefault();
        this._handleSendChatMessage(actionTarget);
        break;
      case "create-bet":
        event.preventDefault();
        this._handleCreateBet(actionTarget);
        break;
      default:
        break;
    }
  };

  async _loadLobbyContext({ showLoading = false } = {}) {
    if (showLoading) {
      this._refreshView({
        isLoading: true,
        errorMessage: "",
      });
    }

    const fallbackData = buildWatchPartyFallbackOverview();
    const { ok, status, resp, error } = await watchPartyService.getOverview();

    if (!ok) {
      console.error("WatchPartyPage: не удалось загрузить overview", {
        status,
        error,
        resp,
      });
    }

    const localRooms = listLocalWatchPartyRooms();

    this._overviewData = mergeOverviewWithLocalRooms(
      mapOverviewToPageData(
        ok ? extractWatchPartyOverview(resp) : {},
        fallbackData,
      ),
      localRooms,
      fallbackData,
    );
    this._contextLoaded = true;
    this._syncNextRoomIndex();

    this._refreshView({
      isLoading: false,
      errorMessage: ok
        ? ""
        : "Не удалось загрузить данные с сервера. Показаны локальные комнаты и fallback-сценарий.",
    });
  }

  async _loadRoomContext({ showLoading = false } = {}) {
    const roomId = this._routeState.roomId;

    if (!roomId) {
      this._contextLoaded = true;
      this._refreshView({
        loading: false,
        hasError: true,
        errorTitle: "Комната не найдена",
        errorText: "В адресе отсутствует идентификатор комнаты.",
      });
      return;
    }

    if (showLoading) {
      this._refreshView({
        loading: true,
        hasError: false,
        errorTitle: "",
        errorText: "",
      });
    }

    const fallbackRoom = buildWatchPartyFallbackRoom(roomId);
    const viewer = buildCurrentViewer();
    const result = await watchPartyService.getRoom(roomId);

    if (!result.ok) {
      console.error("WatchPartyPage: не удалось загрузить комнату", {
        roomId,
        status: result.status,
        error: result.error,
        resp: result.resp,
      });
    }

    this._roomData = applyViewerToRoom(
      mapRoomDtoToViewModel(
        result.ok ? extractWatchPartyRoom(result.resp) || result.resp : {},
        fallbackRoom,
        viewer,
      ),
      viewer,
    );
    saveLocalWatchPartyRoom(this._roomData);
    this._contextLoaded = true;

    this._refreshView({
      loading: false,
      hasError: false,
      errorTitle: "",
      errorText: "",
      roomStatusMessage: result.ok
        ? ""
        : "Серверное состояние комнаты пока недоступно. Показана локальная версия страницы.",
      roomStatusTone: result.ok ? "info" : "warning",
    });
  }

  async _handleCreateRoom(form) {
    const formData = new FormData(form);
    const roomName = normalizeText(formData.get("roomName"));
    const visibility = normalizeText(formData.get("visibility"));

    if (!roomName) {
      this._setLobbyStatus(
        "Введите название комнаты, чтобы продолжить.",
        "error",
      );
      return;
    }

    const visibilityLabel = resolveVisibilityLabel(
      visibility,
      this._overviewData.visibilityOptions,
    );
    const viewer = buildCurrentViewer();
    const localRoomId = String(this._nextRoomIndex);
    const fallbackRoom = createLocalRoomDraft({
      roomId: localRoomId,
      roomName,
      visibilityLabel,
      viewer,
    });

    const result = await watchPartyService.createRoom({
      name: roomName,
      visibility,
    });
    const nextRoom = mapRoomDtoToViewModel(
      result.ok ? extractWatchPartyRoom(result.resp) || result.resp : {},
      fallbackRoom,
      viewer,
    );

    saveLocalWatchPartyRoom(nextRoom);
    this._syncNextRoomIndex();
    router.go(buildWatchPartyRoomPath(nextRoom.id));
  }

  async _handleJoinRoom(form) {
    const formData = new FormData(form);
    const inviteLink = normalizeText(formData.get("inviteLink"));

    if (!inviteLink) {
      this._setLobbyStatus(
        "Добавьте ссылку-приглашение для входа в комнату.",
        "error",
      );
      return;
    }

    const roomIdFromLink = extractRoomIdFromLink(inviteLink);
    const result = await watchPartyService.joinRoom({
      invite_link: inviteLink,
    });
    const joinedRoomPayload = extractWatchPartyRoom(result.resp) || result.resp;
    const joinedRoomId = normalizeText(
      joinedRoomPayload?.id ||
        joinedRoomPayload?.roomId ||
        joinedRoomPayload?.room_id ||
        roomIdFromLink,
    );

    if (!joinedRoomId) {
      this._setLobbyStatus(
        "Не удалось определить комнату по ссылке. Проверьте формат приглашения.",
        "error",
      );
      return;
    }

    const viewer = buildCurrentViewer();
    const nextRoom = mapRoomDtoToViewModel(
      joinedRoomPayload,
      buildWatchPartyFallbackRoom(joinedRoomId),
      viewer,
    );

    saveLocalWatchPartyRoom(nextRoom);
    router.go(buildWatchPartyRoomPath(nextRoom.id));
  }

  _handleSendChatMessage(form) {
    if (this._mode !== "room") {
      return;
    }

    const formData = new FormData(form);
    const messageText = normalizeText(formData.get("message"));

    if (!messageText) {
      this._setRoomStatus("Введите сообщение перед отправкой.", "warning");
      return;
    }

    const viewer = this._roomData.viewer;
    const nextMessages = [
      ...this._roomData.messages,
      {
        id: `message-${Date.now()}`,
        isBet: false,
        authorName: viewer.name,
        authorInitial: viewer.initial,
        authorTint: viewer.avatarTint,
        timeLabel: formatTimeLabel(),
        text: messageText,
        reactionText: "",
      },
    ];

    this._roomData = {
      ...this._roomData,
      messages: nextMessages,
    };
    saveLocalWatchPartyRoom(this._roomData);
    this._clearRoomChatMessageDraft();
    this._refreshRoomChat({
      activePanel: "chat",
      roomStatusMessage: "",
    });
  }

  _handleCreateBet(form) {
    if (this._mode !== "room") {
      return;
    }

    const formData = new FormData(form);
    const question = normalizeText(formData.get("question"));
    const options = formData
      .getAll("option")
      .map((item) => normalizeText(item))
      .filter(Boolean);

    if (!question || options.length < 2) {
      this._setRoomStatus(
        "Для ставки нужны вопрос и минимум два варианта.",
        "warning",
      );
      return;
    }

    const viewer = this._roomData.viewer;
    const betId = `bet-${Date.now()}`;
    const nextMessages = [
      ...this._roomData.messages,
      {
        id: betId,
        isBet: true,
        authorName: viewer.name,
        authorInitial: viewer.initial,
        authorTint: viewer.avatarTint,
        timeLabel: formatTimeLabel(),
        question,
        metaText: `Создали ${viewer.name} · 0 голосов`,
        voteCount: 0,
        selectionText: "Голосование открыто",
        options: options.map((optionLabel, index) => ({
          id: `${betId}-option-${index + 1}`,
          label: optionLabel,
          votes: 0,
          isSelected: false,
        })),
      },
    ];

    this._roomData = {
      ...this._roomData,
      messages: nextMessages,
    };
    saveLocalWatchPartyRoom(this._roomData);
    this._clearRoomChatBetComposerDraft();
    this._refreshRoomChat({
      activePanel: "chat",
      isBetComposerOpen: false,
      betComposerOptionCount: 2,
      roomStatusMessage: "Ставка добавлена в чат.",
      roomStatusTone: "success",
    });
  }

  _togglePlayback() {
    if (this._mode !== "room") {
      return;
    }
  }

  _toggleBetComposer() {
    if (this._mode !== "room") {
      return;
    }

    if (this._uiState.isBetComposerOpen) {
      this._clearRoomChatBetComposerDraft();
    }

    this._refreshRoomChat({
      activePanel: "chat",
      isBetComposerOpen: !this._uiState.isBetComposerOpen,
      betComposerOptionCount: this._uiState.isBetComposerOpen
        ? 2
        : this._uiState.betComposerOptionCount,
    });
  }

  _addBetOption() {
    if (this._mode !== "room") {
      return;
    }

    const chat = this.getChild("watch-party-room-chat");

    if (!chat) {
      return;
    }

    const nextOptionsCount = chat.addBetOption();

    this._uiState = {
      ...this._uiState,
      betComposerOptionCount: nextOptionsCount,
    };
  }

  _removeBetOption(trigger) {
    if (this._mode !== "room") {
      return;
    }

    const chat = this.getChild("watch-party-room-chat");

    if (!chat) {
      return;
    }

    const nextOptionsCount = chat.removeBetOption(trigger);

    this._uiState = {
      ...this._uiState,
      betComposerOptionCount: nextOptionsCount,
    };
  }

  _selectBetOption(messageId, optionId) {
    if (this._mode !== "room") {
      return;
    }

    const normalizedMessageId = normalizeText(messageId);
    const normalizedOptionId = normalizeText(optionId);

    if (!normalizedMessageId || !normalizedOptionId) {
      return;
    }

    let didVote = false;

    const nextMessages = this._roomData.messages.map((message) => {
      if (!message.isBet || message.id !== normalizedMessageId) {
        return message;
      }

      const nextOptions = message.options.map((option) => ({
        ...option,
      }));
      const previousSelectedOption = nextOptions.find(
        (option) => option.isSelected,
      );

      if (previousSelectedOption) {
        return message;
      }

      const nextSelectedOption = nextOptions.find((option) => {
        return option.id === normalizedOptionId;
      });

      if (!nextSelectedOption) {
        return message;
      }

      nextSelectedOption.votes = normalizeCount(nextSelectedOption.votes) + 1;
      didVote = true;

      nextOptions.forEach((option) => {
        option.isSelected = option.id === normalizedOptionId;
      });

      const voteCountBase = normalizeCount(message.voteCount);
      const optionsVoteCount = sumOptionVotes(nextOptions);
      const nextVoteCount = Math.max(voteCountBase + 1, optionsVoteCount);

      return {
        ...message,
        voteCount: nextVoteCount,
        selectionText: `Ваш выбор: ${nextSelectedOption.label}`,
        options: nextOptions,
      };
    });

    if (!didVote) {
      return;
    }

    this._roomData = {
      ...this._roomData,
      messages: nextMessages,
    };
    saveLocalWatchPartyRoom(this._roomData);
    this._refreshRoomChat({
      activePanel: "chat",
      roomStatusMessage: "Голос в ставке принят.",
      roomStatusTone: "success",
    });
  }

  async _copyRoomLink(link) {
    const normalizedLink = absolutizeRoomLink(link);

    if (!normalizedLink) {
      if (this._mode === "room") {
        this._setRoomStatus(
          "Не удалось получить ссылку для копирования.",
          "error",
        );
      } else {
        this._setLobbyStatus(
          "Не удалось получить ссылку для копирования.",
          "error",
        );
      }
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        this._setCopyFallbackStatus(normalizedLink);
        return;
      }

      await navigator.clipboard.writeText(normalizedLink);
      this._setCopySuccessStatus();
    } catch {
      this._setCopyFallbackStatus(normalizedLink);
    }
  }

  async _deleteRoom(roomId, roomTitle) {
    const normalizedRoomId = normalizeText(roomId);

    if (!normalizedRoomId) {
      this._setLobbyStatus("Комната уже удалена или недоступна.", "error");
      return;
    }

    const result = await watchPartyService.deleteRoom(normalizedRoomId);
    deleteLocalWatchPartyRoom(normalizedRoomId);

    this._overviewData = mergeOverviewWithLocalRooms(
      removeRoomFromOverview(this._overviewData, normalizedRoomId),
      listLocalWatchPartyRooms(),
      buildWatchPartyFallbackOverview(),
    );
    this._syncNextRoomIndex();
    this._refreshView({
      statusMessage: result.ok
        ? `Комната «${roomTitle}» удалена.`
        : "Комната удалена локально. Серверная ручка ещё не подтверждена.",
      statusTone: result.ok ? "success" : "info",
    });
  }

  _openRoom(roomId) {
    const normalizedRoomId = normalizeText(roomId);

    if (!normalizedRoomId) {
      this._setLobbyStatus(
        "Не удалось определить комнату для перехода.",
        "error",
      );
      return;
    }

    router.go(buildWatchPartyRoomPath(normalizedRoomId));
  }

  _setRoomPanel(panel) {
    if (this._mode !== "room") {
      return;
    }

    this._uiState = {
      ...this._uiState,
      activePanel: panel,
    };
    this._applyRoomPanelState(panel);
  }

  _applyRoomPanelState(panel) {
    const normalizedPanel =
      panel === "members" || panel === "chat" ? panel : "";
    const isOpen = Boolean(normalizedPanel);

    this.el
      .querySelector(".watch-room-drawer__backdrop")
      ?.classList.toggle("is-visible", isOpen);
    this.el
      .querySelector(".watch-room-drawer")
      ?.classList.toggle("is-open", isOpen);

    this.el
      .querySelectorAll('[data-action="open-room-members"]')
      .forEach((node) => {
        node.classList.toggle("is-active", normalizedPanel === "members");
      });

    this.el
      .querySelectorAll('[data-action="open-room-chat"]')
      .forEach((node) => {
        node.classList.toggle("is-active", normalizedPanel === "chat");
      });

    this.el.querySelectorAll(".watch-room-drawer__panel").forEach((node) => {
      const isActive =
        (normalizedPanel === "members" &&
          node.classList.contains("watch-room-members")) ||
        (normalizedPanel === "chat" &&
          node.classList.contains("watch-room-chat"));

      node.classList.toggle("is-active", isActive);
      node.hidden = !isActive;
      node.setAttribute("aria-hidden", String(!isActive));
    });
  }

  _setLobbyStatus(message, tone) {
    this._refreshView({
      statusMessage: message,
      statusTone: tone,
    });
  }

  _setRoomStatus(message, tone) {
    if (this._mode === "room") {
      this._refreshRoomChrome({
        roomStatusMessage: message,
        roomStatusTone: tone,
      });
      return;
    }

    this._refreshView({
      roomStatusMessage: message,
      roomStatusTone: tone,
    });
  }

  _setCopySuccessStatus() {
    if (this._mode === "room") {
      this._setRoomStatus("Ссылка на комнату скопирована.", "success");
      return;
    }

    this._setLobbyStatus("Ссылка на комнату скопирована.", "success");
  }

  _setCopyFallbackStatus(link) {
    if (this._mode === "room") {
      this._setRoomStatus(`Скопируйте ссылку вручную: ${link}`, "info");
      return;
    }

    this._setLobbyStatus(`Скопируйте ссылку вручную: ${link}`, "info");
  }

  _scrollToSection(targetId) {
    const section = this.el.querySelector(`#${targetId}`);

    section?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  _refreshView(overrides = {}) {
    if (this._mode === "room") {
      this._captureRoomPlayerSnapshot();
    }

    this._uiState = {
      ...this._uiState,
      ...overrides,
    };

    this.refresh(
      buildPageContext({
        mode: this._mode,
        overviewData: this._overviewData,
        roomData: this._roomData,
        uiState: this._uiState,
      }),
    );
  }

  _refreshRoomChat(overrides = {}) {
    if (this._mode !== "room") {
      return;
    }

    this._refreshRoomChrome(overrides);

    const chat = this.getChild("watch-party-room-chat");

    if (!chat) {
      return;
    }

    chat.refresh(buildRoomChatContext(this._roomData, this._uiState));
  }

  _clearRoomChatMessageDraft() {
    this.getChild("watch-party-room-chat")?.clearMessageDraft();
  }

  _clearRoomChatBetComposerDraft() {
    this.getChild("watch-party-room-chat")?.clearBetComposerDraft();
  }

  _refreshRoomChrome(overrides = {}) {
    if (this._mode !== "room") {
      return;
    }

    this._uiState = {
      ...this._uiState,
      ...overrides,
    };

    if (Object.prototype.hasOwnProperty.call(overrides, "activePanel")) {
      this._applyRoomPanelState(this._uiState.activePanel);
    }

    this._syncRoomStatus();
  }

  _syncRoomStatus() {
    const statusNode = this.el.querySelector(
      "[data-role='watch-party-room-status']",
    );

    if (!statusNode) {
      return;
    }

    const message = this._uiState.roomStatusMessage || "";
    const tone = this._uiState.roomStatusTone || "info";

    statusNode.textContent = message;
    statusNode.hidden = !message;
    statusNode.className = `watch-room-shell__status watch-room-shell__status_${tone}`;
  }

  _syncNextRoomIndex() {
    const rooms = listLocalWatchPartyRooms();
    const maxId = rooms.reduce((accumulator, room) => {
      const numericId = Number.parseInt(normalizeText(room.id), 10);

      if (!Number.isFinite(numericId)) {
        return accumulator;
      }

      return Math.max(accumulator, numericId);
    }, 0);

    this._nextRoomIndex = maxId + 1;
  }

  _setupRoomPlayer() {
    const playerRoot = this.el.querySelector("#watch-party-room-player");

    if (!playerRoot) {
      return;
    }

    this.addChild(
      "watch-party-room-player",
      new MoviePlayerComponent(
        {
          isEmbedded: true,
          showTopbar: false,
          showCloseButton: false,
          showSeekControls: false,
          showMuteControl: true,
          showFullscreenControl: true,
          showChatControl: true,
          fullscreenTargetSelector: ".watch-room-shell",
          onChatRequested: () => this._setRoomPanel("chat"),
        },
        this,
        playerRoot,
      ),
    );
  }

  _setupRoomChat() {
    const chatRoot = this.el.querySelector("#watch-party-room-chat");

    if (!chatRoot) {
      return;
    }

    this.addChild(
      "watch-party-room-chat",
      new WatchPartyRoomChatComponent(
        buildRoomChatContext(this._roomData, this._uiState),
        this,
        chatRoot,
      ),
    );
  }

  _captureRoomPlayerSnapshot() {
    const player = this.getChild("watch-party-room-player");

    if (!player) {
      return;
    }

    this._roomPlayerSnapshot = player.getPlaybackState();
  }

  async _syncRoomPlayer() {
    const player = this.getChild("watch-party-room-player");

    if (!player) {
      return;
    }

    const playerMovie = buildRoomPlayerMovieData(this._roomData);

    if (!playerMovie) {
      return;
    }

    const snapshot = this._roomPlayerSnapshot;

    await player.open(
      playerMovie,
      snapshot?.activeEpisodeId || playerMovie.initialEpisodeId,
      {
        autoplay: Boolean(snapshot?.isPlaying),
        restoreProgress: !playerMovie.isDirectPlayback,
        startAtSeconds: snapshot?.currentTime || 0,
      },
    );

    player.restoreAudioState({
      volumePercent: snapshot?.volumePercent,
      isMuted: snapshot?.isMuted,
    });
  }
}

function buildPageContext({ mode, overviewData, roomData, uiState }) {
  if (mode === "room") {
    return buildRoomContext(roomData, uiState);
  }

  return buildLobbyContext(overviewData, uiState);
}

function buildLobbyContext(pageData, uiState) {
  return {
    ...HERO_COPY,
    isRoomView: false,
    isLoading: Boolean(uiState.isLoading),
    errorMessage: uiState.errorMessage || "",
    statusMessage: uiState.statusMessage || "",
    statusTone: uiState.statusTone || "info",
    featuredRoomsOnlineLabel: `${pageData.featuredRooms.length} ${pluralizeRooms(pageData.featuredRooms.length)} онлайн`,
    featuredRoomsUnavailableText:
      "Невозможно получить данные о комнатах прямо сейчас.",
    myRoomsCountLabel: `${pageData.myRooms.length} ${pluralizeRooms(pageData.myRooms.length)}`,
    heroPosters: pageData.heroPosters,
    visibilityOptions: pageData.visibilityOptions,
    featuredRooms: pageData.featuredRooms,
    myRooms: pageData.myRooms,
  };
}

function buildRoomContext(roomData, uiState) {
  const chatContext = buildRoomChatContext(roomData, uiState);

  return {
    isRoomView: true,
    loading: Boolean(uiState.loading),
    hasError: Boolean(uiState.hasError),
    errorTitle: uiState.errorTitle || "",
    errorText: uiState.errorText || "",
    roomStatusMessage: uiState.roomStatusMessage || "",
    roomStatusTone: uiState.roomStatusTone || "info",
    isRoomPanelOpen: Boolean(uiState.activePanel),
    isMembersPanel: uiState.activePanel === "members",
    isChatPanel: uiState.activePanel === "chat",
    roomName: roomData.roomName,
    movieTitle: roomData.movie.title,
    progressLabel: roomData.progressLabel,
    participantsLabel: roomData.participantsLabel,
    privacyLabel: roomData.privacyLabel,
    inviteLink: absolutizeRoomLink(roomData.inviteLink),
    hostName: roomData.hostName,
    liveLabel: roomData.liveLabel,
    viewer: roomData.viewer,
    movie: roomData.movie,
    roomMembersCount: roomData.members.length,
    roomMessagesCount: chatContext.roomMessages.length,
    members: roomData.members,
    roomNote: roomData.roomNote,
  };
}

function buildRoomChatContext(roomData, uiState) {
  return {
    isBetComposerOpen: Boolean(uiState.isBetComposerOpen),
    roomBetComposerOptions: buildComposerOptions(
      uiState.betComposerOptionCount,
    ),
    roomMessages: roomData.messages.map((message) => {
      return decorateRoomMessage(message);
    }),
  };
}

function buildRoomPlayerMovieData(roomData = {}) {
  const movieTitle = normalizeText(roomData.movie?.title) || "Видео";
  const playerSource = roomData.playerSource || {};
  const episodeId =
    normalizeText(playerSource.episodeId || playerSource.id) || "";
  const playbackUrl = normalizeText(playerSource.playbackUrl);
  const posterUrl =
    normalizeText(playerSource.posterUrl) ||
    normalizeText(roomData.movie?.backdropUrl) ||
    "/img/cards/interstellar.webp";

  return {
    id: normalizeText(playerSource.movieId || roomData.id) || roomData.id,
    title: movieTitle,
    description:
      normalizeText(playerSource.description) ||
      normalizeText(roomData.movie?.subtitle) ||
      roomData.roomNote,
    contentType: "watch-party",
    posterUrl,
    isDirectPlayback: !episodeId || Boolean(playbackUrl),
    initialEpisodeId:
      episodeId || `watch-party-${normalizeText(roomData.id) || "room"}`,
    episodes: [
      {
        id: episodeId || `watch-party-${normalizeText(roomData.id) || "room"}`,
        title: normalizeText(playerSource.episodeTitle) || movieTitle,
        description:
          normalizeText(playerSource.description) ||
          normalizeText(roomData.movie?.subtitle),
        durationSeconds: normalizeCount(
          playerSource.durationSeconds ?? playerSource.duration_seconds,
        ),
        imgUrl: posterUrl,
        playbackUrl,
        playbackPositionSeconds: normalizeCount(
          playerSource.positionSeconds ?? playerSource.position_seconds,
        ),
        isDirectPlayback: !episodeId || Boolean(playbackUrl),
      },
    ],
  };
}

function mapOverviewToPageData(overview, fallbackData) {
  const normalizedOverview =
    overview && typeof overview === "object" && !Array.isArray(overview)
      ? overview
      : {};

  return {
    heroPosters: mapHeroPosters(
      readArray(normalizedOverview, ["heroPosters", "hero_posters", "posters"]),
      fallbackData.heroPosters,
    ),
    visibilityOptions: mapVisibilityOptions(
      readArray(normalizedOverview, [
        "visibilityOptions",
        "visibility_options",
        "roomVisibilityOptions",
        "room_visibility_options",
      ]),
      fallbackData.visibilityOptions,
    ),
    featuredRooms: mapFeaturedRooms(
      readArray(normalizedOverview, [
        "featuredRooms",
        "featured_rooms",
        "onlineRooms",
        "online_rooms",
        "rooms",
      ]),
      fallbackData.featuredRooms,
    ),
    myRooms: mapMyRooms(
      readArray(normalizedOverview, [
        "myRooms",
        "my_rooms",
        "ownedRooms",
        "owned_rooms",
      ]),
    ),
  };
}

function mapRoomDtoToViewModel(roomDto, fallbackRoom, viewer) {
  const normalizedRoomDto =
    roomDto && typeof roomDto === "object" && !Array.isArray(roomDto)
      ? roomDto
      : {};

  const participantsCount = normalizeCount(
    normalizedRoomDto.participantsCount ??
      normalizedRoomDto.participants_count ??
      normalizedRoomDto.membersCount ??
      normalizedRoomDto.members_count ??
      normalizedRoomDto.viewersCount ??
      normalizedRoomDto.viewers_count ??
      fallbackRoom.participantsCount,
  );

  const mappedRoom = {
    id:
      normalizeText(
        normalizedRoomDto.id ||
          normalizedRoomDto.roomId ||
          normalizedRoomDto.room_id,
      ) || fallbackRoom.id,
    roomName:
      normalizeText(normalizedRoomDto.name || normalizedRoomDto.title) ||
      fallbackRoom.roomName,
    participantsCount,
    participantsLabel: `${participantsCount} ${pluralizeParticipants(participantsCount)}`,
    progressLabel:
      normalizeText(
        normalizedRoomDto.progressLabel ||
          normalizedRoomDto.progress_label ||
          normalizedRoomDto.currentTimeLabel ||
          normalizedRoomDto.current_time_label,
      ) || fallbackRoom.progressLabel,
    liveLabel: resolveLiveLabel(
      normalizedRoomDto.liveLabel ??
        normalizedRoomDto.live ??
        normalizedRoomDto.status,
      fallbackRoom.liveLabel,
    ),
    privacyLabel:
      normalizeText(
        normalizedRoomDto.privacyLabel ||
          normalizedRoomDto.privacy_label ||
          normalizedRoomDto.visibilityLabel ||
          normalizedRoomDto.visibility_label,
      ) || fallbackRoom.privacyLabel,
    inviteLink:
      normalizeText(
        normalizedRoomDto.inviteLink ||
          normalizedRoomDto.invite_link ||
          normalizedRoomDto.roomLink ||
          normalizedRoomDto.room_link,
      ) || fallbackRoom.inviteLink,
    hostName:
      normalizeText(
        normalizedRoomDto.hostName ||
          normalizedRoomDto.host_name ||
          normalizedRoomDto.ownerName ||
          normalizedRoomDto.owner_name,
      ) || fallbackRoom.hostName,
    roomNote:
      normalizeText(
        normalizedRoomDto.roomNote || normalizedRoomDto.room_note,
      ) || fallbackRoom.roomNote,
    movie: {
      ...fallbackRoom.movie,
      title:
        normalizeText(
          normalizedRoomDto.movie?.title ||
            normalizedRoomDto.movie_title ||
            normalizedRoomDto.movieName ||
            normalizedRoomDto.movie_name,
        ) || fallbackRoom.movie.title,
      year:
        normalizeText(
          normalizedRoomDto.movie?.year || normalizedRoomDto.movie_year,
        ) || fallbackRoom.movie.year,
      subtitle:
        normalizeText(
          normalizedRoomDto.movie?.subtitle || normalizedRoomDto.movie_subtitle,
        ) || fallbackRoom.movie.subtitle,
      backdropUrl:
        normalizeText(
          normalizedRoomDto.movie?.backdropUrl ||
            normalizedRoomDto.movie?.posterUrl ||
            normalizedRoomDto.movie_backdrop_url ||
            normalizedRoomDto.movie_poster_url,
        ) || fallbackRoom.movie.backdropUrl,
    },
    player: {
      ...fallbackRoom.player,
      isPlaying: Boolean(
        normalizedRoomDto.player?.isPlaying ??
        normalizedRoomDto.player?.playing ??
        fallbackRoom.player.isPlaying,
      ),
      progressPercent: clampPercent(
        normalizedRoomDto.player?.progressPercent ??
          normalizedRoomDto.player?.progress_percent ??
          normalizedRoomDto.progressPercent ??
          fallbackRoom.player.progressPercent,
      ),
      currentTimeLabel:
        normalizeText(
          normalizedRoomDto.player?.currentTimeLabel ||
            normalizedRoomDto.player?.current_time_label ||
            normalizedRoomDto.currentTimeLabel ||
            normalizedRoomDto.current_time_label,
        ) || fallbackRoom.player.currentTimeLabel,
      totalTimeLabel:
        normalizeText(
          normalizedRoomDto.player?.totalTimeLabel ||
            normalizedRoomDto.player?.total_time_label ||
            normalizedRoomDto.totalTimeLabel ||
            normalizedRoomDto.total_time_label,
        ) || fallbackRoom.player.totalTimeLabel,
      volumePercent: clampPercent(
        normalizedRoomDto.player?.volumePercent ??
          normalizedRoomDto.player?.volume_percent ??
          fallbackRoom.player.volumePercent,
      ),
      qualityLabel:
        normalizeText(
          normalizedRoomDto.player?.qualityLabel ||
            normalizedRoomDto.player?.quality_label,
        ) || fallbackRoom.player.qualityLabel,
      syncLabel:
        normalizeText(
          normalizedRoomDto.player?.syncLabel ||
            normalizedRoomDto.player?.sync_label,
        ) || fallbackRoom.player.syncLabel,
    },
    playerSource: {
      ...(fallbackRoom.playerSource || {}),
      movieId:
        normalizeText(
          normalizedRoomDto.movie?.id ||
            normalizedRoomDto.movie_id ||
            normalizedRoomDto.movieId,
        ) || normalizeText(fallbackRoom.playerSource?.movieId),
      episodeId:
        normalizeText(
          normalizedRoomDto.player?.episodeId ||
            normalizedRoomDto.player?.episode_id ||
            normalizedRoomDto.episodeId ||
            normalizedRoomDto.episode_id,
        ) || normalizeText(fallbackRoom.playerSource?.episodeId),
      playbackUrl:
        normalizeText(
          normalizedRoomDto.player?.playbackUrl ||
            normalizedRoomDto.player?.playback_url ||
            normalizedRoomDto.playbackUrl ||
            normalizedRoomDto.playback_url,
        ) || normalizeText(fallbackRoom.playerSource?.playbackUrl),
      durationSeconds:
        Number(
          normalizedRoomDto.player?.durationSeconds ??
            normalizedRoomDto.player?.duration_seconds ??
            normalizedRoomDto.durationSeconds ??
            normalizedRoomDto.duration_seconds ??
            fallbackRoom.playerSource?.durationSeconds,
        ) || 0,
      positionSeconds:
        Number(
          normalizedRoomDto.player?.positionSeconds ??
            normalizedRoomDto.player?.position_seconds ??
            normalizedRoomDto.positionSeconds ??
            normalizedRoomDto.position_seconds ??
            fallbackRoom.playerSource?.positionSeconds,
        ) || 0,
      episodeTitle:
        normalizeText(
          normalizedRoomDto.player?.episodeTitle ||
            normalizedRoomDto.player?.episode_title ||
            normalizedRoomDto.episodeTitle ||
            normalizedRoomDto.episode_title,
        ) ||
        normalizeText(fallbackRoom.playerSource?.episodeTitle) ||
        fallbackRoom.movie.title,
      description:
        normalizeText(
          normalizedRoomDto.player?.description ||
            normalizedRoomDto.player_description,
        ) ||
        normalizeText(fallbackRoom.playerSource?.description) ||
        fallbackRoom.movie.subtitle,
      posterUrl:
        normalizeText(
          normalizedRoomDto.player?.posterUrl ||
            normalizedRoomDto.player?.poster_url,
        ) ||
        normalizeText(fallbackRoom.playerSource?.posterUrl) ||
        fallbackRoom.movie.backdropUrl,
    },
    viewer: fallbackRoom.viewer,
    members: mapRoomMembers(
      readArray(normalizedRoomDto, ["members", "participants", "users"]),
      fallbackRoom.members,
      viewer,
    ),
    messages: mapRoomMessages(
      readArray(normalizedRoomDto, [
        "messages",
        "chat",
        "chatMessages",
        "chat_messages",
      ]),
      fallbackRoom.messages,
    ),
  };

  return applyViewerToRoom(mappedRoom, viewer);
}

function applyViewerToRoom(room, viewer) {
  const nextRoom = {
    ...room,
    viewer: {
      ...viewer,
    },
  };
  const members = Array.isArray(nextRoom.members) ? nextRoom.members : [];
  const youIndex = members.findIndex((member) => member.isYou);

  if (youIndex === -1) {
    nextRoom.members = [
      ...members,
      {
        id: "viewer",
        name: viewer.name,
        initial: viewer.initial,
        avatarTint: viewer.avatarTint,
        isHost: false,
        isYou: true,
        statusText: "",
        statusColor: "#2b9c5a",
      },
    ];
  } else {
    nextRoom.members = members.map((member, index) => {
      if (index !== youIndex) {
        return member;
      }

      return {
        ...member,
        name: viewer.name,
        initial: viewer.initial,
        avatarTint: viewer.avatarTint,
        isYou: true,
      };
    });
  }

  nextRoom.participantsCount = nextRoom.members.length;
  nextRoom.participantsLabel = `${nextRoom.members.length} ${pluralizeParticipants(nextRoom.members.length)}`;

  return nextRoom;
}

function mapHeroPosters(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  return items.slice(0, 4).map((item, index) => {
    const fallback = fallbackItems[index % fallbackItems.length];

    return {
      id: normalizeText(item?.id) || fallback.id,
      title: normalizeText(item?.title || item?.name) || fallback.title,
      label:
        normalizeText(item?.label || item?.badge || item?.genre) ||
        fallback.label,
      imageUrl: resolveImageUrl(item, fallback.imageUrl),
    };
  });
}

function mapVisibilityOptions(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  const options = items.map((item, index) => ({
    value:
      normalizeText(item?.value || item?.id || item?.key) ||
      fallbackItems[index % fallbackItems.length].value,
    label:
      normalizeText(item?.label || item?.title || item?.name) ||
      fallbackItems[index % fallbackItems.length].label,
    selected: Boolean(item?.selected ?? item?.default ?? index === 0),
  }));

  if (!options.some((item) => item.selected) && options[0]) {
    options[0].selected = true;
  }

  return options;
}

function mapFeaturedRooms(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item, index) => ({
      imageUrl:
        index % 2 === 0 ? "/img/cards/interstellar.webp" : "/img/joker.jpeg",
      ...item,
    }));
  }

  return items.slice(0, 6).map((item, index) => {
    const fallback =
      fallbackItems[index % fallbackItems.length] || fallbackItems[0];
    const membersCount = normalizeCount(
      item?.membersCount ??
        item?.members_count ??
        item?.participantsCount ??
        item?.participants_count ??
        item?.viewersCount ??
        item?.viewers_count,
    );

    return {
      id:
        normalizeText(item?.id || item?.roomId || item?.room_id) ||
        normalizeText(fallback?.id) ||
        String(index + 1),
      title:
        normalizeText(item?.title || item?.name) ||
        fallback?.title ||
        "Комната",
      hostName:
        normalizeText(
          item?.hostName ||
            item?.host_name ||
            item?.ownerName ||
            item?.owner_name,
        ) ||
        fallback?.hostName ||
        "Хозяин комнаты",
      movieTitle:
        normalizeText(
          item?.movieTitle ||
            item?.movie_title ||
            item?.movie?.title ||
            item?.movie_name,
        ) ||
        fallback?.movieTitle ||
        "Фильм",
      membersCount: membersCount || fallback?.membersCount || 0,
      privacyLabel:
        normalizeText(item?.privacyLabel || item?.privacy_label) ||
        fallback?.privacyLabel ||
        "Только по ссылке",
      progressLabel:
        normalizeText(
          item?.progressLabel || item?.progress_label || item?.currentTimeLabel,
        ) ||
        fallback?.progressLabel ||
        "0:00",
      isLive: resolveLiveLabel(
        item?.live ?? item?.status,
        fallback?.isLive ? "LIVE" : "",
      ),
      roomHref:
        normalizeText(item?.roomHref || item?.roomLink || item?.room_link) ||
        buildWatchPartyRoomPath(item?.id || fallback?.id || index + 1),
      imageUrl: resolveImageUrl(
        item,
        fallback?.imageUrl || "/img/cards/interstellar.webp",
      ),
    };
  });
}

function mapMyRooms(items) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.map((item, index) => {
    const roomId =
      normalizeText(item?.id || item?.roomId || item?.room_id) ||
      String(index + 1);
    const participantsCount = normalizeCount(
      item?.participantsCount ?? item?.participants_count ?? item?.membersCount,
    );

    return {
      id: roomId,
      title: normalizeText(item?.title || item?.name) || `Комната ${roomId}`,
      statusLabel:
        resolveLiveLabel(item?.status || item?.live, "") || "Ожидает",
      statusTone:
        resolveLiveLabel(item?.status || item?.live, "") === "LIVE"
          ? "live"
          : "waiting",
      meta:
        normalizeText(item?.meta) ||
        `${normalizeText(item?.movieTitle || item?.movie_title) || "Фильм"} · ${participantsCount} ${pluralizeParticipants(participantsCount)}`,
      roomLink:
        normalizeText(
          item?.roomLink ||
            item?.room_link ||
            item?.inviteLink ||
            item?.invite_link,
        ) || buildWatchPartyRoomPath(roomId),
      imageUrl: resolveImageUrl(item, "/img/65.jpg"),
    };
  });
}

function mapRoomMembers(items, fallbackItems, viewer) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  return items.map((item, index) => {
    const fallback =
      fallbackItems[index % fallbackItems.length] || fallbackItems[0];
    const name =
      normalizeText(item?.name || item?.title || item?.username) ||
      fallback?.name ||
      `Участник ${index + 1}`;

    return {
      id:
        normalizeText(item?.id || item?.userId || item?.user_id) ||
        `member-${index + 1}`,
      name,
      initial: buildInitial(name),
      avatarTint: pickAvatarTint(name),
      isHost: Boolean(item?.isHost ?? item?.host ?? fallback?.isHost),
      isYou:
        normalizeText(name).toLowerCase() ===
        normalizeText(viewer.name).toLowerCase(),
      statusText:
        normalizeText(
          item?.statusText || item?.status_text || item?.statusLabel,
        ) || "",
      statusColor:
        normalizeText(item?.statusColor || item?.status_color) ||
        (normalizeText(item?.statusText || item?.status_text)
          ? "#888888"
          : "#2b9c5a"),
    };
  });
}

function mapRoomMessages(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => cloneValue(item));
  }

  return items.map((item, index) => {
    const authorName =
      normalizeText(
        item?.authorName ||
          item?.author_name ||
          item?.author?.name ||
          item?.user?.name,
      ) || "Участник";
    const authorInitial = buildInitial(authorName);

    if (Array.isArray(item?.options)) {
      const options = item.options
        .map((option, optionIndex) => ({
          id:
            normalizeText(
              option?.id || option?.optionId || option?.option_id,
            ) || `bet-${index + 1}-option-${optionIndex + 1}`,
          label:
            normalizeText(option?.label || option?.title || option?.name) ||
            `Вариант ${optionIndex + 1}`,
          votes: normalizeCount(
            option?.votes ?? option?.count ?? option?.value,
          ),
          isSelected: Boolean(option?.isSelected ?? option?.selected),
        }))
        .filter((option) => option.label);

      return {
        id: normalizeText(item?.id) || `bet-${index + 1}`,
        isBet: true,
        authorName,
        authorInitial,
        authorTint: pickAvatarTint(authorName),
        timeLabel:
          normalizeText(item?.timeLabel || item?.time_label) ||
          formatTimeLabel(),
        question: normalizeText(item?.question || item?.title) || "Ставка",
        metaText:
          normalizeText(item?.metaText || item?.meta_text) ||
          `Создал ${authorName} · ${normalizeCount(item?.voteCount)} голосов`,
        voteCount: normalizeCount(item?.voteCount),
        selectionText:
          normalizeText(item?.selectionText || item?.selection_text) ||
          "Голосование открыто",
        options,
      };
    }

    return {
      id: normalizeText(item?.id) || `message-${index + 1}`,
      isBet: false,
      authorName,
      authorInitial,
      authorTint: pickAvatarTint(authorName),
      timeLabel:
        normalizeText(item?.timeLabel || item?.time_label) || formatTimeLabel(),
      text: normalizeText(item?.text || item?.message) || "",
      reactionText:
        normalizeText(item?.reactionText || item?.reaction_text) || "",
    };
  });
}

function mergeOverviewWithLocalRooms(pageData, localRooms, fallbackData) {
  const localMyRooms = localRooms.map((room) => {
    const participantsCount = normalizeCount(room.participantsCount);

    return {
      id: room.id,
      title: room.roomName || `Комната ${room.id}`,
      statusLabel: room.liveLabel || "Ожидает",
      statusTone: room.liveLabel ? "live" : "waiting",
      meta: `${room.movie?.title || "Фильм"} · ${participantsCount} ${pluralizeParticipants(participantsCount)}`,
      roomLink: buildWatchPartyRoomPath(room.id),
      imageUrl: room.movie?.backdropUrl || "/img/65.jpg",
    };
  });

  const localFeaturedRooms = localRooms.slice(0, 3).map((room) => ({
    id: room.id,
    title: room.roomName || `Комната ${room.id}`,
    hostName: room.hostName || "Хозяин комнаты",
    movieTitle: room.movie?.title || "Фильм",
    membersCount: normalizeCount(room.participantsCount),
    privacyLabel: room.privacyLabel || "Только по ссылке",
    progressLabel:
      room.player?.currentTimeLabel || room.progressLabel || "0:00",
    isLive: Boolean(room.liveLabel),
    roomHref: buildWatchPartyRoomPath(room.id),
    imageUrl: room.movie?.backdropUrl || "/img/cards/interstellar.webp",
  }));

  return {
    ...pageData,
    heroPosters: pageData.heroPosters.length
      ? pageData.heroPosters
      : fallbackData.heroPosters,
    visibilityOptions: pageData.visibilityOptions.length
      ? pageData.visibilityOptions
      : fallbackData.visibilityOptions,
    featuredRooms: localFeaturedRooms.length
      ? localFeaturedRooms
      : pageData.featuredRooms.length
        ? pageData.featuredRooms
        : fallbackData.featuredRooms,
    myRooms: localMyRooms.length ? localMyRooms : pageData.myRooms,
  };
}

function removeRoomFromOverview(pageData, roomId) {
  const normalizedRoomId = normalizeText(roomId);

  if (!normalizedRoomId) {
    return pageData;
  }

  return {
    ...pageData,
    featuredRooms: pageData.featuredRooms.filter((room) => {
      return normalizeText(room.id) !== normalizedRoomId;
    }),
    myRooms: pageData.myRooms.filter((room) => {
      return normalizeText(room.id) !== normalizedRoomId;
    }),
  };
}

function createInitialLobbyUiState() {
  return {
    isLoading: true,
    errorMessage: "",
    statusMessage: "",
    statusTone: "info",
  };
}

function createInitialRoomUiState() {
  return {
    loading: true,
    hasError: false,
    errorTitle: "",
    errorText: "",
    roomStatusMessage: "",
    roomStatusTone: "info",
    activePanel: "",
    isBetComposerOpen: false,
    betComposerOptionCount: 2,
  };
}

function buildCurrentViewer() {
  const authState = authStore.getState();
  const name =
    normalizeText(getDisplayNameFromEmail(authState.user?.email)) ||
    normalizeText(authState.user?.name) ||
    "Вы";

  return {
    name,
    initial: buildInitial(name),
    avatarTint: pickAvatarTint(name),
  };
}

function createLocalRoomDraft({ roomId, roomName, visibilityLabel, viewer }) {
  const fallbackRoom = buildWatchPartyFallbackRoom(roomId);

  return applyViewerToRoom(
    {
      ...fallbackRoom,
      id: normalizeText(roomId) || fallbackRoom.id,
      roomName: roomName || fallbackRoom.roomName,
      privacyLabel: visibilityLabel || fallbackRoom.privacyLabel,
      inviteLink: buildWatchPartyRoomPath(roomId || fallbackRoom.id),
      hostName: viewer.name,
      liveLabel: "LIVE",
      messages: [
        {
          id: `message-${Date.now()}`,
          isBet: false,
          authorName: viewer.name,
          authorInitial: viewer.initial,
          authorTint: viewer.avatarTint,
          timeLabel: formatTimeLabel(),
          text: "Комната создана. Чат и участники скрыты по умолчанию и открываются по кнопкам в шапке.",
          reactionText: "",
        },
      ],
      members: [
        {
          id: "viewer",
          name: viewer.name,
          initial: viewer.initial,
          avatarTint: viewer.avatarTint,
          isHost: true,
          isYou: true,
          statusText: "",
          statusColor: "#2b9c5a",
        },
      ],
    },
    viewer,
  );
}

function decorateRoomMessage(message) {
  if (!message.isBet) {
    return {
      ...message,
    };
  }

  const voteCount = Math.max(
    normalizeCount(message.voteCount),
    sumOptionVotes(message.options),
  );
  const options = message.options.map((option) => {
    const votes = normalizeCount(option.votes);
    const percent = voteCount > 0 ? Math.round((votes / voteCount) * 100) : 0;

    return {
      ...option,
      widthStyle: `width: ${percent}%`,
      percentLabel: `${percent}%`,
    };
  });
  const hasSelectedOption = options.some((option) => option.isSelected);

  return {
    ...message,
    voteCount,
    options,
    hasSelectedOption,
    metaText:
      normalizeText(message.metaText) ||
      `Создал ${message.authorName} · ${voteCount} голосов`,
    votersText: formatVotersText(voteCount),
    selectionText:
      normalizeText(message.selectionText) ||
      resolveSelectedOptionLabel(message.options) ||
      "Голосование открыто",
  };
}

function buildComposerOptions(count) {
  const normalizedCount = Math.min(Math.max(normalizeCount(count), 2), 6);
  return Array.from({ length: normalizedCount }, (_, index) => ({
    index: index + 1,
    canRemove: normalizedCount > 2,
  }));
}

function readWatchPartyRouteState(pathname) {
  const pathParts = String(pathname || "")
    .trim()
    .split("/")
    .filter(Boolean);

  if (pathParts[0] !== "watch-party" || !pathParts[1]) {
    return {
      isRoomView: false,
      roomId: "",
    };
  }

  return {
    isRoomView: true,
    roomId: normalizeText(pathParts[1]).replace(/^id/i, ""),
  };
}

function resolveVisibilityLabel(value, options) {
  const matched = options.find((option) => option.value === value);
  return matched?.label || "Только по ссылке";
}

function resolveImageUrl(item, fallback) {
  return (
    normalizeText(
      item?.imageUrl ||
        item?.image_url ||
        item?.posterUrl ||
        item?.poster_url ||
        item?.coverUrl ||
        item?.cover_url,
    ) || fallback
  );
}

function resolveLiveLabel(value, fallback) {
  if (typeof value === "boolean") {
    return value ? "LIVE" : "";
  }

  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "live" || normalizedValue === "active") {
    return "LIVE";
  }

  if (normalizedValue === "waiting" || normalizedValue === "pending") {
    return "";
  }

  return fallback || "";
}

function extractRoomIdFromLink(link) {
  const normalizedLink = normalizeText(link);

  if (!normalizedLink) {
    return "";
  }

  try {
    const parsedUrl = new URL(normalizedLink, window.location.origin);
    const routeState = readWatchPartyRouteState(parsedUrl.pathname);
    return routeState.roomId;
  } catch {
    return "";
  }
}

function absolutizeRoomLink(link) {
  const normalizedLink = normalizeText(link);

  if (!normalizedLink) {
    return "";
  }

  try {
    return new URL(normalizedLink, window.location.origin).toString();
  } catch {
    return normalizedLink;
  }
}

function readArray(source, keys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    const candidate = source[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function formatTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatVotersText(count) {
  if (count === 1) {
    return "1 участник проголосовал";
  }

  return `${count} ${pluralizeParticipants(count)} проголосовали`;
}

function resolveSelectedOptionLabel(options = []) {
  const selectedOption = options.find((option) => option.isSelected);

  if (!selectedOption) {
    return "";
  }

  return `Ваш выбор: ${selectedOption.label}`;
}

function sumOptionVotes(options = []) {
  if (!Array.isArray(options)) {
    return 0;
  }

  return options.reduce((accumulator, option) => {
    return accumulator + normalizeCount(option.votes);
  }, 0);
}

function buildInitial(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "В";
  }

  return normalizedValue.charAt(0).toUpperCase();
}

function pickAvatarTint(seed) {
  const palette = [
    "rgba(255, 87, 31, 0.28)",
    "rgba(26, 111, 181, 0.28)",
    "rgba(43, 156, 90, 0.28)",
    "rgba(181, 124, 32, 0.28)",
    "rgba(120, 60, 180, 0.28)",
  ];

  const normalizedSeed = normalizeText(seed) || "vkino";
  const hash = Array.from(normalizedSeed).reduce((accumulator, char) => {
    return accumulator + char.charCodeAt(0);
  }, 0);

  return palette[hash % palette.length];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clampPercent(value) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(Math.max(parsed, 0), 100);
}

function pluralizeRooms(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "комната";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "комнаты";
  }

  return "комнат";
}

function pluralizeParticipants(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "участник";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "участника";
  }

  return "участников";
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

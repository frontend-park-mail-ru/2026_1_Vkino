import BasePage from "@/pages/BasePage.js";
import "@/pages/WatchParty/WatchParty.precompiled.js";
import "@/css/watch-party.scss";

import HeaderComponent from "@/components/Header/Header.js";
import MoviePlayerComponent from "@/components/MoviePlayer/MoviePlayer.js";
import WatchPartyRoomChatComponent from "@/components/WatchPartyRoomChat/WatchPartyRoomChat.js";
import { apiService } from "@/js/api.js";
import { movieService } from "@/js/MovieService.js";
import {
  buildWatchPartyFallbackOverview,
  buildWatchPartyFallbackRoom,
  buildWatchPartyJoinPath,
  buildWatchPartyRoomPath,
  saveLocalWatchPartyRoom,
  watchPartyService,
} from "@/js/WatchPartyService.js";
import { userService } from "@/js/UserService.js";
import {
  extractMovie,
  extractSelections,
  extractWatchPartyOverview,
  extractWatchPartyRoom,
} from "@/utils/apiResponse.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getDisplayNameFromEmail } from "@/utils/user.js";
import {
  MEDIA_BUCKETS,
  resolveAvatarUrl,
  resolveMediaUrl,
} from "@/utils/media.js";

const HERO_COPY = {
  heroEyebrow: "Совместный просмотр",
  heroTitle: "Смотрите вместе с друзьями",
  heroSubtitle: "Одна комната, один таймлайн, одни эмоции.",
  heroDescription:
    "Создайте комнату, настройте доступ и переходите в комнату проекта без отдельного шаблона.",
};
const WATCH_PARTY_WS_RECONNECT_DELAY_MS = 3000;
const WATCH_PARTY_ROOM_POLL_INTERVAL_MS = 2000;
const WATCH_PARTY_ROOM_STATUS_AUTO_HIDE_MS = 3000;
const WATCH_PARTY_CARD_FALLBACK_SRC = "/img/card-fallback.webp";

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
    this._nextRoomIndex = 1;
    this._roomPlayerSnapshot = null;
    this._roomSubscription = null;
    this._roomSubscriptionUrl = "";
    this._roomSubscriptionReconnectTimerId = 0;
    this._shouldReconnectRoomSubscription = false;
    this._suppressRoomPlaybackEvents = false;
    this._roomStatePollTimerId = 0;
    this._roomStatePollInFlight = false;
    this._roomSubscriptionReady = false;
    this._roomStatusAutoHideTimerId = 0;
    this._watchPartyImageElements = [];
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

    if (this._routeState.isJoinView) {
      return this._loadJoinContext({ showLoading });
    }

    return this._loadLobbyContext({ showLoading });
  }

  addEventListeners() {
    this.el.addEventListener("click", this._onClick);
    this.el.addEventListener("submit", this._onSubmit);
    this._bindWatchPartyImageFallbacks();

    if (this._mode === "room" && !this._uiState.loading && !this._uiState.hasError) {
      this._connectRoomSubscription();
    }

    if (
      this._mode === "room" &&
      !this._uiState.loading &&
      !this._uiState.hasError &&
      hasRoomMovieSelection(this._roomData)
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
    this._watchPartyImageElements.forEach((image) => {
      if (image instanceof HTMLImageElement) {
        image.removeEventListener("error", this._onWatchPartyImageError);
      }
    });
    this._watchPartyImageElements = [];
    this._disconnectRoomSubscription();
    this._stopRoomStatePolling();
    this._clearRoomStatusAutoHide();
  }

  beforeDestroy() {
    this._disconnectRoomSubscription();
    this._stopRoomStatePolling();
    this._clearRoomStatusAutoHide();
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "WatchPartyPage: не найден header в шаблоне WatchParty.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));

    if (this._mode === "room" && !this._uiState.loading && !this._uiState.hasError) {
      if (hasRoomMovieSelection(this._roomData)) {
        this._setupRoomPlayer();
      }
      this._setupRoomChat();
    }
  }

  _onClick = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (
      this._mode === "lobby" &&
      this._uiState.isVisibilityMenuOpen &&
      !event.target.closest("[data-role='watch-party-visibility']") &&
      (!actionTarget ||
        !["toggle-room-visibility-menu", "select-room-visibility"].includes(
          actionTarget.dataset.action,
        ))
    ) {
      this._refreshView({ isVisibilityMenuOpen: false });
    }

    if (!actionTarget) {
      return;
    }

    switch (actionTarget.dataset.action) {
      case "toggle-room-visibility-menu":
        event.preventDefault();
        this._toggleRoomVisibilityMenu();
        break;
      case "select-room-visibility":
        event.preventDefault();
        this._selectRoomVisibility(
          actionTarget.dataset.value || "",
          actionTarget.dataset.label || actionTarget.textContent || "",
        );
        break;
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
      case "open-room-invite-modal":
        event.preventDefault();
        await this._openRoomInviteModal();
        break;
      case "close-room-invite-modal":
        event.preventDefault();
        this._closeRoomInviteModal();
        break;
      case "invite-room-friend":
        event.preventDefault();
        await this._inviteFriendToRoom(actionTarget.dataset.friendId || "");
        break;
      case "delete-room":
        event.preventDefault();
        await this._deleteRoom(
          actionTarget.dataset.roomId || "",
          actionTarget.dataset.roomTitle || "Комната",
        );
        break;
      case "join-featured-room":
        event.preventDefault();
        this._openRoomFromAction(actionTarget);
        break;
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
      case "scroll-room-movie-candidates-prev":
        event.preventDefault();
        this._scrollRoomMovieCandidates(-1);
        break;
      case "scroll-room-movie-candidates-next":
        event.preventDefault();
        this._scrollRoomMovieCandidates(1);
        break;
      case "select-top-room-movie":
        event.preventDefault();
        await this._handleSelectTopRoomMovie(actionTarget.dataset.movieId || "");
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
        await this._selectBetOption(
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
        await this._handleSendChatMessage(actionTarget);
        break;
      case "create-bet":
        event.preventDefault();
        await this._handleCreateBet(actionTarget);
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

    this._overviewData = mapOverviewToPageData(
      ok ? extractWatchPartyOverview(resp) : {},
      fallbackData,
    );
    this._contextLoaded = true;

    this._refreshView({
      isLoading: false,
      errorMessage: ok
        ? ""
        : "Не удалось загрузить данные с сервера.",
    });
  }

  async _loadJoinContext({ showLoading = false } = {}) {
    const inviteCode = normalizeText(this._routeState.inviteCode);

    if (!inviteCode) {
      await this._loadLobbyContext({ showLoading });
      this._setLobbyStatus("В ссылке отсутствует invite-код комнаты.", "error");
      return;
    }

    if (!authStore.getState().user) {
      this._redirectToSignIn();
      return;
    }

    if (showLoading) {
      this._refreshView({
        isLoading: true,
        errorMessage: "",
        statusMessage: "",
      });
    }

    const result = await this._joinRoomByInviteCode(inviteCode);

    if (result.ok) {
      const joinedRoomId = extractWatchPartyRoomIdentifier(result.resp);

      if (joinedRoomId) {
        router.go(buildWatchPartyRoomPath(joinedRoomId));
        return;
      }
    }

    console.error("WatchPartyPage: не удалось войти в комнату по invite", {
      inviteCode,
      status: result.status,
      error: result.error,
      resp: result.resp,
    });

    await this._loadLobbyContext({ showLoading: false });
    this._setLobbyStatus(
      result.error || "Не удалось войти в комнату по ссылке.",
      "error",
    );
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
        isInviteModalOpen: false,
        inviteFriendsLoading: false,
        inviteFriendsError: "",
      });
    }

    const viewer = buildCurrentViewer();
    const result = await watchPartyService.getRoom(roomId);

    if (!result.ok) {
      console.error("WatchPartyPage: не удалось загрузить комнату", {
        roomId,
        status: result.status,
        error: result.error,
        resp: result.resp,
      });

      this._contextLoaded = true;
      this._refreshView({
        loading: false,
        hasError: true,
        errorTitle: "Данных нет",
        errorText: buildRoomAccessErrorText(result),
        roomStatusMessage: "",
        roomStatusTone: "info",
        isInviteModalOpen: false,
        inviteFriendsLoading: false,
        inviteFriendsError: "",
      });
      return;
    }

    const roomPayload = extractWatchPartyRoom(result.resp) || result.resp;

    this._roomData = applyViewerToRoom(
      mapRoomDtoToViewModel(
        roomPayload,
        buildWatchPartyFallbackRoom(roomId),
        viewer,
      ),
      viewer,
    );
    await this._hydrateRoomMovieSelection();
    if (!hasRoomMovieBinding(this._roomData)) {
      this._uiState = {
        ...this._uiState,
        topMovieCandidatesLoading: true,
        topMovieCandidatesError: "",
      };

      const topMovieCandidates = await loadTopRoomMovieCandidates();

      this._uiState = {
        ...this._uiState,
        topMovieCandidatesLoading: false,
        topMovieCandidatesError: topMovieCandidates.length
          ? ""
          : "Не удалось загрузить топ 10 для выбора фильма.",
        topMovieCandidates,
      };
    }
    this._contextLoaded = true;

    this._refreshView({
      loading: false,
      hasError: false,
      errorTitle: "",
      errorText: "",
      roomStatusMessage: "",
      roomStatusTone: "info",
      isInviteModalOpen: false,
      inviteFriendsLoading: false,
      inviteFriendsError: "",
    });
  }

  async _joinRoomByInviteCode(inviteCode) {
    const normalizedInviteCode = normalizeText(inviteCode);

    if (!normalizedInviteCode) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "Не удалось определить invite-код комнаты.",
      };
    }

    return watchPartyService.joinRoomByInviteCode(normalizedInviteCode);
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

    const result = await watchPartyService.createRoom({
      name: roomName,
      visibility: normalizeVisibilityValue(visibility),
    });

    if (!result.ok) {
      this._setLobbyStatus(
        result.error || "Не удалось создать комнату.",
        "error",
      );
      return;
    }

    const createdRoomPayload = extractWatchPartyRoom(result.resp) || result.resp;
    const createdRoomId = normalizeText(
      createdRoomPayload?.id ||
        createdRoomPayload?.roomId ||
        createdRoomPayload?.room_id,
    );

    if (!createdRoomId) {
      this._setLobbyStatus(
        "Сервер не вернул идентификатор созданной комнаты.",
        "error",
      );
      return;
    }

    router.go(buildWatchPartyRoomPath(createdRoomId));
  }

  _toggleRoomVisibilityMenu() {
    if (this._mode !== "lobby") {
      return;
    }

    this._refreshView({
      isVisibilityMenuOpen: !this._uiState.isVisibilityMenuOpen,
    });
  }

  _selectRoomVisibility(value, label = "") {
    if (this._mode !== "lobby") {
      return;
    }

    const normalizedValue = normalizeText(value);
    const normalizedLabel = normalizeText(label);

    if (!normalizedValue) {
      return;
    }

    this._overviewData = {
      ...this._overviewData,
      visibilityOptions: (this._overviewData.visibilityOptions || []).map((option) => ({
        ...option,
        selected: normalizeText(option.value) === normalizedValue,
      })),
    };

    this._refreshView({
      isVisibilityMenuOpen: false,
      visibilitySelectedValue: normalizedValue,
      visibilitySelectedLabel: normalizedLabel,
    });
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

    const inviteCode = extractInviteCodeFromLink(inviteLink);

    if (!inviteCode) {
      this._setLobbyStatus(
        "Не удалось определить invite-код по ссылке. Проверьте формат приглашения.",
        "error",
      );
      return;
    }

    router.go(buildWatchPartyJoinPath(inviteCode));
  }

  async _handleSendChatMessage(form) {
    if (this._mode !== "room") {
      return;
    }

    const formData = new FormData(form);
    const messageText = normalizeText(formData.get("message"));

    if (!messageText) {
      this._setRoomStatus("Введите сообщение перед отправкой.", "warning");
      return;
    }

    const roomId = normalizeText(this._roomData.id);
    const result = await watchPartyService.sendRoomMessage(roomId, {
      content: messageText,
    });

    if (!result.ok) {
      this._setRoomStatus(
        result.error || "Не удалось отправить сообщение в комнату.",
        "error",
      );
      return;
    }

    const messageItem = mapRoomMessages([result.resp?.message]).at(0);

    if (messageItem) {
      this._roomData = {
        ...this._roomData,
        messages: upsertRoomFeedItem(this._roomData.messages, messageItem),
      };
    }
    this._clearRoomChatMessageDraft();
    this._refreshRoomChat({
      activePanel: "chat",
      roomStatusMessage: "",
    });
  }

  async _handleCreateBet(form) {
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

    const roomId = normalizeText(this._roomData.id);
    const result = await watchPartyService.createRoomPoll(roomId, {
      question,
      options,
    });

    if (!result.ok) {
      this._setRoomStatus(
        result.error || "Не удалось создать голосование в комнате.",
        "error",
      );
      return;
    }

    const pollItem = mapRoomPolls([result.resp?.poll]).at(0);

    if (pollItem) {
      this._roomData = {
        ...this._roomData,
        messages: upsertRoomFeedItem(this._roomData.messages, pollItem),
      };
    }
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

  _scrollRoomMovieCandidates(direction = 1) {
    const viewport = this.el?.querySelector('[data-role="room-movie-candidates"]');

    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      left: viewport.clientWidth * 0.82 * direction,
      behavior: "smooth",
    });
  }

  async _handleSelectTopRoomMovie(movieId) {
    if (this._mode !== "room") {
      return;
    }

    const normalizedMovieId = normalizeText(movieId);

    if (!normalizedMovieId) {
      this._setRoomStatus("Не удалось определить фильм для комнаты.", "error");
      return;
    }

    const result = await movieService.getMovieById(normalizedMovieId);

    if (!result.ok) {
      this._setRoomStatus(
        result.error || "Не удалось загрузить выбранный фильм.",
        "error",
      );
      return;
    }

    const moviePayload = extractMovie(result.resp);
    const selectedMovie = mapMovieDtoToRoomSelection(moviePayload);

    if (!selectedMovie || !selectedMovie.id || !selectedMovie.episodes.length) {
      this._setRoomStatus(
        "У выбранного фильма нет доступных эпизодов для воспроизведения.",
        "warning",
      );
      return;
    }

    const firstEpisode = selectedMovie.episodes[0];

    this._roomData = {
      ...this._roomData,
      movie: {
        ...this._roomData.movie,
        title: selectedMovie.title,
        subtitle: selectedMovie.subtitle || selectedMovie.description,
        backdropUrl:
          selectedMovie.backdropUrl || this._roomData.movie.backdropUrl,
      },
      selectedMovie,
      playerSource: {
        ...(this._roomData.playerSource || {}),
        movieId: selectedMovie.id,
        episodeId: firstEpisode.id,
        playbackUrl: normalizeText(firstEpisode.playbackUrl),
        durationSeconds: firstEpisode.durationSeconds,
        positionSeconds: 0,
        episodeTitle: firstEpisode.title,
        description: firstEpisode.description || selectedMovie.description,
        posterUrl: firstEpisode.imgUrl || selectedMovie.posterUrl,
      },
      progressLabel: "0:00",
      player: {
        ...(this._roomData.player || {}),
        isPlaying: false,
        progressPercent: 0,
        currentTimeLabel: "0:00",
      },
    };
    await this._persistRoomPlaybackAction("sync_state", {
      movie_id: selectedMovie.id,
      episode_id: firstEpisode.id,
      playback_url: normalizeText(firstEpisode.playbackUrl),
      duration_seconds: firstEpisode.durationSeconds,
      position_seconds: 0,
      status: "paused",
    });
    this._refreshView({
      roomStatusMessage: `Фильм ${selectedMovie.title} привязан к комнате.`,
      roomStatusTone: "success",
    });
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

  async _selectBetOption(messageId, optionId) {
    if (this._mode !== "room") {
      return;
    }

    const normalizedMessageId = normalizeText(messageId);
    const normalizedOptionId = normalizeText(optionId);

    if (!normalizedMessageId || !normalizedOptionId) {
      return;
    }

    const roomId = normalizeText(this._roomData.id);
    const result = await watchPartyService.voteRoomPoll(
      roomId,
      normalizedMessageId,
      { option_id: normalizeNumericIdentifier(normalizedOptionId) },
    );

    if (!result.ok) {
      this._setRoomStatus(
        result.error || "Не удалось отправить голос.",
        "error",
      );
      return;
    }

    const pollItem = mapRoomPolls([result.resp?.poll]).at(0);

    if (!pollItem) {
      return;
    }

    const selectedPollItem = markPollSelection(
      {
        ...pollItem,
        id: normalizedMessageId,
      },
      normalizedOptionId,
    );

    this._roomData = {
      ...this._roomData,
      messages: upsertRoomFeedItem(this._roomData.messages, selectedPollItem),
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

  async _openRoomInviteModal() {
    if (this._mode !== "room") {
      return;
    }

    if (!isCurrentViewerRoomHost(this._roomData)) {
      this._setTemporaryRoomStatus(
        "Приглашать друзей в комнату может только хозяин.",
        "warning",
      );
      return;
    }

    if (!absolutizeRoomLink(this._roomData.inviteLink)) {
      this._setTemporaryRoomStatus(
        "Для этой комнаты пока недоступна invite-ссылка.",
        "error",
      );
      return;
    }

    this._refreshView({
      isInviteModalOpen: true,
      inviteFriendsError: "",
    });

    await this._ensureInviteFriendsLoaded();
  }

  _closeRoomInviteModal() {
    if (this._mode !== "room" || !this._uiState.isInviteModalOpen) {
      return;
    }

    this._refreshView({
      isInviteModalOpen: false,
      inviteFriendsError: "",
    });
  }

  async _ensureInviteFriendsLoaded({ force = false } = {}) {
    if (this._mode !== "room") {
      return;
    }

    if (this._uiState.inviteFriendsLoading) {
      return;
    }

    if (!force && this._uiState.inviteFriendsLoaded) {
      return;
    }

    this._refreshView({
      inviteFriendsLoading: true,
      inviteFriendsError: "",
    });

    const result = await userService.getFriendsList({ limit: 100, offset: 0 });

    if (!result.ok) {
      this._refreshView({
        inviteFriendsLoading: false,
        inviteFriendsLoaded: false,
        inviteFriendsError:
          result.error || "Не удалось загрузить список друзей.",
      });
      return;
    }

    this._refreshView({
      inviteFriendsLoading: false,
      inviteFriendsLoaded: true,
      inviteFriendsError: "",
      inviteFriends: normalizeInviteFriends(result.resp?.friends || []),
    });
  }

  async _inviteFriendToRoom(friendId) {
    const normalizedFriendId = normalizeText(friendId);
    const roomId = normalizeText(this._roomData.id);

    if (!normalizedFriendId || !roomId) {
      this._setTemporaryRoomStatus(
        "Не удалось определить друга или комнату для приглашения.",
        "error",
      );
      return;
    }

    if (!isCurrentViewerRoomHost(this._roomData)) {
      this._setTemporaryRoomStatus(
        "Приглашать друзей в комнату может только хозяин.",
        "warning",
      );
      return;
    }

    const nextInFlightIds = new Set(this._uiState.inviteRequestInFlightIds || []);
    nextInFlightIds.add(normalizedFriendId);

    this._refreshView({
      inviteRequestInFlightIds: Array.from(nextInFlightIds),
    });

    const result = await watchPartyService.inviteFriendToRoom(
      normalizedFriendId,
      roomId,
    );

    nextInFlightIds.delete(normalizedFriendId);

    if (!result.ok) {
      this._refreshView({
        inviteRequestInFlightIds: Array.from(nextInFlightIds),
      });
      this._setTemporaryRoomStatus(
        result.error || "Не удалось отправить приглашение.",
        "error",
      );
      return;
    }

    this._refreshView({
      inviteRequestInFlightIds: Array.from(nextInFlightIds),
      inviteFriendStatuses: {
        ...(this._uiState.inviteFriendStatuses || {}),
        [normalizedFriendId]: "pending",
      },
    });

    this._setTemporaryRoomStatus("Приглашение отправлено.", "success");
  }

  async _deleteRoom(roomId, roomTitle) {
    const normalizedRoomId = normalizeText(roomId);

    if (!normalizedRoomId) {
      this._setLobbyStatus("Комната уже удалена или недоступна.", "error");
      return;
    }

    const result = await watchPartyService.deleteRoom(normalizedRoomId);

    if (!result.ok) {
      this._setLobbyStatus(
        result.error || "Не удалось удалить комнату.",
        "error",
      );
      return;
    }

    this._overviewData = removeRoomFromOverview(this._overviewData, normalizedRoomId);
    this._refreshView({
      statusMessage: `Комната «${roomTitle}» удалена.`,
      statusTone: "success",
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

  _openRoomFromAction(actionTarget) {
    const roomLink = normalizeText(actionTarget.dataset.roomLink);

    if (roomLink) {
      router.go(roomLink);
      return;
    }

    this._openRoom(actionTarget.dataset.roomId || "");
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
    this._clearRoomStatusAutoHide();

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

  _setTemporaryRoomStatus(message, tone, durationMs = WATCH_PARTY_ROOM_STATUS_AUTO_HIDE_MS) {
    this._setRoomStatus(message, tone);

    if (this._mode !== "room" || !message || durationMs <= 0) {
      return;
    }

    this._roomStatusAutoHideTimerId = window.setTimeout(() => {
      this._roomStatusAutoHideTimerId = 0;

      if (this._uiState.roomStatusMessage !== message) {
        return;
      }

      this._refreshRoomChrome({
        roomStatusMessage: "",
      });
    }, durationMs);
  }

  _clearRoomStatusAutoHide() {
    if (!this._roomStatusAutoHideTimerId) {
      return;
    }

    window.clearTimeout(this._roomStatusAutoHideTimerId);
    this._roomStatusAutoHideTimerId = 0;
  }

  _setCopySuccessStatus() {
    if (this._mode === "room") {
      this._setTemporaryRoomStatus("Ссылка на комнату скопирована.", "success");
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

  _redirectToSignIn() {
    const returnTo = encodeURIComponent(
      window.location.pathname + window.location.search,
    );
    router.go(`/sign-in?return_to=${returnTo}`);
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

  _bindWatchPartyImageFallbacks() {
    this._watchPartyImageElements = Array.from(
      this.el.querySelectorAll(
        ".watch-party__poster-card img, .watch-party__room-media img, .watch-party__my-room-thumb",
      ),
    );

    this._watchPartyImageElements.forEach((image) => {
      if (image instanceof HTMLImageElement) {
        image.addEventListener("error", this._onWatchPartyImageError);
      }
    });
  }

  _onWatchPartyImageError = (event) => {
    const image = event.currentTarget;

    if (!(image instanceof HTMLImageElement)) {
      return;
    }

    if (image.dataset.fallbackApplied === "true") {
      return;
    }

    image.dataset.fallbackApplied = "true";
    image.src = WATCH_PARTY_CARD_FALLBACK_SRC;
  };

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
          onPlaybackEvent: (payload) => {
            void this._handleRoomPlayerPlaybackEvent(payload);
          },
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
    const roomEpisodeId =
      normalizeText(this._roomData.playerSource?.episodeId) ||
      playerMovie.initialEpisodeId;
    const roomPositionSeconds = normalizeCount(
      this._roomData.playerSource?.positionSeconds,
    );
    const roomIsPlaying = Boolean(this._roomData.player?.isPlaying);

    this._suppressRoomPlaybackEvents = true;
    await player.open(
      playerMovie,
      snapshot?.activeEpisodeId || roomEpisodeId,
      {
        autoplay: snapshot?.isPlaying ?? roomIsPlaying,
        restoreProgress: !playerMovie.isDirectPlayback,
        startAtSeconds: snapshot?.currentTime ?? roomPositionSeconds,
      },
    );
    this._suppressRoomPlaybackEvents = false;

    player.restoreAudioState({
      volumePercent: snapshot?.volumePercent,
      isMuted: snapshot?.isMuted,
    });
  }

  _connectRoomSubscription() {
    if (this._mode !== "room" || this._uiState.loading || this._uiState.hasError) {
      return;
    }

    const roomId = normalizeText(this._roomData?.id || this._routeState.roomId);

    if (!roomId || typeof WebSocket === "undefined") {
      return;
    }

    const nextUrl = buildRoomSubscriptionUrl(roomId);

    if (!nextUrl || this._roomSubscriptionUrl === nextUrl) {
      return;
    }

    this._shouldReconnectRoomSubscription = true;
    this._disconnectRoomSubscription({ preserveReconnect: true });

    try {
      const socket = new WebSocket(nextUrl);

      socket.addEventListener("open", this._onRoomSubscriptionOpen);
      socket.addEventListener("message", this._onRoomSubscriptionMessage);
      socket.addEventListener("close", this._onRoomSubscriptionClose);
      socket.addEventListener("error", this._onRoomSubscriptionError);

      this._roomSubscription = socket;
      this._roomSubscriptionUrl = nextUrl;
    } catch (error) {
      console.error("WatchPartyPage: не удалось открыть room subscription", {
        roomId,
        error,
      });
    }
  }

  _startRoomStatePolling() {
    if (
      this._mode !== "room" ||
      this._uiState.loading ||
      this._uiState.hasError ||
      this._roomStatePollTimerId
    ) {
      return;
    }

    if (isCurrentViewerRoomHost(this._roomData)) {
      return;
    }

    if (this._roomSubscriptionReady) {
      return;
    }

    this._roomStatePollTimerId = window.setInterval(() => {
      void this._pollRoomState();
    }, WATCH_PARTY_ROOM_POLL_INTERVAL_MS);
  }

  _stopRoomStatePolling() {
    if (!this._roomStatePollTimerId) {
      return;
    }

    window.clearInterval(this._roomStatePollTimerId);
    this._roomStatePollTimerId = 0;
    this._roomStatePollInFlight = false;
  }

  async _pollRoomState() {
    if (
      this._roomStatePollInFlight ||
      this._mode !== "room" ||
      this._roomSubscriptionReady
    ) {
      return;
    }

    const roomId = normalizeText(this._roomData?.id || this._routeState.roomId);

    if (!roomId) {
      return;
    }

    this._roomStatePollInFlight = true;

    try {
      const result = await watchPartyService.getRoom(roomId);

      if (!result.ok) {
        return;
      }

      const roomPayload = extractWatchPartyRoom(result.resp) || result.resp;
      this._applyRoomPatchEvent({
        type: "sync_state",
        room: roomPayload,
        playback: roomPayload?.playback,
      });
    } finally {
      this._roomStatePollInFlight = false;
    }
  }

  _disconnectRoomSubscription({ preserveReconnect = false } = {}) {
    window.clearTimeout(this._roomSubscriptionReconnectTimerId);
    this._roomSubscriptionReconnectTimerId = 0;
    this._shouldReconnectRoomSubscription = preserveReconnect
      ? this._shouldReconnectRoomSubscription
      : false;
    this._roomSubscriptionReady = false;

    const socket = this._roomSubscription;

    if (!socket) {
      this._roomSubscriptionUrl = "";
      return;
    }

    socket.removeEventListener("open", this._onRoomSubscriptionOpen);
    socket.removeEventListener("message", this._onRoomSubscriptionMessage);
    socket.removeEventListener("close", this._onRoomSubscriptionClose);
    socket.removeEventListener("error", this._onRoomSubscriptionError);

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }

    this._roomSubscription = null;
    this._roomSubscriptionUrl = "";
  }

  _onRoomSubscriptionOpen = () => {
    window.clearTimeout(this._roomSubscriptionReconnectTimerId);
    this._roomSubscriptionReconnectTimerId = 0;
    this._roomSubscriptionReady = true;
    this._stopRoomStatePolling();

    this._setTemporaryRoomStatus(
      "Подключение к событиям комнаты активно.",
      "success",
    );
  };

  _onRoomSubscriptionMessage = (event) => {
    const payload = parseSubscriptionPayload(event?.data);

    if (!payload) {
      return;
    }

    this._applyRoomSubscriptionPayload(payload);
  };

  _onRoomSubscriptionClose = () => {
    this._roomSubscription = null;
    this._roomSubscriptionReady = false;
    const nextUrl = this._roomSubscriptionUrl;

    if (
      this._shouldReconnectRoomSubscription &&
      nextUrl &&
      !this._roomSubscriptionReconnectTimerId
    ) {
      this._setRoomStatus("Переподключаемся к событиям комнаты...", "warning");
      this._roomSubscriptionReconnectTimerId = window.setTimeout(() => {
        this._roomSubscriptionReconnectTimerId = 0;

        if (!this._shouldReconnectRoomSubscription || this._mode !== "room") {
          return;
        }

        this._roomSubscriptionUrl = "";
        this._connectRoomSubscription();
      }, WATCH_PARTY_WS_RECONNECT_DELAY_MS);
      this._startRoomStatePolling();
      return;
    }

    this._roomSubscriptionUrl = "";
    this._startRoomStatePolling();
  };

  _onRoomSubscriptionError = (error) => {
    console.error("WatchPartyPage: ошибка room subscription", {
      roomId: this._roomData?.id || this._routeState.roomId,
      error,
    });
    this._roomSubscriptionReady = false;
    this._startRoomStatePolling();
    this._setRoomStatus("Не удалось подключиться к событиям комнаты.", "warning");
  };

  _applyRoomSubscriptionPayload(payload) {
    const eventType = normalizeText(payload?.type).toLowerCase();

    if (!eventType || this._mode !== "room") {
      return;
    }

    if (eventType === "member_joined") {
      this._applyMemberJoinedEvent(payload);
      return;
    }

    if (eventType === "member_left") {
      this._applyMemberLeftEvent(payload);
      return;
    }

    if (
      eventType === "room_updated" ||
      eventType === "playback_updated" ||
      eventType === "playback_changed" ||
      eventType === "play" ||
      eventType === "pause" ||
      eventType === "seek" ||
      eventType === "select_movie" ||
      eventType === "select_episode" ||
      eventType === "sync_state"
    ) {
      this._applyRoomPatchEvent(payload);
      return;
    }

    if (eventType === "chat_message") {
      this._applyChatMessageEvent(payload);
      return;
    }

    if (eventType === "poll_created" || eventType === "poll_voted") {
      this._applyPollEvent(payload);
    }
  }

  _applyMemberJoinedEvent(payload) {
    const fallbackMembers = Array.isArray(this._roomData.members)
      ? this._roomData.members
      : [];
    const nextMember = mapRoomMembers(
      [payload.member || payload.user || payload],
      fallbackMembers,
      this._roomData.viewer,
    )[0];

    if (!nextMember) {
      return;
    }

    const nextMembers = upsertRoomMember(fallbackMembers, nextMember);

    this._roomData = applyViewerToRoom(
      {
        ...this._roomData,
        members: nextMembers,
      },
      this._roomData.viewer,
    );
    saveLocalWatchPartyRoom(this._roomData);
    this._refreshView({
      roomStatusMessage: `${nextMember.name} присоединился к комнате.`,
      roomStatusTone: "info",
    });
  }

  _applyMemberLeftEvent(payload) {
    const memberId = normalizeText(
      payload?.member?.user_id ||
        payload?.member?.userId ||
        payload?.actor_user_id ||
        payload?.actorUserId ||
        payload?.user_id ||
        payload?.userId,
    );

    if (!memberId) {
      return;
    }

    const nextMembers = (Array.isArray(this._roomData.members)
      ? this._roomData.members
      : []
    ).filter((member) => {
      return normalizeText(member.userId || member.id) !== memberId;
    });

    this._roomData = applyViewerToRoom(
      {
        ...this._roomData,
        members: nextMembers,
      },
      this._roomData.viewer,
    );
    saveLocalWatchPartyRoom(this._roomData);
    this._refreshView({
      roomStatusMessage: "Состав участников обновлен.",
      roomStatusTone: "info",
    });
  }

  _applyRoomPatchEvent(payload) {
    const eventType = normalizeText(payload?.type).toLowerCase();
    console.debug("[watch-party][room] ws/applyRoomPatchEvent", {
      eventType,
      payload,
    });
    const hadMovieSelection = hasRoomMovieSelection(this._roomData);
    const previousRoomData = this._roomData;
    const roomPatch = payload.room || payload.state || {};
    const playbackSource = payload.playback || roomPatch.playback || {};
    const playbackPatch = {
      ...playbackSource,
      movie_id:
        playbackSource.movie_id ??
        playbackSource.movieId ??
        payload.movie_id ??
        payload.movieId,
      episode_id:
        playbackSource.episode_id ??
        playbackSource.episodeId ??
        payload.episode_id ??
        payload.episodeId,
      position_seconds:
        playbackSource.position_seconds ??
        playbackSource.positionSeconds ??
        payload.position_seconds ??
        payload.positionSeconds,
      duration_seconds:
        playbackSource.duration_seconds ??
        playbackSource.durationSeconds ??
        payload.duration_seconds ??
        payload.durationSeconds,
      playback_url:
        playbackSource.playback_url ??
        playbackSource.playbackUrl ??
        payload.playback_url ??
        payload.playbackUrl,
      status:
        playbackSource.status ||
        resolvePlaybackStatusFromEventType(eventType) ||
        payload.status,
    };
    const shouldHydrateMovie =
      hasPlaybackMovieSelection(playbackPatch) ||
      hasPlaybackMovieSelection(roomPatch.playback);

    const nextMappedRoom = mapRoomDtoToViewModel(
      {
        ...roomPatch,
        id: roomPatch.id || roomPatch.room_id || this._roomData.id,
        playback: playbackPatch,
        members:
          roomPatch.members || roomPatch.participants || this._roomData.members,
        messages: roomPatch.messages || this._roomData.messages,
        polls: roomPatch.polls,
      },
      this._roomData,
      this._roomData.viewer,
    );

    this._roomData = applyViewerToRoom(
      {
        ...nextMappedRoom,
        messages: mergeRoomFeedItems(
          nextMappedRoom.messages,
          this._roomData.messages,
        ),
      },
      this._roomData.viewer,
    );
    saveLocalWatchPartyRoom(this._roomData);
    const hasMovieSelectionNow = hasRoomMovieSelection(this._roomData);
    const shouldRefreshStructure = shouldRefreshRoomStructure(
      previousRoomData,
      this._roomData,
    );
    const shouldSoftSyncPlayer =
      isPlaybackEventType(eventType) &&
      !shouldRefreshStructure &&
      hadMovieSelection &&
      hasMovieSelectionNow &&
      Boolean(this.getChild("watch-party-room-player"));

    if (shouldSoftSyncPlayer) {
      this._syncCurrentRoomPlayerState(eventType);
      this._refreshRoomChrome({
        roomStatusMessage: "",
      });
    } else {
      this._roomPlayerSnapshot = null;
      this._refreshView({
        roomStatusMessage: "Состояние комнаты обновлено.",
        roomStatusTone: "info",
      });
    }

    if (shouldHydrateMovie) {
      void this._hydrateRoomMovieSelection();
    }
  }

  _applyChatMessageEvent(payload) {
    const messageItem = mapRoomMessages([payload?.message]).at(0);

    if (!messageItem) {
      return;
    }

    this._roomData = {
      ...this._roomData,
      messages: upsertRoomFeedItem(this._roomData.messages, messageItem),
    };
    saveLocalWatchPartyRoom(this._roomData);
    this._refreshRoomChat({
      activePanel: "chat",
      roomStatusMessage: "",
    });
  }

  _applyPollEvent(payload) {
    const pollPayload =
      payload?.poll && typeof payload.poll === "object"
        ? {
            ...payload.poll,
            id:
              payload.poll.id ||
              payload.poll.poll_id ||
              payload.poll.pollId ||
              payload.poll_id ||
              payload.pollId ||
              payload?.vote?.poll_id ||
              payload?.vote?.pollId,
          }
        : payload;
    const pollItem = mapRoomPolls([pollPayload]).at(0);

    if (!pollItem) {
      return;
    }

    const selectedOptionId =
      normalizeText(payload?.vote?.option_id || payload?.vote?.optionId) || "";
    const voteBelongsToViewer =
      selectedOptionId && isPollVoteFromCurrentViewer(payload?.vote, this._roomData.viewer);
    const pollWithVoteCounts = selectedOptionId
      ? applyPollVoteCount(
          pollItem,
          selectedOptionId,
          this._roomData.messages,
          { incrementLocalCount: !voteBelongsToViewer },
        )
      : pollItem;
    const nextPoll = voteBelongsToViewer
      ? markPollSelection(pollWithVoteCounts, selectedOptionId)
      : applyLocalPollSelections(
          [clearPollSelection(pollWithVoteCounts)],
          this._roomData.messages,
        )[0];

    this._roomData = {
      ...this._roomData,
      messages: upsertRoomFeedItem(this._roomData.messages, nextPoll),
    };
    saveLocalWatchPartyRoom(this._roomData);
    this._refreshRoomChat({
      activePanel: "chat",
      roomStatusMessage: "",
    });
  }

  async _hydrateRoomMovieSelection() {
    const movieId = normalizeText(this._roomData.playerSource?.movieId);

    if (!movieId) {
      return;
    }

    if (normalizeText(this._roomData.selectedMovie?.id) === movieId) {
      return;
    }

    const result = await movieService.getMovieById(movieId);

    if (!result.ok) {
      return;
    }

    const selectedMovie = mapMovieDtoToRoomSelection(extractMovie(result.resp));

    if (!selectedMovie) {
      return;
    }

    const selectedEpisodeId = normalizeText(this._roomData.playerSource?.episodeId);
    const resolvedEpisode =
      selectedMovie.episodes.find((episode) => {
        return normalizeText(episode.id) === selectedEpisodeId;
      }) || selectedMovie.episodes[0];

    this._roomData = applySelectedMovieToRoom(
      this._roomData,
      selectedMovie,
      resolvedEpisode,
    );
    saveLocalWatchPartyRoom(this._roomData);

    if (this._contextLoaded) {
      this._roomPlayerSnapshot = null;
      this._refreshView({
        roomStatusMessage: this._uiState.roomStatusMessage,
        roomStatusTone: this._uiState.roomStatusTone,
      });
    }
  }

  async _handleRoomPlayerPlaybackEvent(payload) {
    if (this._mode !== "room" || this._suppressRoomPlaybackEvents) {
      return;
    }

    const eventType = normalizeText(payload?.type).toLowerCase();

    if (!eventType) {
      return;
    }

    const roomMovieId = normalizeText(this._roomData.playerSource?.movieId);
    const nextEpisodeId = normalizeText(
      payload?.episodeId || payload?.activeEpisodeId || this._roomData.playerSource?.episodeId,
    );
    const positionSeconds = Math.max(0, Number(payload?.positionSeconds) || 0);
    const durationSeconds = Math.max(0, Number(payload?.durationSeconds) || 0);
    const playbackUrl = normalizeText(payload?.playbackUrl);

    if (eventType === "episode_loaded") {
      const resolvedMovie = this._roomData.selectedMovie;
      const resolvedEpisode = resolvedMovie?.episodes?.find((episode) => {
        return normalizeText(episode.id) === nextEpisodeId;
      });

      this._roomData = applySelectedMovieToRoom(
        this._roomData,
        resolvedMovie,
        resolvedEpisode,
        {
          playbackUrl,
          durationSeconds,
          positionSeconds,
          isPlaying: false,
        },
      );
      saveLocalWatchPartyRoom(this._roomData);
      await this._persistRoomPlaybackAction("sync_state", {
        movie_id: roomMovieId,
        episode_id: nextEpisodeId,
        playback_url: playbackUrl,
        duration_seconds: durationSeconds,
        position_seconds: positionSeconds,
        status: "paused",
      });
      return;
    }

    if (eventType === "play" || eventType === "pause" || eventType === "seek") {
      this._roomData = applyPlaybackStateToRoom(this._roomData, {
        episode_id: nextEpisodeId,
        position_seconds: positionSeconds,
        duration_seconds: durationSeconds,
        status: eventType === "seek" ? this._roomData.player?.isPlaying ? "playing" : "paused" : eventType,
      });
      saveLocalWatchPartyRoom(this._roomData);
      await this._persistRoomPlaybackAction(eventType, {
        position_seconds: positionSeconds,
        duration_seconds: durationSeconds,
        status:
          eventType === "play"
            ? "playing"
            : eventType === "pause"
              ? "paused"
              : undefined,
      });
    }
  }

  async _persistRoomPlaybackAction(action, payload = {}) {
    const roomId = normalizeText(this._roomData.id);

    if (!roomId || !action) {
      return;
    }

    const result = await watchPartyService.sendRoomAction(
      roomId,
      buildRoomActionPayload(action, payload),
    );

    if (!result.ok) {
      this._setRoomStatus(
        result.error || "Не удалось синхронизировать состояние комнаты.",
        "warning",
      );
      return;
    }

    if (result.resp?.playback) {
      this._roomData = applyPlaybackStateToRoom(this._roomData, result.resp.playback);
      saveLocalWatchPartyRoom(this._roomData);
    }
  }

  _syncCurrentRoomPlayerState(eventType = "") {
    const player = this.getChild("watch-party-room-player");

    if (!player || !hasRoomMovieSelection(this._roomData)) {
      return;
    }

    console.debug("[watch-party][room] syncCurrentRoomPlayerState", {
      roomId: this._roomData.id,
      episodeId: normalizeText(this._roomData.playerSource?.episodeId),
      positionSeconds: normalizeCount(this._roomData.playerSource?.positionSeconds),
      status: this._roomData.player?.isPlaying ? "playing" : "paused",
    });
    const normalizedEventType = normalizeText(eventType).toLowerCase();
    const positionSeconds = normalizeCount(this._roomData.playerSource?.positionSeconds);
    const episodeId = normalizeText(this._roomData.playerSource?.episodeId);
    const status = this._roomData.player?.isPlaying ? "playing" : "paused";

    if (
      episodeId &&
      episodeId !== normalizeText(player.context?.activeEpisodeId)
    ) {
      player.applyExternalPlaybackState({
        episodeId,
        positionSeconds,
        status,
      });
      return;
    }

    if (normalizedEventType === "seek") {
      player.seekToExternal(positionSeconds);
      return;
    }

    if (normalizedEventType === "pause") {
      player.pauseExternal(positionSeconds);
      return;
    }

    if (normalizedEventType === "play") {
      player.playExternal(positionSeconds);
      return;
    }

    player.applyExternalPlaybackState({
      episodeId,
      positionSeconds,
      status,
    });
  }
}

function buildPageContext({ mode, overviewData, roomData, uiState }) {
  if (mode === "room") {
    return buildRoomContext(roomData, uiState);
  }

  return buildLobbyContext(overviewData, uiState);
}

function buildRoomActionPayload(action, payload = {}) {
  const normalizedAction = normalizeText(action).toLowerCase();
  const nextPayload = {
    action: normalizedAction,
  };
  const movieId = normalizeNumericIdentifier(payload.movie_id ?? payload.movieId);
  const episodeId = normalizeNumericIdentifier(
    payload.episode_id ?? payload.episodeId,
  );
  const playbackUrl = normalizeText(payload.playback_url ?? payload.playbackUrl);
  const durationSeconds = normalizeNonNegativeInteger(
    payload.duration_seconds ?? payload.durationSeconds,
  );
  const positionSeconds = normalizeNonNegativeInteger(
    payload.position_seconds ?? payload.positionSeconds,
  );
  const status = normalizeText(payload.status).toLowerCase();

  if (movieId !== null) {
    nextPayload.movie_id = movieId;
  }

  if (episodeId !== null) {
    nextPayload.episode_id = episodeId;
  }

  if (playbackUrl) {
    nextPayload.playback_url = playbackUrl;
  }

  if (durationSeconds !== null) {
    nextPayload.duration_seconds = durationSeconds;
  }

  if (positionSeconds !== null) {
    nextPayload.position_seconds = positionSeconds;
  }

  if (status) {
    nextPayload.status = status;
  }

  return nextPayload;
}

function buildLobbyContext(pageData, uiState) {
  const selectedVisibilityOption =
    pageData.visibilityOptions.find((item) => item.selected) ||
    pageData.visibilityOptions[0] || {
      value: "private",
      label: "Только по ссылке",
    };
  const heroPostersDisplay =
    pageData.heroPosters.length === 1
      ? [
          ...pageData.heroPosters,
          {
            id: "create-room-hero-placeholder",
            isHeroCreateRoomPlaceholder: true,
          },
        ]
      : pageData.heroPosters;

  return {
    ...HERO_COPY,
    isRoomView: false,
    isLoading: Boolean(uiState.isLoading),
    errorMessage: uiState.errorMessage || "",
    statusMessage: uiState.statusMessage || "",
    statusTone: uiState.statusTone || "info",
    isVisibilityMenuOpen: Boolean(uiState.isVisibilityMenuOpen),
    visibilitySelectedValue:
      uiState.visibilitySelectedValue || selectedVisibilityOption.value,
    visibilitySelectedLabel:
      uiState.visibilitySelectedLabel || selectedVisibilityOption.label,
    featuredRoomsOnlineLabel: `${pageData.featuredRooms.length} ${pluralizeRooms(pageData.featuredRooms.length)} онлайн`,
    featuredRoomsUnavailableText: "Список комнат пуст.",
    myRoomsCountLabel: `${pageData.myRooms.length} ${pluralizeRooms(pageData.myRooms.length)}`,
    heroPosters: pageData.heroPosters,
    heroPostersDisplay,
    visibilityOptions: pageData.visibilityOptions,
    featuredRooms: pageData.featuredRooms,
    myRooms: pageData.myRooms,
  };
}

function buildRoomContext(roomData, uiState) {
  const chatContext = buildRoomChatContext(roomData, uiState);
  const inviteLink = absolutizeRoomLink(roomData.inviteLink);
  const canInviteFriends = Boolean(
    inviteLink && isCurrentViewerRoomHost(roomData),
  );

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
    inviteLink,
    canInviteFriends,
    isInviteModalOpen: Boolean(uiState.isInviteModalOpen),
    inviteFriendsLoading: Boolean(uiState.inviteFriendsLoading),
    inviteFriendsError: uiState.inviteFriendsError || "",
    inviteFriends: buildInviteFriendsViewModels(
      uiState.inviteFriends,
      roomData,
      uiState,
    ),
    hostName: roomData.hostName,
    liveLabel: roomData.liveLabel,
    hasRoomMovieSelection: hasRoomMovieSelection(roomData),
    topMovieCandidatesLoading: Boolean(uiState.topMovieCandidatesLoading),
    topMovieCandidatesError: uiState.topMovieCandidatesError || "",
    topMovieCandidates: Array.isArray(uiState.topMovieCandidates)
      ? uiState.topMovieCandidates
      : [],
    viewer: roomData.viewer,
    movie: roomData.movie,
    roomMembersCount: roomData.members.length,
    roomMessagesCount: chatContext.roomMessages.length,
    members: roomData.members,
    roomNote: roomData.roomNote,
  };
}

function buildRoomChatContext(roomData, uiState) {
  const roomMessages = prependWatchPartyGreeting(roomData.messages);

  return {
    isBetComposerOpen: Boolean(uiState.isBetComposerOpen),
    roomBetComposerOptions: buildComposerOptions(
      uiState.betComposerOptionCount,
    ),
    roomMessages: roomMessages.map((message) => {
      return decorateRoomMessage(message);
    }),
  };
}

function buildRoomPlayerMovieData(roomData = {}) {
  const selectedMovie = roomData.selectedMovie;

  if (
    selectedMovie &&
    Array.isArray(selectedMovie.episodes) &&
    selectedMovie.episodes.length
  ) {
    const normalizedEpisodes = selectedMovie.episodes.map((episode) => ({
      id: normalizeText(episode.id),
      title: normalizeText(episode.title) || selectedMovie.title,
      description:
        normalizeText(episode.description) || selectedMovie.description || "",
      durationSeconds: normalizeCount(episode.durationSeconds),
      imgUrl:
        normalizeText(episode.imgUrl) ||
        normalizeText(selectedMovie.posterUrl) ||
        "/img/cards/interstellar.webp",
      playbackUrl: normalizeText(episode.playbackUrl),
      playbackPositionSeconds: normalizeCount(episode.positionSeconds),
      isDirectPlayback: Boolean(normalizeText(episode.playbackUrl)),
      seasonNumber: normalizeCount(episode.seasonNumber) || 1,
      episodeNumber: normalizeCount(episode.episodeNumber) || 1,
    }));

    return {
      id: normalizeText(selectedMovie.id) || normalizeText(roomData.id),
      title: normalizeText(selectedMovie.title) || "Видео",
      description:
        normalizeText(selectedMovie.description) ||
        normalizeText(roomData.movie?.subtitle) ||
        roomData.roomNote,
      contentType: normalizeText(selectedMovie.contentType) || "watch-party",
      posterUrl:
        normalizeText(selectedMovie.posterUrl) ||
        normalizeText(roomData.movie?.backdropUrl) ||
        "/img/cards/interstellar.webp",
      isDirectPlayback:
        normalizedEpisodes.length === 1 && normalizedEpisodes[0].isDirectPlayback,
      initialEpisodeId:
        normalizeText(roomData.playerSource?.episodeId) ||
        normalizeText(normalizedEpisodes[0]?.id),
      episodes: normalizedEpisodes,
    };
  }

  if (!hasRoomMovieSelection(roomData)) {
    return null;
  }

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
    contentType: normalizeText(roomData.movie?.contentType) || "watch-party",
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
  const featuredRoomItems = readArray(normalizedOverview, [
    "featuredRooms",
    "featured_rooms",
    "onlineRooms",
    "online_rooms",
    "active_rooms",
    "rooms",
  ]);
  const heroPosterItems = readArray(normalizedOverview, [
    "heroPosters",
    "hero_posters",
    "posters",
  ]);

  return {
    heroPosters: mapHeroPosters(
      heroPosterItems,
      Array.isArray(featuredRoomItems) && featuredRoomItems.length
        ? mapHeroPostersFromRooms(featuredRoomItems, fallbackData.heroPosters)
        : fallbackData.heroPosters,
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
      featuredRoomItems,
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
  const playbackDto =
    normalizedRoomDto.playback &&
    typeof normalizedRoomDto.playback === "object" &&
    !Array.isArray(normalizedRoomDto.playback)
      ? normalizedRoomDto.playback
      : normalizedRoomDto.player &&
          typeof normalizedRoomDto.player === "object" &&
          !Array.isArray(normalizedRoomDto.player)
        ? normalizedRoomDto.player
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
        normalizedRoomDto.status ??
        playbackDto.status,
      fallbackRoom.liveLabel,
    ),
    privacyLabel:
      resolveVisibilityLabelText(
        normalizedRoomDto.privacyLabel ||
          normalizedRoomDto.privacy_label ||
          normalizedRoomDto.visibilityLabel ||
          normalizedRoomDto.visibility_label ||
          normalizedRoomDto.visibility,
        fallbackRoom.privacyLabel,
      ),
    inviteLink:
      resolveInviteLink(
        normalizedRoomDto.inviteLink ||
          normalizedRoomDto.invite_link ||
          normalizedRoomDto.shareUrl ||
          normalizedRoomDto.share_url ||
          normalizedRoomDto.joinUrl ||
          normalizedRoomDto.join_url ||
          normalizedRoomDto.roomLink ||
          normalizedRoomDto.room_link,
        fallbackRoom.inviteLink,
      ),
    hostName:
      normalizeText(
        normalizedRoomDto.hostName ||
          normalizedRoomDto.host_name ||
          normalizedRoomDto.ownerName ||
          normalizedRoomDto.owner_name,
      ) ||
      resolveHostNameFromMembers(
        readArray(normalizedRoomDto, ["members", "participants", "users"]),
      ) ||
      fallbackRoom.hostName,
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
      contentType:
        normalizeText(
          normalizedRoomDto.movie?.contentType ||
            normalizedRoomDto.movie?.content_type ||
            normalizedRoomDto.contentType ||
            normalizedRoomDto.content_type,
        ) || fallbackRoom.movie.contentType,
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
        playbackDto.isPlaying ??
          playbackDto.playing ??
          (normalizeText(playbackDto.status).toLowerCase() === "playing"
            ? true
            : undefined) ??
          fallbackRoom.player.isPlaying,
      ),
      progressPercent: clampPercent(
        playbackDto.progressPercent ??
          playbackDto.progress_percent ??
          normalizedRoomDto.progressPercent ??
          fallbackRoom.player.progressPercent,
      ),
      currentTimeLabel:
        normalizeText(
          playbackDto.currentTimeLabel ||
            playbackDto.current_time_label ||
            normalizedRoomDto.currentTimeLabel ||
            normalizedRoomDto.current_time_label,
        ) ||
        formatDurationLabel(
          playbackDto.positionSeconds ?? playbackDto.position_seconds,
        ) ||
        fallbackRoom.player.currentTimeLabel,
      totalTimeLabel:
        normalizeText(
          playbackDto.totalTimeLabel ||
            playbackDto.total_time_label ||
            normalizedRoomDto.totalTimeLabel ||
            normalizedRoomDto.total_time_label,
        ) ||
        formatDurationLabel(
          playbackDto.durationSeconds ?? playbackDto.duration_seconds,
        ) ||
        fallbackRoom.player.totalTimeLabel,
      volumePercent: clampPercent(
        playbackDto.volumePercent ??
          playbackDto.volume_percent ??
          fallbackRoom.player.volumePercent,
      ),
      qualityLabel:
        normalizeText(
          playbackDto.qualityLabel || playbackDto.quality_label,
        ) || fallbackRoom.player.qualityLabel,
      syncLabel:
        normalizeText(
          playbackDto.syncLabel || playbackDto.sync_label,
        ) || fallbackRoom.player.syncLabel,
    },
    playerSource: {
      ...(fallbackRoom.playerSource || {}),
      movieId:
        normalizeText(
          playbackDto.movieId ||
            playbackDto.movie_id ||
            normalizedRoomDto.movie?.id ||
            normalizedRoomDto.movie_id ||
            normalizedRoomDto.movieId,
        ) || normalizeText(fallbackRoom.playerSource?.movieId),
      episodeId:
        normalizeText(
          playbackDto.episodeId ||
            playbackDto.episode_id ||
            normalizedRoomDto.episodeId ||
            normalizedRoomDto.episode_id,
        ) || normalizeText(fallbackRoom.playerSource?.episodeId),
      playbackUrl:
        normalizeText(
          playbackDto.playbackUrl ||
            playbackDto.playback_url ||
            normalizedRoomDto.playbackUrl ||
            normalizedRoomDto.playback_url,
        ) || normalizeText(fallbackRoom.playerSource?.playbackUrl),
      durationSeconds:
        Number(
          playbackDto.durationSeconds ??
            playbackDto.duration_seconds ??
            normalizedRoomDto.durationSeconds ??
            normalizedRoomDto.duration_seconds ??
            fallbackRoom.playerSource?.durationSeconds,
        ) || 0,
      positionSeconds:
        Number(
          playbackDto.positionSeconds ??
            playbackDto.position_seconds ??
            normalizedRoomDto.positionSeconds ??
            normalizedRoomDto.position_seconds ??
            fallbackRoom.playerSource?.positionSeconds,
        ) || 0,
      episodeTitle:
        normalizeText(
          playbackDto.episodeTitle ||
            playbackDto.episode_title ||
            normalizedRoomDto.episodeTitle ||
            normalizedRoomDto.episode_title,
        ) ||
        normalizeText(fallbackRoom.playerSource?.episodeTitle) ||
        fallbackRoom.movie.title,
      description:
        normalizeText(
          playbackDto.description ||
            normalizedRoomDto.player_description,
        ) ||
        normalizeText(fallbackRoom.playerSource?.description) ||
        fallbackRoom.movie.subtitle,
      posterUrl:
        normalizeText(
          playbackDto.posterUrl || playbackDto.poster_url,
        ) ||
        normalizeText(fallbackRoom.playerSource?.posterUrl) ||
        fallbackRoom.movie.backdropUrl,
    },
    selectedMovie: fallbackRoom.selectedMovie || null,
    viewer: fallbackRoom.viewer,
    members: mapRoomMembers(
      readArray(normalizedRoomDto, ["members", "participants", "users"]),
      fallbackRoom.members,
      viewer,
    ),
    messages: applyLocalPollSelections(
      mapRoomFeed(normalizedRoomDto, fallbackRoom.messages),
      fallbackRoom.messages,
    ),
  };

  if (
    !normalizeText(mappedRoom.progressLabel) &&
    normalizeCount(mappedRoom.playerSource.positionSeconds) > 0
  ) {
    mappedRoom.progressLabel = formatDurationLabel(
      mappedRoom.playerSource.positionSeconds,
    );
  }

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
  const viewerId = normalizeText(viewer.id || viewer.userId);
  const viewerEmail = normalizeText(viewer.email).toLowerCase();
  const viewerName = normalizeText(viewer.name).toLowerCase();
  const youIndex = members.findIndex((member) => {
    const memberId = normalizeText(member?.userId || member?.id);
    const memberName = normalizeText(member?.name).toLowerCase();
    const memberEmail = normalizeText(member?.email || member?.name).toLowerCase();

    if (member.isYou) {
      return true;
    }

    if (viewerId && memberId) {
      return viewerId === memberId;
    }

    if (viewerEmail && memberEmail) {
      return viewerEmail === memberEmail;
    }

    return Boolean(viewerName && memberName && viewerName === memberName);
  });

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
        id: normalizeText(member.id) || viewerId || "viewer",
        userId: normalizeText(member.userId) || viewerId || "",
        email: normalizeText(member.email) || normalizeText(viewer.email),
        name: viewer.name,
        initial: viewer.initial,
        avatarTint: viewer.avatarTint,
        isYou: true,
      };
    });
  }

  nextRoom.members = dedupeRoomMembers(nextRoom.members, viewer);
  nextRoom.participantsCount = nextRoom.members.length;
  nextRoom.participantsLabel = `${nextRoom.members.length} ${pluralizeParticipants(nextRoom.members.length)}`;

  return nextRoom;
}

function applySelectedMovieToRoom(
  roomData,
  selectedMovie,
  selectedEpisode = null,
  playbackOverride = {},
) {
  if (!selectedMovie) {
    return roomData;
  }

  const resolvedEpisode =
    selectedEpisode ||
    selectedMovie.episodes?.find((episode) => {
      return (
        normalizeText(episode.id) ===
        normalizeText(roomData.playerSource?.episodeId)
      );
    }) ||
    selectedMovie.episodes?.[0] ||
    null;

  return applyPlaybackStateToRoom(
    {
      ...roomData,
      movie: {
        ...roomData.movie,
        title: selectedMovie.title || roomData.movie?.title,
        contentType: selectedMovie.contentType || roomData.movie?.contentType,
        subtitle:
          selectedMovie.subtitle ||
          selectedMovie.description ||
          roomData.movie?.subtitle,
        backdropUrl:
          selectedMovie.backdropUrl ||
          selectedMovie.posterUrl ||
          roomData.movie?.backdropUrl,
      },
      selectedMovie,
    },
    {
      movie_id: selectedMovie.id,
      episode_id: resolvedEpisode?.id || roomData.playerSource?.episodeId,
      playback_url:
        playbackOverride.playbackUrl ?? resolvedEpisode?.playbackUrl ?? "",
      duration_seconds:
        playbackOverride.durationSeconds ?? resolvedEpisode?.durationSeconds ?? 0,
      position_seconds: playbackOverride.positionSeconds ?? 0,
      status: playbackOverride.isPlaying ? "playing" : "paused",
      episode_title: resolvedEpisode?.title || "",
      description: resolvedEpisode?.description || selectedMovie.description || "",
      poster_url: resolvedEpisode?.imgUrl || selectedMovie.posterUrl || "",
    },
  );
}

function applyPlaybackStateToRoom(roomData, playbackPatch = {}) {
  const normalizedPatch =
    playbackPatch && typeof playbackPatch === "object" ? playbackPatch : {};
  const nextPositionSeconds = Math.max(
    0,
    Number(
      normalizedPatch.position_seconds ?? normalizedPatch.positionSeconds,
    ) || 0,
  );
  const nextDurationSeconds = Math.max(
    0,
    Number(
      normalizedPatch.duration_seconds ?? normalizedPatch.durationSeconds,
    ) || 0,
  );
  const nextStatus = normalizeText(
    normalizedPatch.status || normalizedPatch.action,
  ).toLowerCase();
  const nextEpisodeId = normalizeText(
    normalizedPatch.episode_id || normalizedPatch.episodeId,
  );
  const nextMovieId = normalizeText(
    normalizedPatch.movie_id || normalizedPatch.movieId,
  );
  const isPlaying = nextStatus === "playing";

  return {
    ...roomData,
    progressLabel: formatDurationLabel(nextPositionSeconds) || roomData.progressLabel,
    player: {
      ...(roomData.player || {}),
      isPlaying,
      currentTimeLabel:
        formatDurationLabel(nextPositionSeconds) ||
        roomData.player?.currentTimeLabel ||
        "0:00",
      totalTimeLabel:
        formatDurationLabel(nextDurationSeconds) ||
        roomData.player?.totalTimeLabel ||
        "0:00",
      progressPercent:
        nextDurationSeconds > 0
          ? clampPercent((nextPositionSeconds / nextDurationSeconds) * 100)
          : roomData.player?.progressPercent || 0,
    },
    playerSource: {
      ...(roomData.playerSource || {}),
      movieId: nextMovieId || roomData.playerSource?.movieId || "",
      episodeId: nextEpisodeId || roomData.playerSource?.episodeId || "",
      playbackUrl:
        normalizeText(
          normalizedPatch.playback_url || normalizedPatch.playbackUrl,
        ) || roomData.playerSource?.playbackUrl || "",
      durationSeconds:
        nextDurationSeconds || roomData.playerSource?.durationSeconds || 0,
      positionSeconds: nextPositionSeconds,
      episodeTitle:
        normalizeText(
          normalizedPatch.episode_title || normalizedPatch.episodeTitle,
        ) || roomData.playerSource?.episodeTitle || roomData.movie?.title,
      description:
        normalizeText(normalizedPatch.description) ||
        roomData.playerSource?.description ||
        roomData.movie?.subtitle,
      posterUrl:
        normalizeText(
          normalizedPatch.poster_url || normalizedPatch.posterUrl,
        ) || roomData.playerSource?.posterUrl || roomData.movie?.backdropUrl,
    },
  };
}

function upsertRoomFeedItem(items, nextItem) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const nextKey = getRoomFeedItemKey(nextItem);

  if (!nextKey) {
    return normalizedItems;
  }

  const existingIndex = normalizedItems.findIndex((item) => {
    return getRoomFeedItemKey(item) === nextKey;
  });
  const itemsWithoutExactMatch =
    existingIndex === -1
      ? normalizedItems
      : normalizedItems.filter((_, index) => index !== existingIndex);
  const duplicateIndex = itemsWithoutExactMatch.findIndex((item) => {
    return isSameRoomFeedItem(item, nextItem);
  });

  if (duplicateIndex === -1) {
    return [...itemsWithoutExactMatch, nextItem].sort(compareRoomFeedItems);
  }

  return itemsWithoutExactMatch
    .map((item, index) => (index === duplicateIndex ? nextItem : item))
    .sort(compareRoomFeedItems);
}

function mergeRoomFeedItems(preferredItems = [], fallbackItems = []) {
  const nextItems = Array.isArray(preferredItems) ? preferredItems : [];
  const previousItems = Array.isArray(fallbackItems) ? fallbackItems : [];
  let mergedItems = nextItems.slice();

  previousItems.forEach((item) => {
    if (!item) {
      return;
    }

    if (mergedItems.some((candidate) => isSameRoomFeedItem(candidate, item))) {
      return;
    }

    mergedItems.push(item);
  });

  return mergedItems.sort(compareRoomFeedItems);
}

function applyLocalPollSelections(items, fallbackItems) {
  const normalizedItems = Array.isArray(items) ? items : [];
  const localPolls = Array.isArray(fallbackItems)
    ? fallbackItems.filter((item) => item?.isBet)
    : [];

  if (!localPolls.length) {
    return normalizedItems;
  }

  return normalizedItems.map((item) => {
    if (!item?.isBet || resolveSelectedPollOptionFromItem(item)) {
      return item;
    }

    const localPoll = localPolls.find((candidate) => {
      return isSameRoomFeedItem(candidate, item);
    });
    const selectedOptionId = resolveSelectedPollOptionFromItem(localPoll);

    return selectedOptionId ? markPollSelection(item, selectedOptionId) : item;
  });
}

function clearPollSelection(pollItem) {
  if (!pollItem?.isBet) {
    return pollItem;
  }

  return {
    ...pollItem,
    selectionText: "",
    options: Array.isArray(pollItem.options)
      ? pollItem.options.map((option) => ({
          ...option,
          isSelected: false,
        }))
      : [],
  };
}

function applyPollVoteCount(
  pollItem,
  optionId,
  previousItems,
  { incrementLocalCount = true } = {},
) {
  const normalizedOptionId = normalizeText(optionId);

  if (!pollItem?.isBet || !normalizedOptionId) {
    return pollItem;
  }

  const previousPoll = Array.isArray(previousItems)
    ? previousItems.find((item) => isSameRoomFeedItem(item, pollItem))
    : null;
  const nextOptions = Array.isArray(pollItem.options)
    ? pollItem.options.map((option) => {
        const isVotedOption = normalizeText(option.id) === normalizedOptionId;
        const previousOption = findMatchingPollOption(
          previousPoll?.options,
          option,
        );
        const serverVotes = normalizeCount(option.votes);
        const previousVotes = normalizeCount(previousOption?.votes);
        const optimisticVotes = isVotedOption
          ? incrementLocalCount
            ? previousVotes + 1
            : Math.max(previousVotes, 1)
          : previousVotes;

        return {
          ...option,
          votes: Math.max(serverVotes, optimisticVotes),
        };
      })
    : [];

  return {
    ...pollItem,
    voteCount: Math.max(normalizeCount(pollItem.voteCount), sumOptionVotes(nextOptions)),
    options: nextOptions,
  };
}

function findMatchingPollOption(options, targetOption) {
  if (!Array.isArray(options) || !targetOption) {
    return null;
  }

  const targetId = normalizeText(targetOption.id);
  const targetLabel = normalizeText(targetOption.label);

  return (
    options.find((option) => normalizeText(option?.id) === targetId) ||
    options.find((option) => normalizeText(option?.label) === targetLabel) ||
    null
  );
}

function resolveSelectedPollOptionFromItem(item) {
  if (!item?.isBet || !Array.isArray(item.options)) {
    return "";
  }

  const selectedOption = item.options.find((option) => option?.isSelected);
  return normalizeText(selectedOption?.id);
}

function isSameRoomFeedItem(left, right) {
  if (!left || !right) {
    return false;
  }

  const leftKey = getRoomFeedItemKey(left);
  const rightKey = getRoomFeedItemKey(right);

  if (leftKey && rightKey && leftKey === rightKey) {
    return true;
  }

  if (!left.isBet || !right.isBet) {
    return false;
  }

  return (
    normalizeText(left.question) === normalizeText(right.question) &&
    buildPollOptionsSignature(left.options) ===
      buildPollOptionsSignature(right.options)
  );
}

function buildPollOptionsSignature(options = []) {
  if (!Array.isArray(options)) {
    return "";
  }

  return options
    .map((option) => normalizeText(option?.label))
    .filter(Boolean)
    .join("|");
}

function getRoomFeedItemKey(item) {
  if (!item) {
    return "";
  }

  const normalizedId = normalizeText(item.id);

  if (!normalizedId) {
    return "";
  }

  return `${item.isBet ? "poll" : "message"}:${normalizedId}`;
}

function markPollSelection(pollItem, optionId) {
  const normalizedOptionId = normalizeText(optionId);
  const options = Array.isArray(pollItem.options)
    ? pollItem.options.map((option) => {
        const isSelected = normalizeText(option.id) === normalizedOptionId;

        return {
          ...option,
          votes: isSelected
            ? Math.max(normalizeCount(option.votes), 1)
            : normalizeCount(option.votes),
          isSelected,
        };
      })
    : [];
  const voteCount = Math.max(
    normalizeCount(pollItem.voteCount),
    sumOptionVotes(options),
    normalizedOptionId ? 1 : 0,
  );

  return {
    ...pollItem,
    voteCount,
    metaText: "",
    selectionText: "",
    options,
  };
}

function hasPlaybackMovieSelection(playbackPatch) {
  return Boolean(
    normalizeText(playbackPatch?.movie_id || playbackPatch?.movieId),
  );
}

function isPlaybackEventType(eventType) {
  return [
    "play",
    "pause",
    "seek",
    "sync_state",
    "select_movie",
    "select_episode",
    "playback_updated",
    "playback_changed",
  ].includes(normalizeText(eventType).toLowerCase());
}

function resolvePlaybackStatusFromEventType(eventType) {
  const normalizedType = normalizeText(eventType).toLowerCase();

  if (normalizedType === "play") {
    return "playing";
  }

  if (normalizedType === "pause") {
    return "paused";
  }

  return "";
}

function isCurrentViewerRoomHost(roomData = {}) {
  return Boolean(
    Array.isArray(roomData.members) &&
      roomData.members.some((member) => member.isYou && member.isHost),
  );
}

function findRoomMemberByUserId(roomData = {}, userId = "") {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId || !Array.isArray(roomData.members)) {
    return null;
  }

  return (
    roomData.members.find((member) => {
      return (
        normalizeText(member?.userId || member?.id) === normalizedUserId
      );
    }) || null
  );
}

function shouldRefreshRoomStructure(previousRoomData = {}, nextRoomData = {}) {
  if (hasRoomMovieSelection(previousRoomData) !== hasRoomMovieSelection(nextRoomData)) {
    return true;
  }

  if (
    buildRoomMembersSignature(previousRoomData) !==
    buildRoomMembersSignature(nextRoomData)
  ) {
    return true;
  }

  if (buildRoomFeedSignature(previousRoomData) !== buildRoomFeedSignature(nextRoomData)) {
    return true;
  }

  return (
    normalizeText(previousRoomData.roomName) !== normalizeText(nextRoomData.roomName) ||
    normalizeText(previousRoomData.hostName) !== normalizeText(nextRoomData.hostName) ||
    normalizeText(previousRoomData.movie?.title) !== normalizeText(nextRoomData.movie?.title)
  );
}

function buildRoomMembersSignature(roomData = {}) {
  if (!Array.isArray(roomData.members)) {
    return "";
  }

  return roomData.members
    .map((member) => {
      return [
        normalizeText(member.id || member.userId),
        member.isHost ? "host" : "member",
        member.isYou ? "you" : "",
      ].join(":");
    })
    .join("|");
}

function buildRoomFeedSignature(roomData = {}) {
  if (!Array.isArray(roomData.messages)) {
    return "";
  }

  return roomData.messages
    .map((message) => {
      return [
        normalizeText(message.id),
        message.isBet ? "bet" : "message",
        normalizeCount(message.voteCount),
      ].join(":");
    })
    .join("|");
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
      roomHref:
        normalizeText(item?.roomHref || item?.room_link || item?.roomLink) ||
        "",
    };
  });
}

function mapHeroPostersFromRooms(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.slice(0, 2).map((item) => ({ ...item }));
  }

  return items.slice(0, 2).map((item, index) => {
    const fallback = fallbackItems[index % fallbackItems.length];
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
        fallback?.id,
      title:
        normalizeText(item?.title || item?.name) || fallback?.title || "Комната",
      label:
        normalizeText(item?.host_name || item?.hostName) ||
        (membersCount
          ? `${membersCount} ${pluralizeParticipants(membersCount)}`
          : fallback?.label),
      imageUrl: resolveImageUrl(item, fallback?.imageUrl),
      roomHref: buildWatchPartyRoomPath(
        normalizeText(item?.id || item?.roomId || item?.room_id),
      ),
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
    return fallbackItems.slice(0, 2).map((item, index) => ({
      imageUrl:
        index % 2 === 0 ? "/img/cards/interstellar.webp" : "/img/joker.jpeg",
      ...item,
    }));
  }

  return items.slice(0, 2).map((item, index) => {
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
    const resolvedMembersCount = membersCount || fallback?.membersCount || 0;

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
      membersCount: resolvedMembersCount,
      membersLabel: `${resolvedMembersCount} ${pluralizeParticipants(resolvedMembersCount)}`,
      privacyLabel: resolveVisibilityLabelText(
        item?.privacyLabel ||
          item?.privacy_label ||
          item?.visibilityLabel ||
          item?.visibility_label ||
          item?.visibility,
        fallback?.privacyLabel || "Только по ссылке",
      ),
      progressLabel:
        normalizeText(
          item?.progressLabel || item?.progress_label || item?.currentTimeLabel,
        ) ||
        formatDurationLabel(
          item?.playback?.position_seconds ?? item?.playback?.positionSeconds,
        ) ||
        fallback?.progressLabel ||
        "0:00",
      isLive: resolveLiveLabel(
        item?.live ?? item?.status ?? item?.playback?.status,
        fallback?.isLive ? "LIVE" : "",
      ),
      roomHref:
        resolveInviteLink(
          item?.roomHref ||
            item?.roomLink ||
            item?.room_link ||
            item?.joinUrl ||
            item?.join_url ||
            item?.shareUrl ||
            item?.share_url ||
            item?.inviteLink ||
            item?.invite_link,
        ) || "",
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
        resolveLiveLabel(
          item?.status || item?.live || item?.playback?.status,
          "",
        ) || "Ожидает",
      statusTone:
        resolveLiveLabel(
          item?.status || item?.live || item?.playback?.status,
          "",
        ) === "LIVE"
          ? "live"
          : "waiting",
      meta:
        normalizeText(item?.meta) ||
        `${normalizeText(item?.movieTitle || item?.movie_title || item?.movie?.title) || "Фильм"} · ${participantsCount} ${pluralizeParticipants(participantsCount)}`,
      roomLink:
        resolveInviteLink(
          item?.roomLink ||
            item?.room_link ||
            item?.shareUrl ||
            item?.share_url ||
            item?.joinUrl ||
            item?.join_url ||
            item?.inviteLink ||
            item?.invite_link,
        ) || "",
      imageUrl: resolveImageUrl(item, "/img/65.jpg"),
    };
  });
}

function mapRoomMembers(items, fallbackItems, viewer) {
  if (!Array.isArray(items)) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  if (!items.length) {
    return [];
  }

  return items.map((item, index) => {
    const fallback =
      fallbackItems[index % fallbackItems.length] || fallbackItems[0];
    const name =
      normalizeText(
        item?.display_name ||
          item?.displayName ||
          item?.name ||
          item?.title ||
          item?.username,
      ) ||
      fallback?.name ||
      `Участник ${index + 1}`;
    const userId = normalizeText(item?.user_id || item?.userId || item?.id);
    const viewerId = normalizeText(viewer.id || viewer.userId);

    return {
      id: userId || `member-${index + 1}`,
      userId,
      email: normalizeText(
        item?.email ||
          item?.display_name ||
          item?.displayName ||
          item?.user?.email,
      ),
      name,
      initial: buildInitial(name),
      avatarTint: pickAvatarTint(name),
      avatarUrl: normalizeText(item?.avatar_url || item?.avatarUrl),
      isHost: Boolean(
        item?.isHost ??
          item?.host ??
          (normalizeText(item?.role).toLowerCase() === "host"
            ? true
            : undefined) ??
          fallback?.isHost,
      ),
      isYou:
        (viewerId && userId && viewerId === userId) ||
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

function mapRoomFeed(roomDto, fallbackItems) {
  const messageItems = readArray(roomDto, [
    "messages",
    "chat",
    "chatMessages",
    "chat_messages",
  ]);
  const pollItems = readArray(roomDto, ["polls", "pollItems", "poll_items"]);
  const mappedMessages = mapRoomMessages(messageItems, fallbackItems);
  const roomMembers = readArray(roomDto, ["members", "participants", "users"]);
  const mappedPolls = mapRoomPolls(pollItems, roomMembers);
  const hasExplicitFeedArrays =
    Array.isArray(messageItems) || Array.isArray(pollItems);
  const fallbackFeed = Array.isArray(fallbackItems) ? fallbackItems : [];
  const fallbackMessages = fallbackFeed.filter((item) => !item?.isBet);
  const fallbackPolls = fallbackFeed.filter((item) => item?.isBet);

  if (!mappedMessages.length && !mappedPolls.length && !hasExplicitFeedArrays) {
    return fallbackItems.map((item) => cloneValue(item));
  }

  const nextMessages =
    mappedMessages.length || Array.isArray(messageItems)
      ? mappedMessages
      : fallbackMessages;
  const nextPolls =
    mappedPolls.length || Array.isArray(pollItems) ? mappedPolls : fallbackPolls;

  return [...nextMessages, ...nextPolls].sort(compareRoomFeedItems);
}

function mapRoomMessages(items) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.map((item, index) => {
    const authorName =
      normalizeText(
        item?.authorName ||
          item?.author_name ||
          item?.display_name ||
          item?.author?.name ||
          item?.author?.display_name ||
          item?.user?.name,
      ) || "Участник";
    const authorInitial = buildInitial(authorName);

    if (Array.isArray(item?.options)) {
      const selectedOptionId = resolveSelectedPollOptionId(item);
      const options = item.options
        .map((option, optionIndex) => {
          const optionId =
            normalizeText(
              option?.id ||
                option?.optionId ||
                option?.option_id ||
                option?.bet_variant_id ||
                option?.betVariantId ||
                option?.variant_id ||
                option?.variantId,
            ) || `bet-${index + 1}-option-${optionIndex + 1}`;

          return {
            id: optionId,
            label:
              normalizeText(option?.label || option?.title || option?.name) ||
              `Вариант ${optionIndex + 1}`,
            votes: normalizeCount(
              option?.votes ??
                option?.votes_count ??
                option?.votesCount ??
                option?.vote_count ??
                option?.voteCount ??
                option?.count ??
                option?.value,
            ),
            isSelected: normalizeText(optionId) === selectedOptionId,
          };
        })
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
          `Создал ${authorName} · ${sumOptionVotes(options)} голосов`,
        voteCount: Math.max(
          normalizeCount(item?.vote_count || item?.voteCount),
          sumOptionVotes(options),
        ),
        selectionText:
          normalizeText(item?.selectionText || item?.selection_text) ||
          "Голосование открыто",
        options,
      };
    }

    return {
      id: normalizeText(item?.id) || `message-${index + 1}`,
      isBet: false,
      createdAt: normalizeText(item?.created_at || item?.sent_at),
      authorName,
      authorInitial,
      authorTint: pickAvatarTint(authorName),
      timeLabel:
        normalizeText(item?.timeLabel || item?.time_label) ||
        formatEventTimeLabel(item?.created_at || item?.sent_at) ||
        formatTimeLabel(),
      text:
        normalizeText(item?.text || item?.message || item?.body || item?.content) ||
        "",
      reactionText:
        normalizeText(item?.reactionText || item?.reaction_text) || "",
    };
  });
}

function mapRoomPolls(items, roomMembers = []) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.map((item, index) => {
    const createdByUserId = normalizeText(
      item?.created_by_user_id ||
        item?.createdByUserId ||
        item?.user_id ||
        item?.userId,
    );
    const authorName =
      normalizeText(
        item?.authorName ||
          item?.author_name ||
          item?.display_name ||
          item?.created_by_name ||
          item?.user?.name,
      ) ||
      resolveMemberNameByUserId(roomMembers, createdByUserId) ||
      "Участник";
    const optionItems = Array.isArray(item?.options) ? item.options : [];
    const selectedOptionId = resolveSelectedPollOptionId(item);
    const options = optionItems.map((option, optionIndex) => {
      const optionId =
        normalizeText(
          option?.id ||
            option?.option_id ||
            option?.optionId ||
            option?.bet_variant_id ||
            option?.betVariantId ||
            option?.variant_id ||
            option?.variantId,
        ) || `poll-${index + 1}-option-${optionIndex + 1}`;

      return {
        id: optionId,
        label:
          normalizeText(option?.label || option?.title || option?.name) ||
          `Вариант ${optionIndex + 1}`,
        votes: normalizeCount(
          option?.votes ??
            option?.votes_count ??
            option?.votesCount ??
            option?.vote_count ??
            option?.voteCount ??
            option?.count,
        ),
        isSelected: normalizeText(optionId) === selectedOptionId,
      };
    });

    return {
      id:
        normalizeText(item?.id || item?.poll_id || item?.pollId) ||
        `poll-${index + 1}`,
      isBet: true,
      createdAt: normalizeText(item?.created_at || item?.sent_at),
      authorName,
      authorInitial: buildInitial(authorName),
      authorTint: pickAvatarTint(authorName),
      timeLabel:
        formatEventTimeLabel(item?.created_at || item?.sent_at) ||
        formatTimeLabel(),
      question:
        normalizeText(item?.question || item?.title || item?.name) || "Ставка",
      metaText:
        normalizeText(item?.metaText || item?.meta_text) ||
        `Создал ${authorName} · ${sumOptionVotes(options)} голосов`,
      voteCount: Math.max(
        normalizeCount(item?.vote_count || item?.voteCount),
        sumOptionVotes(options),
      ),
      selectionText:
        normalizeText(item?.selectionText || item?.selection_text) ||
        "Голосование открыто",
      options,
    };
  });
}

function isPollVoteFromCurrentViewer(vote, viewer = {}) {
  if (!vote || typeof vote !== "object") {
    return false;
  }

  const viewerId = normalizeText(viewer.id || viewer.userId);
  const voteUserId = normalizeText(
    vote.user_id ||
      vote.userId ||
      vote.voter_id ||
      vote.voterId ||
      vote.member_id ||
      vote.memberId ||
      vote.user?.id ||
      vote.user?.user_id,
  );

  if (viewerId && voteUserId) {
    return viewerId === voteUserId;
  }

  const viewerName = normalizeText(viewer.name).toLowerCase();
  const voteUserName = normalizeText(
    vote.user_name ||
      vote.userName ||
      vote.voter_name ||
      vote.voterName ||
      vote.user?.name ||
      vote.user?.email,
  ).toLowerCase();

  return Boolean(viewerName && voteUserName && viewerName === voteUserName);
}

function resolveSelectedPollOptionId(item = {}) {
  const vote =
    item?.vote ||
    item?.user_vote ||
    item?.userVote ||
    item?.current_user_vote ||
    item?.currentUserVote ||
    item?.my_vote ||
    item?.myVote;

  if (vote && typeof vote === "object") {
    const voteOptionId = normalizeText(
      vote.option_id ||
        vote.optionId ||
        vote.selected_option_id ||
        vote.selectedOptionId,
    );

    if (voteOptionId) {
      return voteOptionId;
    }
  }

  return normalizeText(
    item?.selected_option_id ||
      item?.selectedOptionId ||
      item?.voted_option_id ||
      item?.votedOptionId ||
      item?.user_option_id ||
      item?.userOptionId,
  );
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

function dedupeRoomMembers(members = [], viewer = {}) {
  if (!Array.isArray(members) || !members.length) {
    return [];
  }

  const viewerId = normalizeText(viewer.id || viewer.userId);
  const viewerEmail = normalizeText(viewer.email).toLowerCase();
  const viewerName = normalizeText(viewer.name).toLowerCase();
  const seen = new Set();

  return members.reduce((accumulator, member, index) => {
    const memberId = normalizeText(member?.userId || member?.id);
    const memberEmail = normalizeText(member?.email || member?.name).toLowerCase();
    const memberName = normalizeText(member?.name).toLowerCase();
    const dedupeKey =
      memberId ||
      (memberEmail && memberEmail.includes("@") ? memberEmail : "") ||
      memberName ||
      `member-${index + 1}`;

    if (seen.has(dedupeKey)) {
      return accumulator;
    }

    seen.add(dedupeKey);

    accumulator.push({
      ...member,
      isYou:
        member.isYou ||
        Boolean(
          (viewerId && memberId && viewerId === memberId) ||
            (viewerEmail && memberEmail && viewerEmail === memberEmail) ||
            (viewerName && memberName && viewerName === memberName),
        ),
    });

    return accumulator;
  }, []);
}

function resolveMemberNameByUserId(members = [], userId = "") {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId || !Array.isArray(members)) {
    return "";
  }

  const matchedMember = members.find((member) => {
    return (
      normalizeText(member?.user_id || member?.userId || member?.id) ===
      normalizedUserId
    );
  });

  return normalizeText(
    matchedMember?.display_name ||
      matchedMember?.displayName ||
      matchedMember?.name ||
      matchedMember?.title ||
      matchedMember?.username,
  );
}

function prependWatchPartyGreeting(messages = []) {
  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const greetingText =
    "Привет! Это чат в комнате совместного просмотра. Здесь можно обсудить интересный момент, сделать ставку на сюжет или просто пообщаться:)";

  const hasGreeting = normalizedMessages.some((message) => {
    return normalizeText(message?.id) === "watch-party-greeting";
  });

  if (hasGreeting) {
    return normalizedMessages;
  }

  return [
    {
      id: "watch-party-greeting",
      isBet: false,
      authorName: "VKino",
      authorInitial: "V",
      authorTint: pickAvatarTint("VKino"),
      timeLabel: formatTimeLabel(),
      text: greetingText,
      reactionText: "",
    },
    ...normalizedMessages,
  ];
}

function createInitialLobbyUiState() {
  return {
    isLoading: true,
    errorMessage: "",
    statusMessage: "",
    statusTone: "info",
    isVisibilityMenuOpen: false,
    visibilitySelectedValue: "",
    visibilitySelectedLabel: "",
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
    topMovieCandidatesLoading: false,
    topMovieCandidatesError: "",
    topMovieCandidates: [],
    isInviteModalOpen: false,
    inviteFriendsLoading: false,
    inviteFriendsLoaded: false,
    inviteFriendsError: "",
    inviteFriends: [],
    inviteFriendStatuses: {},
    inviteRequestInFlightIds: [],
    isBetComposerOpen: false,
    betComposerOptionCount: 2,
  };
}

function normalizeInviteFriends(items = []) {
  return Array.isArray(items)
    ? items
        .map((friend) => {
          const id = normalizeText(friend?.id || friend?.user_id || friend?.userId);

          if (!id) {
            return null;
          }

          const displayName =
            normalizeText(friend?.displayName) ||
            normalizeText(getDisplayNameFromEmail(friend?.email)) ||
            "Пользователь";

          return {
            id,
            email: normalizeText(friend?.email),
            displayName,
            initials: displayName.charAt(0).toUpperCase(),
            avatarUrl:
              resolveAvatarUrl(friend, { resolveMediaUrl }) ||
              "/img/user-avatar.webp",
          };
        })
        .filter(Boolean)
    : [];
}

function buildInviteFriendsViewModels(friends = [], roomData = {}, uiState = {}) {
  const inFlightIds = new Set(uiState.inviteRequestInFlightIds || []);
  const localStatuses = uiState.inviteFriendStatuses || {};

  return Array.isArray(friends)
    ? friends.map((friend) => {
        const roomMember = findRoomMemberByUserId(roomData, friend.id);
        const memberStatus = normalizeText(roomMember?.statusText).toLowerCase();
        const localStatus = normalizeText(localStatuses[friend.id]).toLowerCase();
        const isInviting = inFlightIds.has(friend.id);
        const isPending =
          localStatus === "pending" ||
          memberStatus.includes("pending") ||
          memberStatus.includes("ожида");
        const isInRoom =
          Boolean(roomMember) && !isPending && !memberStatus.includes("offline");

        let buttonLabel = "Пригласить";
        let statusLabel = "";
        let isDisabled = false;

        if (isInviting) {
          buttonLabel = "Отправка...";
          isDisabled = true;
        } else if (isInRoom) {
          buttonLabel = "В комнате";
          statusLabel = "В комнате";
          isDisabled = true;
        } else if (isPending) {
          buttonLabel = "Приглашен";
          statusLabel = "Ожидает вход";
          isDisabled = true;
        }

        return {
          ...friend,
          statusLabel,
          isInviting,
          isInviteDisabled: isDisabled,
          inviteButtonLabel: buttonLabel,
        };
      })
    : [];
}

function buildCurrentViewer() {
  const authState = authStore.getState();
  const email = normalizeText(authState.user?.email);
  const name =
    normalizeText(getDisplayNameFromEmail(email)) ||
    normalizeText(authState.user?.name) ||
    "Вы";

  return {
    id: normalizeText(
      authState.user?.id || authState.user?.userId || authState.user?.user_id,
    ),
    email,
    name,
    initial: buildInitial(name),
    avatarTint: pickAvatarTint(name),
  };
}

function decorateRoomMessage(message) {
  if (!message.isBet) {
    return {
      ...message,
    };
  }

  const hasRawSelectedOption = Array.isArray(message.options)
    ? message.options.some((option) => option?.isSelected)
    : false;
  const normalizedOptions = Array.isArray(message.options)
    ? message.options.map((option) => ({
        ...option,
        votes:
          hasRawSelectedOption && option?.isSelected
            ? Math.max(normalizeCount(option.votes), 1)
            : normalizeCount(option.votes),
      }))
    : [];
  const voteCount = Math.max(
    normalizeCount(message.voteCount),
    sumOptionVotes(normalizedOptions),
    hasRawSelectedOption ? 1 : 0,
  );
  const options = normalizedOptions.map((option) => {
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
      resolvePollMetaText(message, voteCount) ||
      `Создал ${message.authorName} · ${voteCount} голосов`,
    votersText: formatVotersText(voteCount),
    selectionText:
      normalizeText(message.selectionText) ||
      resolveSelectedOptionLabel(message.options) ||
      "Голосование открыто",
  };
}

function resolvePollMetaText(message, voteCount) {
  const metaText = normalizeText(message.metaText);

  if (!metaText) {
    return "";
  }

  if (voteCount > 0 && /0\s+голос/i.test(metaText)) {
    return "";
  }

  return metaText;
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

  if (pathParts[0] !== "watch-party") {
    return {
      isRoomView: false,
      isJoinView: false,
      roomId: "",
      inviteCode: "",
    };
  }

  if (pathParts[1] === "join") {
    return {
      isRoomView: false,
      isJoinView: true,
      roomId: "",
      inviteCode: normalizeText(pathParts[2]),
    };
  }

  if (!pathParts[1]) {
    return {
      isRoomView: false,
      isJoinView: false,
      roomId: "",
      inviteCode: "",
    };
  }

  return {
    isRoomView: true,
    isJoinView: false,
    roomId: normalizeText(pathParts[1]).replace(/^id/i, ""),
    inviteCode: "",
  };
}

function resolveImageUrl(item, fallback) {
  return (
    resolveMediaUrl(
      normalizeText(
        item?.imageUrl ||
          item?.image_url ||
          item?.posterUrl ||
          item?.poster_url ||
          item?.coverUrl ||
          item?.cover_url,
      ),
      MEDIA_BUCKETS.cards,
    ) ||
    resolveMediaUrl(
      normalizeText(
        item?.playback?.img_url ||
          item?.playback?.imgUrl ||
          item?.playback?.poster_url ||
          item?.playback?.posterUrl ||
          item?.movie?.img_url ||
          item?.movie?.imgUrl ||
          item?.movie?.poster_url ||
          item?.movie?.posterUrl,
      ),
      MEDIA_BUCKETS.cards,
    ) ||
    fallback
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

function extractInviteCodeFromLink(link) {
  const normalizedLink = normalizeText(link);

  if (!normalizedLink) {
    return "";
  }

  if (
    !normalizedLink.includes("/") &&
    !normalizedLink.includes("?") &&
    !normalizedLink.includes("#") &&
    !/^https?:\/\//i.test(normalizedLink)
  ) {
    return normalizedLink;
  }

  try {
    const parsedUrl = new URL(normalizedLink, window.location.origin);
    const routeState = readWatchPartyRouteState(parsedUrl.pathname);
    if (routeState.isJoinView) {
      return routeState.inviteCode;
    }

    return normalizeText(
      parsedUrl.searchParams.get("invite_code") ||
        parsedUrl.searchParams.get("inviteCode"),
    );
  } catch {
    return "";
  }
}

function extractWatchPartyRoomIdentifier(payload) {
  const roomPayload = extractWatchPartyRoom(payload) || payload;

  if (!roomPayload || typeof roomPayload !== "object" || Array.isArray(roomPayload)) {
    return "";
  }

  return normalizeText(
    roomPayload.id ||
      roomPayload.roomId ||
      roomPayload.room_id ||
      roomPayload.internal_room_id,
  );
}

function buildRoomAccessErrorText(result) {
  if (result?.status === 403) {
    return "Доступ к комнате есть только у участников. Откройте invite-ссылку и войдите в комнату через нее.";
  }

  if (result?.status === 404) {
    return "Комната не найдена или ссылка устарела.";
  }

  return "Не удалось получить данные комнаты с сервера.";
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

async function loadTopRoomMovieCandidates() {
  const result = await movieService.getSelectionsByTitles(["Популярные"]);

  if (!result.ok) {
    return [];
  }

  const selections = extractSelections(result.resp);
  const popularSelection =
    selections.find((selection) => {
      return normalizeText(selection?.title || selection?.name).toLowerCase() ===
        "популярные";
    }) || selections[0];

  return normalizeTopRoomMovieCandidates(extractSelectionMovies(popularSelection));
}

function extractSelectionMovies(selection = {}) {
  if (Array.isArray(selection?.movies)) {
    return selection.movies;
  }

  if (Array.isArray(selection?.Movies)) {
    return selection.Movies;
  }

  if (Array.isArray(selection?.titles)) {
    return selection.titles;
  }

  return [];
}

function normalizeTopRoomMovieCandidates(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const id = normalizeText(item?.id);
      const title = normalizeText(item?.title || item?.name);

      if (!id || !title) {
        return null;
      }

      return {
        id,
        title,
        subtitle: [
          normalizeText(item?.release_year || item?.year),
          normalizeText(item?.country || item?.country_name),
        ]
          .filter(Boolean)
          .join(" · "),
        imageUrl: resolveRoomMoviePosterUrl(item),
        rank: index + 1,
      };
    })
    .filter(Boolean)
    .slice(0, 10);
}

function mapMovieDtoToRoomSelection(dto) {
  if (!dto || typeof dto !== "object") {
    return null;
  }

  const id = normalizeText(dto.id);
  const title = normalizeText(dto.title || dto.name);

  if (!id || !title) {
    return null;
  }

  const posterUrl = resolveRoomMoviePosterUrl(dto);
  const subtitle = buildRoomMovieSubtitle(dto);
  const description = normalizeText(dto.description) || subtitle;
  const episodes = mapRoomMovieEpisodes(dto.episodes, posterUrl);

  return {
    id,
    title,
    contentType: normalizeText(dto.content_type || dto.contentType),
    subtitle,
    description,
    posterUrl,
    backdropUrl: posterUrl,
    episodes,
  };
}

function mapRoomMovieEpisodes(items, fallbackPosterUrl = "") {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => {
      const id = normalizeText(item?.id);

      if (!id) {
        return null;
      }

      return {
        id,
        movieId: normalizeText(item?.movie_id || item?.movieId),
        seasonNumber:
          normalizeCount(item?.season_number || item?.seasonNumber) || 1,
        episodeNumber:
          normalizeCount(item?.episode_number || item?.episodeNumber) ||
          index + 1,
        title: normalizeText(item?.title) || `Эпизод ${index + 1}`,
        description: normalizeText(item?.description),
        durationSeconds: normalizeCount(
          item?.duration_seconds || item?.durationSeconds,
        ),
        imgUrl: resolveRoomMoviePosterUrl(item) || fallbackPosterUrl,
        playbackUrl: normalizeText(item?.playback_url || item?.playbackUrl),
        positionSeconds: normalizeCount(
          item?.position_seconds || item?.positionSeconds,
        ),
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (left.seasonNumber !== right.seasonNumber) {
        return left.seasonNumber - right.seasonNumber;
      }

      return left.episodeNumber - right.episodeNumber;
    });
}

function resolveRoomMoviePosterUrl(item = {}) {
  return (
    resolveMediaUrl(
      normalizeText(item?.poster_url || item?.posterUrl),
      MEDIA_BUCKETS.posters,
    ) ||
    resolveMediaUrl(
      normalizeText(item?.img_url || item?.imgUrl),
      MEDIA_BUCKETS.cards,
    ) ||
    "/img/cards/interstellar.webp"
  );
}

function buildRoomMovieSubtitle(dto = {}) {
  return [
    normalizeText(dto.release_year || dto.year),
    normalizeText(dto.director),
    normalizeText(dto.content_type || dto.contentType),
  ]
    .filter(Boolean)
    .join(" · ");
}

function hasRoomMovieSelection(roomData = {}) {
  if (
    roomData.selectedMovie &&
    Array.isArray(roomData.selectedMovie.episodes) &&
    roomData.selectedMovie.episodes.length
  ) {
    return true;
  }

  const playerSource = roomData.playerSource || {};

  return Boolean(
    normalizeText(playerSource.movieId || playerSource.movie_id) &&
      normalizeText(playerSource.episodeId || playerSource.episode_id),
  );
}

function hasRoomMovieBinding(roomData = {}) {
  if (hasRoomMovieSelection(roomData)) {
    return true;
  }

  const playerSource = roomData.playerSource || {};
  return Boolean(normalizeText(playerSource.movieId || playerSource.movie_id));
}

function resolveInviteLink(inviteLink, fallbackLink = "") {
  const normalizedInviteLink = normalizeText(inviteLink);

  if (normalizedInviteLink) {
    if (
      normalizedInviteLink.startsWith("/") ||
      /^https?:\/\//i.test(normalizedInviteLink)
    ) {
      return normalizedInviteLink;
    }

    return buildWatchPartyJoinPath(normalizedInviteLink);
  }

  const normalizedFallbackLink = normalizeText(fallbackLink);

  if (!normalizedFallbackLink) {
    return "";
  }

  if (
    normalizedFallbackLink.startsWith("/") ||
    /^https?:\/\//i.test(normalizedFallbackLink)
  ) {
    return normalizedFallbackLink;
  }

  return buildWatchPartyJoinPath(normalizedFallbackLink);
}

function resolveVisibilityLabelText(value, fallback = "Только по ссылке") {
  const normalizedValue = normalizeVisibilityValue(value);

  if (normalizedValue === "public") {
    return "Открытая";
  }

  if (normalizedValue === "private") {
    return "Только по ссылке";
  }

  return normalizeText(value) || fallback;
}

function normalizeVisibilityValue(value) {
  const normalizedValue = normalizeText(value).toLowerCase();

  if (normalizedValue === "friends") {
    return "private";
  }

  return normalizedValue || "private";
}

function normalizeNumericIdentifier(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  if (/^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }

  return normalizedValue;
}

function normalizeNonNegativeInteger(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.max(0, Math.floor(parsed));
}

function resolveHostNameFromMembers(items) {
  if (!Array.isArray(items)) {
    return "";
  }

  const host = items.find((item) => {
    return (
      item?.isHost === true ||
      item?.host === true ||
      normalizeText(item?.role).toLowerCase() === "host"
    );
  });

  return normalizeText(
    host?.display_name || host?.displayName || host?.name || host?.username,
  );
}

function formatDurationLabel(value) {
  const totalSeconds = normalizeCount(value);

  if (!totalSeconds) {
    return "";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatEventTimeLabel(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const date = new Date(normalizedValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatTimeLabel(date);
}

function compareRoomFeedItems(left, right) {
  const leftTimestamp = Date.parse(normalizeText(left?.createdAt));
  const rightTimestamp = Date.parse(normalizeText(right?.createdAt));

  if (Number.isFinite(leftTimestamp) && Number.isFinite(rightTimestamp)) {
    return leftTimestamp - rightTimestamp;
  }

  return 0;
}

function buildRoomSubscriptionUrl(roomId) {
  const explicitUrl = normalizeText(import.meta.env.VITE_WATCH_PARTY_WS_URL);
  const endpoint = `/watch-party/rooms/${encodeURIComponent(roomId)}/subscribe`;
  const httpUrl = apiService.buildUrl(endpoint);
  const token = normalizeText(apiService.getAccessToken());
  const baseUrl = resolveRoomWsBaseUrl(explicitUrl, httpUrl, roomId);

  if (!baseUrl) {
    return "";
  }

  try {
    const wsUrl = new URL(String(baseUrl).replace(/^http/i, "ws"), window.location.origin);

    if (wsUrl.protocol === "https:") {
      wsUrl.protocol = "wss:";
    } else if (wsUrl.protocol === "http:") {
      wsUrl.protocol = "ws:";
    }

    if (token) {
      wsUrl.searchParams.set("access_token", token);
    }

    return wsUrl.toString();
  } catch {
    return "";
  }
}

function parseSubscriptionPayload(rawPayload) {
  if (!rawPayload) {
    return null;
  }

  if (typeof rawPayload === "string") {
    try {
      return JSON.parse(rawPayload);
    } catch {
      return null;
    }
  }

  return null;
}

function resolveRoomWsBaseUrl(explicitUrl, fallbackUrl, roomId) {
  if (!explicitUrl) {
    return fallbackUrl;
  }

  if (explicitUrl.includes("{roomId}")) {
    return explicitUrl.replaceAll("{roomId}", encodeURIComponent(roomId));
  }

  if (/\/watch-party\/rooms\/[^/]+\/subscribe/i.test(explicitUrl)) {
    return explicitUrl;
  }

  return `${explicitUrl.replace(/\/+$/, "")}/watch-party/rooms/${encodeURIComponent(roomId)}/subscribe`;
}

function upsertRoomMember(members, nextMember) {
  const nextMemberId = normalizeText(nextMember.userId || nextMember.id);

  if (!nextMemberId) {
    return members;
  }

  const existingIndex = members.findIndex((member) => {
    return normalizeText(member.userId || member.id) === nextMemberId;
  });

  if (existingIndex === -1) {
    return [...members, nextMember];
  }

  return members.map((member, index) => {
    return index === existingIndex ? { ...member, ...nextMember } : member;
  });
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

import BasePage from "../BasePage.js";
import "./SupportTickets.precompiled.js";
import "@/css/support-tickets.scss";
import "@/css/admin-tickets.scss";

import HeaderComponent from "@/components/Header/Header.js";
import SupportTicketsConversationComponent from "@/components/SupportTicketsConversation/SupportTicketsConversation.js";
import SupportTicketsHeroComponent from "@/components/SupportTicketsHero/SupportTicketsHero.js";
import SupportTicketsSidebarComponent from "@/components/SupportTicketsSidebar/SupportTicketsSidebar.js";
import { useSupportTickets } from "@/hooks/useSupportTickets.js";
import { supportRealtimeService } from "@/js/SupportRealtimeService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import {
  shouldSyncSupportRealtimePayload,
  validateSupportFile,
} from "@/utils/support.js";
import {
  buildSupportConversationContext,
  buildSupportHeroContext,
  buildSupportNoticeClass,
  buildSupportShellContext,
  buildSupportSidebarContext,
  DEFAULT_SUPPORT_REPLY_FILE_HINT,
  normalizeSupportReplyText,
  normalizeSupportTicketRating,
  pickSelectedSupportFile,
  resolveSupportCurrentUser,
  resolveSupportRatingErrorMessage,
  SUPPORT_REQUESTS_BLOCKED_MESSAGE,
} from "@/utils/supportTicketsView.js";

export default class SupportTicketsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "SupportTicketsPage: не передан корневой элемент для SupportTicketsPage",
      );
    }

    super(
      {
        ...buildSupportShellContext({
          isLoading: true,
        }),
        heroContext: {},
        sidebarContext: {},
        conversationContext: {},
        ...context,
      },
      Handlebars.templates["SupportTickets.hbs"],
      parent,
      el,
      "SupportTicketsPage",
    );

    this._authUnsubscribe = null;
    this._ticketsHook = null;
    this._currentUser = resolveSupportCurrentUser();
    this._activeTicketId = "";
    this._noticeMessage = "";
    this._noticeTone = "";
    this._replyError = "";
    this._replyDraftText = "";
    this._replyFileMeta = DEFAULT_SUPPORT_REPLY_FILE_HINT;
    this._hasReplyFileSelection = false;
    this._ratingError = "";
    this._ratingValue = "";
    this._isRequestBlocked = false;
    this._isRealtimePaused = false;
    this._isRealtimeUnavailable = false;
    this._isRealtimeRequestInFlight = false;
    this._isViewRefreshInProgress = false;
  }

  init() {
    const state = authStore.getState();

    if (state.status === "loading") {
      this._authUnsubscribe = authStore.subscribe(async (nextState) => {
        if (nextState.status === "loading") {
          return;
        }

        this._authUnsubscribe?.();
        this._authUnsubscribe = null;
        await this._bootstrap(nextState);
      });

      return super.init();
    }

    this._bootstrap(state);
    return this;
  }

  async _bootstrap(state) {
    if (!state.user) {
      router.go("/sign-in");
      return;
    }

    this._ensureTicketsHook(state.user);
    super.init();

    if (!this._isViewRefreshInProgress) {
      await this.loadContext();
    }
  }

  addEventListeners() {
    this.el.addEventListener("click", this._onClick);
    this.el.addEventListener("change", this._onChange);
    this.el.addEventListener("input", this._onInput);
    this.el.addEventListener("submit", this._onSubmit);
  }

  removeEventListeners() {
    if (this._authUnsubscribe) {
      this._authUnsubscribe();
      this._authUnsubscribe = null;
    }

    supportRealtimeService.disconnect();

    if (!this.el) {
      return;
    }

    this.el.removeEventListener("click", this._onClick);
    this.el.removeEventListener("change", this._onChange);
    this.el.removeEventListener("input", this._onInput);
    this.el.removeEventListener("submit", this._onSubmit);
  }

  beforeDestroy() {
    this._ticketsHook?.cancelPendingRequests?.();
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "SupportTicketsPage: не найден header в шаблоне SupportTickets.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));

    if (this.context.isLoading) {
      return;
    }

    const hero = this.el.querySelector("#support-tickets-hero");
    const sidebar = this.el.querySelector("#support-tickets-sidebar");
    const conversation = this.el.querySelector("#support-tickets-conversation");

    if (!hero || !sidebar || !conversation) {
      throw new Error(
        "SupportTicketsPage: не найдены контейнеры support-компонентов",
      );
    }

    this.addChild(
      "hero",
      new SupportTicketsHeroComponent(this.context.heroContext, this, hero),
    );
    this.addChild(
      "sidebar",
      new SupportTicketsSidebarComponent(
        this.context.sidebarContext,
        this,
        sidebar,
      ),
    );
    this.addChild(
      "conversation",
      new SupportTicketsConversationComponent(
        this.context.conversationContext,
        this,
        conversation,
      ),
    );
  }

  async loadContext({ source = "manual" } = {}) {
    if (!this._ticketsHook || this._isRequestBlocked) {
      return;
    }

    if (source === "realtime") {
      if (this._isRealtimePaused || this._isRealtimeRequestInFlight) {
        return;
      }

      this._isRealtimeRequestInFlight = true;
    }

    try {
      const result = await this._ticketsHook.load({
        preserveSelection: true,
      });
      await this._applyHookResult(result);
    } finally {
      if (source === "realtime") {
        this._isRealtimeRequestInFlight = false;
      }
    }
  }

  _onClick = async (event) => {
    const ticketCard = event.target.closest("[data-ticket-id]");

    if (!ticketCard || !this._ticketsHook) {
      return;
    }

    const nextTicketId = String(ticketCard.dataset.ticketId || "").trim();
    const currentTicketId = this._ticketsHook.getSnapshot()?.selectedTicket?.id || "";

    if (!nextTicketId || nextTicketId === currentTicketId) {
      return;
    }

    this._resetComposerState();
    this._clearNotice();
    this._clearRatingState();

    const result = await this._ticketsHook.selectTicket(nextTicketId);
    await this._applyHookResult(result);
  };

  _onChange = async (event) => {
    if (!this._ticketsHook) {
      return;
    }

    if (event.target.matches('[name="statusFilter"]')) {
      this._resetComposerState();
      this._clearNotice();
      this._clearRatingState();
      const result = await this._ticketsHook.setStatusFilter(event.target.value);
      await this._applyHookResult(result);
      return;
    }

    if (event.target.matches('[name="categoryFilter"]')) {
      this._resetComposerState();
      this._clearNotice();
      this._clearRatingState();
      const result = await this._ticketsHook.setCategoryFilter(event.target.value);
      await this._applyHookResult(result);
      return;
    }

    if (event.target.matches('[name="replyFile"]')) {
      const selectedFile = pickSelectedSupportFile(event.target.files?.[0] || null);
      this._replyError = validateSupportFile(selectedFile);
      this._setReplyFileMeta(selectedFile);
      this._clearNotice();
      this._renderReplyState();
      this._renderReplyFileState();
      return;
    }

    if (event.target.matches('[name="ticketRating"]')) {
      this._ratingValue = String(event.target.value || "");
      this._ratingError = "";
      this._renderRatingState();
      return;
    }

    if (event.target.matches('[name="ticketStatus"]')) {
      this._clearNotice();
      this._refreshNotice();
    }
  };

  _onInput = async (event) => {
    if (!this._ticketsHook) {
      return;
    }

    if (event.target.matches('[name="ticketSearch"]')) {
      this._resetComposerState();
      this._clearNotice();
      this._clearRatingState();
      const result = await this._ticketsHook.setSearchQuery(event.target.value);
      await this._applyHookResult(result);
      return;
    }

    if (!event.target.matches('[name="reply"]')) {
      return;
    }

    this._replyDraftText = String(event.target.value || "");
    this._replyError = "";
    this._renderReplyState();
  };

  _onSubmit = async (event) => {
    const statusForm = event.target.closest('[data-action="update-ticket-status"]');

    if (statusForm) {
      event.preventDefault();
      await this._handleStatusSubmit(statusForm);
      return;
    }

    const ratingForm = event.target.closest('[data-action="rate-ticket"]');

    if (ratingForm) {
      event.preventDefault();
      await this._handleRatingSubmit(ratingForm);
      return;
    }

    const replyForm = event.target.closest('[data-action="reply-ticket"]');

    if (!replyForm) {
      return;
    }

    event.preventDefault();
    await this._handleReplySubmit(replyForm);
  };

  async _handleReplySubmit(form) {
    if (!this._ticketsHook || !this._canRequest()) {
      return;
    }

    const formData = new FormData(form);
    const replyText = normalizeSupportReplyText(formData.get("reply"));
    const replyFile = pickSelectedSupportFile(formData.get("replyFile"));

    if (!replyText && !(replyFile instanceof File)) {
      this._replyError = "Напишите ответ или приложите файл.";
      this._clearNotice();
      this._renderReplyState();
      return;
    }

    const fileError = validateSupportFile(replyFile);

    if (fileError) {
      this._replyError = fileError;
      this._clearNotice();
      this._renderReplyState();
      return;
    }

    const result = await this._ticketsHook.replyToSelectedTicket({
      text: replyText,
      attachment: replyFile,
    });

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      if (result.blocked) {
        this._applyBlockedState();
        this._applySnapshot(result.snapshot, { forceRatingSync: true });
        return;
      }

      this._replyError = result.error || "Не удалось отправить сообщение.";
      this._clearNotice();
      this._renderReplyState();
      return;
    }

    this._resetComposerState();
    this._noticeMessage = result.message || "Сообщение отправлено.";
    this._noticeTone = "info";
    form.reset();
    await this._applyHookResult(result, {
      scrollMessagesToBottom: true,
    });
  }

  async _handleStatusSubmit(form) {
    if (!this._ticketsHook || !this._canRequest()) {
      return;
    }

    const nextStatus = String(
      new FormData(form).get("ticketStatus") || "",
    ).trim();

    const result = await this._ticketsHook.setSelectedTicketStatus(nextStatus);

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      this._noticeMessage =
        result.error || "Не удалось обновить статус обращения.";
      this._noticeTone = "error";
      this._refreshNotice();
      if (result.blocked) {
        this._applyBlockedState();
      }
      this._applySnapshot(result.snapshot, { forceRatingSync: true });
      return;
    }

    this._noticeMessage = result.message || "";
    this._noticeTone = "info";
    await this._applyHookResult(result);
  }

  async _handleRatingSubmit(form) {
    if (!this._ticketsHook || !this._canRequest()) {
      return;
    }

    const rating = normalizeSupportTicketRating(
      new FormData(form).get("ticketRating") || this._ratingValue,
    );

    if (!rating) {
      this._ratingError = "Выберите оценку от 1 до 5.";
      this._renderRatingState();
      return;
    }

    const result = await this._ticketsHook.rateSelectedTicket(rating);

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      if (result.blocked) {
        this._applyBlockedState();
        this._applySnapshot(result.snapshot, { forceRatingSync: true });
        return;
      }

      this._ratingError = resolveSupportRatingErrorMessage(result);
      this._renderRatingState();
      return;
    }

    this._ratingValue = String(rating);
    this._ratingError = "";
    this._noticeMessage = result.message || "";
    this._noticeTone = "info";
    await this._applyHookResult(result);
  }

  async _applyHookResult(
    result = {},
    { scrollMessagesToBottom = false } = {},
  ) {
    if (result.aborted) {
      return;
    }

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (result.blocked) {
      this._applyBlockedState();
    } else if (result.ok) {
      this._resumeRequestState();
    } else if (result.error) {
      this._noticeMessage = result.error;
      this._noticeTone = "error";
    }

    this._applySnapshot(result.snapshot, {
      forceRatingSync: result.snapshot?.selectedTicket?.id !== this._activeTicketId,
      scrollMessagesToBottom,
    });

    if (!this._isRequestBlocked && !this._isRealtimeUnavailable) {
      this._connectRealtime();
      this._syncRealtimeSubscription();
    }
  }

  _applySnapshot(
    snapshot = this._ticketsHook?.getSnapshot() || {},
    {
      forceRatingSync = false,
      scrollMessagesToBottom = false,
    } = {},
  ) {
    const nextSelectedTicketId = snapshot.selectedTicket?.id || "";

    this._syncRatingDraftFromSelectedTicket(snapshot.selectedTicket, {
      force: forceRatingSync,
    });
    this._activeTicketId = nextSelectedTicketId;
    this._refreshView(snapshot, { scrollMessagesToBottom });
  }

  _refreshView(
    snapshot = this._ticketsHook?.getSnapshot() || {},
    { scrollMessagesToBottom = false } = {},
  ) {
    if (!this.el) {
      return;
    }

    const nextContext = this._buildPageContext(snapshot);
    const needsShellRefresh =
      this.context.isLoading ||
      !this.getChild("hero") ||
      !this.getChild("sidebar") ||
      !this.getChild("conversation");
    const scrollState = needsShellRefresh ? null : this._capturePanelScrollState();

    this._isViewRefreshInProgress = true;

    try {
      if (needsShellRefresh) {
        this.context = nextContext;
        this.refresh(nextContext);
      } else {
        this.context = nextContext;
        this.getChild("hero")?.refresh(nextContext.heroContext);
        this.getChild("sidebar")?.refresh(nextContext.sidebarContext);
        this.getChild("conversation")?.refresh(nextContext.conversationContext);
      }
    } finally {
      this._isViewRefreshInProgress = false;
    }

    if (needsShellRefresh) {
      if (scrollMessagesToBottom) {
        this._scrollMessagesToBottom("auto");
      }
      return;
    }

    this._restorePanelScrollState(scrollState, {
      scrollMessagesToBottom,
    });
  }

  _buildPageContext(snapshot = {}) {
    const shellContext = buildSupportShellContext({
      isLoading: false,
      currentUser: this._currentUser,
    });

    return {
      ...shellContext,
      heroContext: buildSupportHeroContext(snapshot, this._currentUser),
      sidebarContext: buildSupportSidebarContext(snapshot, this._currentUser),
      conversationContext: buildSupportConversationContext(
        snapshot,
        this._currentUser,
        {
          noticeMessage: this._noticeMessage,
          noticeTone: this._noticeTone,
          replyError: this._replyError,
          replyDraft: this._replyDraftText,
          replyFileMeta: this._replyFileMeta,
          ratingError: this._ratingError,
          ratingValue: this._ratingValue,
        },
      ),
    };
  }

  _ensureTicketsHook(user) {
    if (this._ticketsHook) {
      return;
    }

    this._currentUser = resolveSupportCurrentUser(user);
    this.context = {
      ...this.context,
      ...buildSupportShellContext({
        isLoading: true,
        currentUser: this._currentUser,
      }),
    };
    this._ticketsHook = useSupportTickets(this._currentUser);
  }

  _connectRealtime() {
    if (this._isRequestBlocked) {
      return;
    }

    supportRealtimeService.connect({
      onMessage: this._handleRealtimeMessage,
      onError: this._handleRealtimeError,
      onStatusChange: this._handleRealtimeStatusChange,
    });
  }

  _syncRealtimeSubscription() {
    if (this._isRequestBlocked || this._isRealtimePaused) {
      supportRealtimeService.disconnect();
      return;
    }

    const selectedTicketId =
      this._ticketsHook?.getSnapshot()?.selectedTicket?.id || "";

    if (!selectedTicketId) {
      supportRealtimeService.unsubscribe();
      return;
    }

    supportRealtimeService.subscribe(selectedTicketId);
  }

  _handleRealtimeMessage = async (payload) => {
    const selectedTicketId =
      this._ticketsHook?.getSnapshot()?.selectedTicket?.id || "";

    if (
      this._isRequestBlocked ||
      this._isRealtimePaused ||
      this._isRealtimeRequestInFlight ||
      !shouldSyncSupportRealtimePayload(payload, selectedTicketId)
    ) {
      return;
    }

    this._isRealtimeRequestInFlight = true;

    try {
      const result = await this._ticketsHook.handleRealtimeSync();

      if (result.aborted) {
        return;
      }

      if (await this._handleUnauthorized(result)) {
        return;
      }

      if (result.ok) {
        this._noticeMessage = result.message || "Диалог обновлён в реальном времени.";
        this._noticeTone = "info";
      }

      await this._applyHookResult(result);
    } finally {
      this._isRealtimeRequestInFlight = false;
    }
  };

  _handleRealtimeError = () => {
    if (this._isRequestBlocked) {
      return;
    }

    this._noticeMessage =
      "WS недоступен. Пробуем восстановить соединение автоматически.";
    this._noticeTone = "error";
    this._refreshNotice();
  };

  _handleRealtimeStatusChange = (status) => {
    if (this._isRequestBlocked) {
      return;
    }

    if (status === "open") {
      this._isRealtimeUnavailable = false;

      if (
        this._noticeTone === "error" &&
        this._noticeMessage.includes("WS недоступен")
      ) {
        this._noticeMessage = "Соединение с чатом восстановлено.";
        this._noticeTone = "info";
      }

      this._refreshNotice();
      return;
    }

    if (status === "reconnecting") {
      this._noticeMessage =
        "Соединение с чатом потеряно. Пытаемся переподключиться...";
      this._noticeTone = "error";
      this._refreshNotice();
    }
  };

  async _handleUnauthorized(result) {
    if (result?.status !== 401) {
      return false;
    }

    await authStore.logout();
    router.go("/sign-in");
    return true;
  }

  _canRequest(showNotice = true) {
    if (!this._isRequestBlocked) {
      return true;
    }

    if (showNotice) {
      this._noticeMessage = SUPPORT_REQUESTS_BLOCKED_MESSAGE;
      this._noticeTone = "error";
      this._refreshNotice();
    }

    return false;
  }

  _applyBlockedState() {
    this._isRequestBlocked = true;
    this._isRealtimePaused = true;
    this._noticeMessage = SUPPORT_REQUESTS_BLOCKED_MESSAGE;
    this._noticeTone = "error";
    supportRealtimeService.disconnect();
  }

  _resumeRequestState() {
    this._isRequestBlocked = false;
    this._isRealtimePaused = false;
  }

  _resetComposerState() {
    this._replyDraftText = "";
    this._replyError = "";
    this._setReplyFileMeta(null);
  }

  _clearNotice() {
    if (this._isRequestBlocked) {
      this._noticeMessage = SUPPORT_REQUESTS_BLOCKED_MESSAGE;
      this._noticeTone = "error";
      return;
    }

    this._noticeMessage = "";
    this._noticeTone = "";
  }

  _clearRatingState() {
    this._ratingError = "";
  }

  _setReplyFileMeta(file = null) {
    this._hasReplyFileSelection = Boolean(file instanceof File && file.name);
    this._replyFileMeta = this._hasReplyFileSelection
      ? `Файл: ${file.name}`
      : DEFAULT_SUPPORT_REPLY_FILE_HINT;
  }

  _syncRatingDraftFromSelectedTicket(ticket = null, { force = false } = {}) {
    if (
      !ticket ||
      (ticket.status !== "resolved" && ticket.status !== "closed")
    ) {
      this._ratingValue = "";
      this._ratingError = "";
      return;
    }

    const normalizedTicketRating = normalizeSupportTicketRating(ticket.rating);
    const normalizedDraftRating = normalizeSupportTicketRating(this._ratingValue);

    if (force || !normalizedDraftRating) {
      this._ratingValue = normalizedTicketRating
        ? String(normalizedTicketRating)
        : "";
    }
  }

  _refreshNotice() {
    const noticeNode = this.el.querySelector("#support-tickets-notice");

    if (!noticeNode) {
      return;
    }

    noticeNode.textContent = this._noticeMessage || "";
    noticeNode.className = buildSupportNoticeClass(this._noticeTone);
  }

  _renderReplyState() {
    const errorNode = this.el.querySelector("#support-reply-error");

    if (errorNode) {
      errorNode.textContent = this._replyError || "";
    }

    this._refreshNotice();
  }

  _renderReplyFileState() {
    const fileMetaNode = this.el.querySelector("#support-reply-file-meta");

    if (!fileMetaNode) {
      return;
    }

    fileMetaNode.textContent = this._replyFileMeta;
    fileMetaNode.classList.toggle(
      "support-tickets__reply-file-meta--filled",
      this._hasReplyFileSelection,
    );
  }

  _renderRatingState() {
    const errorNode = this.el.querySelector("#support-rating-error");

    if (errorNode) {
      errorNode.textContent = this._ratingError || "";
    }
  }

  _capturePanelScrollState() {
    if (!this.el) {
      return null;
    }

    const ticketList = this.el.querySelector("#support-ticket-list");
    const messages = this.el.querySelector(".support-tickets__messages");

    return {
      ticketListScrollTop: ticketList?.scrollTop || 0,
      messagesScrollTop: messages?.scrollTop || 0,
      shouldStickMessagesToBottom: Boolean(
        messages &&
          messages.scrollHeight - messages.clientHeight - messages.scrollTop <= 48,
      ),
    };
  }

  _restorePanelScrollState(
    scrollState,
    { scrollMessagesToBottom = false } = {},
  ) {
    if (!scrollState || !this.el) {
      return;
    }

    const ticketList = this.el.querySelector("#support-ticket-list");
    const messages = this.el.querySelector(".support-tickets__messages");

    if (ticketList) {
      ticketList.scrollTop = scrollState.ticketListScrollTop;
    }

    if (messages) {
      if (scrollMessagesToBottom || scrollState.shouldStickMessagesToBottom) {
        this._scrollMessagesToBottom(scrollMessagesToBottom ? "smooth" : "auto");
        return;
      }

      messages.scrollTop = scrollState.messagesScrollTop;
    }
  }

  _scrollMessagesToBottom(behavior = "auto") {
    const messages = this.el?.querySelector(".support-tickets__messages");

    if (!messages) {
      return;
    }

    requestAnimationFrame(() => {
      messages.scrollTo({
        top: messages.scrollHeight,
        behavior,
      });
    });
  }
}

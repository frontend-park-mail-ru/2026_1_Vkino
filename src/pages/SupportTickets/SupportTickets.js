import BasePage from "../BasePage.js";
import "./SupportTickets.precompiled.js";
import "../../css/support-tickets.scss";

import HeaderComponent from "../../components/Header/Header.js";
import { supportRealtimeService } from "../../js/SupportRealtimeService.js";
import { supportService } from "../../js/SupportService.js";
import { router } from "../../router/index.js";
import { authStore } from "../../store/authStore.js";
import { getDisplayNameFromEmail } from "../../utils/user.js";
import {
  buildSupportConversationMessages,
  canManageSupportTicketStatus,
  extractSupportMessages,
  extractSupportTickets,
  shouldSyncSupportRealtimePayload,
} from "../../utils/support.js";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "open", label: "Открыты" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_user", label: "Ждут пользователя" },
  { value: "resolved", label: "Решено" },
  { value: "closed", label: "Закрыто" },
];

const STATUS_META = {
  open: {
    label: "Открыт",
    tone: "open",
  },
  in_progress: {
    label: "В работе",
    tone: "progress",
  },
  waiting_user: {
    label: "Ждёт пользователя",
    tone: "waiting",
  },
  resolved: {
    label: "Решено",
    tone: "resolved",
  },
  closed: {
    label: "Закрыто",
    tone: "resolved",
  },
};

const SUPPORT_REQUESTS_BLOCKED_MESSAGE =
  "Сервис обращений пока недоступен. Перезагрузите страницу после появления ручки.";

/**
 * Нативная страница со списком обращений пользователя и историей диалога.
 */
export default class SupportTicketsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "SupportTicketsPage: не передан корневой элемент для SupportTicketsPage",
      );
    }

    super(
      {
        isLoading: true,
        filterOptions: buildFilterOptions("all"),
        overviewCards: buildOverviewCards([]),
        ticketsSummary: "",
        emptyListMessage: "",
        tickets: [],
        selectedTicket: null,
        noticeMessage: "",
        noticeClass: "support-tickets__notice",
        noticeTone: "",
        replyError: "",
        replyDraft: "",
        ratingError: "",
        hasTickets: false,
        ...context,
      },
      Handlebars.templates["SupportTickets.hbs"],
      parent,
      el,
      "SupportTicketsPage",
    );

    this._authUnsubscribe = null;
    this._selectedStatus = "all";
    this._selectedTicketId = "";
    this._tickets = [];
    this._selectedMessages = [];
    this._noticeMessage = "";
    this._noticeTone = "";
    this._replyError = "";
    this._replyDraftText = "";
    this._ratingError = "";
    this._ratingValue = "";
    this._isRequestBlocked = false;
    this._isRealtimeUnavailable = false;
    this._isRealtimeSyncing = false;
    this._isViewRefreshInProgress = false;
    this._currentUser = {
      id: "",
      email: "",
      displayName: "",
      role: "user",
      isAdmin: false,
      canManageStatuses: false,
    };
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

        if (!nextState.user) {
          router.go("/sign-in");
          return;
        }

        this._currentUser = this._resolveCurrentUser(nextState.user);

        if (this._currentUser.canManageStatuses) {
          router.go("/admin/support");
          return;
        }

        super.init();
        if (!this._isViewRefreshInProgress) {
          await this.loadContext({ preserveSelection: false });
        }
      });

      return super.init();
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    this._currentUser = this._resolveCurrentUser(state.user);

    if (this._currentUser.canManageStatuses) {
      router.go("/admin/support");
      return this;
    }

    super.init();

    if (!this._isViewRefreshInProgress) {
      this.loadContext({ preserveSelection: false });
    }

    return this;
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

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "SupportTicketsPage: не найден header в шаблоне SupportTickets.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));
  }

  async loadContext({ preserveSelection = true, showLoading = false } = {}) {
    if (!this._canRequest()) {
      return;
    }

    if (showLoading) {
      this._refreshView({ isLoading: true });
    }

    const previousSelectedTicketId = preserveSelection
      ? this._selectedTicketId
      : "";
    const ticketsResult = await supportService.getTickets();

    if (await this._handleUnauthorized(ticketsResult)) {
      return;
    }

    if (!ticketsResult.ok) {
      this._tickets = [];
      this._selectedMessages = [];
      this._selectedTicketId = "";
      this._applyRequestError(ticketsResult, "Не удалось загрузить обращения.");
      this._refreshView();
      return;
    }

    this._tickets = extractSupportTickets(ticketsResult.resp, {
      currentUserId: this._currentUser.id,
      currentUserEmail: this._currentUser.email,
    });
    this._selectedTicketId = this._resolveSelectedTicketId(
      previousSelectedTicketId,
    );
    this._selectedMessages = [];
    this._syncRatingDraftFromSelectedTicket({ force: true });

    const messagesResult = await this._loadSelectedMessages({
      showError: false,
    });

    if (messagesResult.status === 401) {
      return;
    }

    if (
      !messagesResult.ok &&
      messagesResult.error &&
      messagesResult.status !== 404
    ) {
      this._noticeMessage = messagesResult.error;
      this._noticeTone = "error";
    }

    this._refreshView();

    if (!this._isRealtimeUnavailable) {
      this._connectRealtime();
      this._syncRealtimeSubscription();
    }
  }

  _onClick = async (event) => {
    const actionButton = event.target.closest("[data-ticket-action]");

    if (actionButton) {
      const actionValue = String(actionButton.dataset.ticketAction || "").trim();

      if (!actionValue || actionButton.disabled) {
        return;
      }

      await this._applyTicketAction(actionValue);
      return;
    }

    const ticketCard = event.target.closest("[data-ticket-id]");

    if (!ticketCard) {
      return;
    }

    const nextTicketId = String(ticketCard.dataset.ticketId || "").trim();

    if (!nextTicketId || nextTicketId === this._selectedTicketId) {
      return;
    }

    this._selectedTicketId = nextTicketId;
    this._selectedMessages = [];
    this._replyDraftText = "";
    this._clearComposerState();
    this._syncRatingDraftFromSelectedTicket({ force: true });

    if (this._canRequest(false)) {
      const messagesResult = await this._loadSelectedMessages({
        showError: true,
      });

      if (messagesResult.status === 401) {
        return;
      }
    }

    this._refreshView();
    this._connectRealtime();
    this._syncRealtimeSubscription();
  };

  _onChange = async (event) => {
    if (event.target.matches('[name="statusFilter"]')) {
      this._selectedStatus = String(event.target.value || "all");
      this._replyDraftText = "";
      this._clearComposerState();

      const previousSelectedTicketId = this._selectedTicketId;

      this._selectedTicketId = this._resolveSelectedTicketId(
        previousSelectedTicketId,
      );
      this._syncRatingDraftFromSelectedTicket({ force: true });

      if (previousSelectedTicketId !== this._selectedTicketId) {
        this._selectedMessages = [];

        if (this._canRequest(false)) {
          const messagesResult = await this._loadSelectedMessages({
            showError: false,
          });

          if (messagesResult.status === 401) {
            return;
          }
        }
      }

      this._refreshView();
      this._connectRealtime();
      this._syncRealtimeSubscription();
      return;
    }

    if (event.target.matches('[name="replyFile"]')) {
      this._replyError = "";
      this._renderReplyState();
      this._renderReplyFileState(event.target.files?.[0] || null);
      return;
    }

    if (event.target.matches('[name="ticketRating"]')) {
      this._ratingValue = String(event.target.value || "");
      this._ratingError = "";
      this._renderRatingState();
      return;
    }

    if (event.target.matches('[name="reply"]')) {
      this._replyDraftText = String(event.target.value || "");
      this._replyError = "";
      this._renderReplyState();
    }
  };

  _onInput = (event) => {
    if (!event.target.matches('[name="reply"]')) {
      return;
    }

    this._replyDraftText = String(event.target.value || "");
    this._replyError = "";
    this._renderReplyState();
  };

  _onSubmit = async (event) => {
    const ratingForm = event.target.closest('[data-action="rate-ticket"]');

    if (ratingForm) {
      event.preventDefault();
      await this._handleRatingSubmit(ratingForm);
      return;
    }

    const form = event.target.closest('[data-action="reply-ticket"]');

    if (!form) {
      return;
    }

    event.preventDefault();
    await this._handleReplySubmit(form);
  };

  async _handleReplySubmit(form) {
    const selectedTicket = this._getSelectedTicket();

    if (!selectedTicket) {
      return;
    }

    const formData = new FormData(form);
    const replyText = normalizeText(formData.get("reply"));
    const replyFile = pickSelectedFile(formData.get("replyFile"));

    if (!replyText && !(replyFile instanceof File)) {
      this._replyError = "Напишите ответ или приложите файл.";
      this._noticeMessage = "";
      this._noticeTone = "";
      this._renderReplyState();
      return;
    }

    if (!this._canRequest()) {
      return;
    }

    const result = await supportService.createTicketMessage(selectedTicket.id, {
      message: replyText,
      attachment: replyFile,
    });

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      if (result.status === 404) {
        this._replyError = "";
        this._applyRequestError(result, "Не удалось отправить сообщение.");
        this._refreshView();
        return;
      }

      this._replyError = result.error || "Не удалось отправить сообщение.";
      this._noticeMessage = "";
      this._noticeTone = "";
      this._renderReplyState();
      return;
    }

    const sentAt = new Date().toISOString();

    this._selectedMessages = [
      ...this._selectedMessages,
      buildLocalReplyMessage({
        text: replyText,
        attachmentName: replyFile?.name || "",
        senderId: this._currentUser.id,
        senderName: this._currentUser.displayName,
        senderEmail: this._currentUser.email,
        sentAt,
      }),
    ];
    this._touchTicket(selectedTicket.id, {
      updatedAt: sentAt,
    });
    this._replyError = "";
    this._noticeMessage = "Сообщение отправлено.";
    this._noticeTone = "info";
    this._replyDraftText = "";
    form.reset();
    this._refreshView();
    this._connectRealtime();
    this._syncRealtimeSubscription();
  }

  async _handleRatingSubmit(form) {
    const selectedTicket = this._getSelectedTicket();
    const rating = normalizeTicketRating(
      new FormData(form).get("ticketRating") || this._ratingValue,
    );

    if (
      !selectedTicket ||
      this._currentUser.role !== "user" ||
      (selectedTicket.status !== "resolved" &&
        selectedTicket.status !== "closed")
    ) {
      return;
    }

    if (!rating) {
      this._ratingError = "Выберите оценку от 1 до 5.";
      this._renderRatingState();
      return;
    }

    if (!this._canRequest()) {
      return;
    }

    const result = await supportService.updateTicket(selectedTicket.id, {
      rating,
    });

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      if (result.status === 404) {
        this._applyRequestError(result, "Не удалось обновить обращение.");
        this._refreshView();
        return;
      }

      this._ratingError = resolveRatingErrorMessage(result);
      this._renderRatingState();
      return;
    }

    this._touchTicket(selectedTicket.id, {
      rating,
      updatedAt: new Date().toISOString(),
    });
    this._ratingValue = String(rating);
    this._ratingError = "";
    this._noticeMessage = `Оценка для обращения #${selectedTicket.id} сохранена.`;
    this._noticeTone = "info";
    this._refreshView();
  }

  async _applyTicketAction(nextStatus) {
    const selectedTicket = this._getSelectedTicket();

    if (!selectedTicket || !STATUS_META[nextStatus]) {
      return;
    }

    if (!canApplyActionByRole(this._currentUser.role, nextStatus)) {
      return;
    }

    if (!this._canRequest()) {
      return;
    }

    const result = await supportService.updateTicket(selectedTicket.id, {
      status: nextStatus,
    });

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      if (result.status === 404) {
        this._applyRequestError(
          result,
          "Не удалось обновить статус обращения.",
        );
        this._refreshView();
        return;
      }

      this._noticeMessage =
        result.error || "Не удалось обновить статус обращения.";
      this._noticeTone = "error";
      this._refreshView();
      return;
    }

    this._touchTicket(selectedTicket.id, {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    });
    this._syncRatingDraftFromSelectedTicket({ force: true });
    this._noticeMessage = `Статус обращения #${selectedTicket.id} обновлён.`;
    this._noticeTone = "info";

    const previousSelectedTicketId = this._selectedTicketId;

    this._selectedTicketId = this._resolveSelectedTicketId(
      previousSelectedTicketId,
    );

    if (previousSelectedTicketId !== this._selectedTicketId) {
      this._selectedMessages = [];

      if (this._canRequest(false)) {
        const messagesResult = await this._loadSelectedMessages({
          showError: false,
        });

        if (messagesResult.status === 401) {
          return;
        }
      }
    }

    this._refreshView();
    this._connectRealtime();
    this._syncRealtimeSubscription();
  }

  async _loadSelectedMessages({ showError = true } = {}) {
    if (!this._selectedTicketId) {
      this._selectedMessages = [];

      return {
        ok: true,
        status: 200,
        resp: [],
        error: "",
      };
    }

    if (!this._canRequest(false)) {
      this._selectedMessages = [];

      return {
        ok: false,
        status: 404,
        resp: null,
        error: SUPPORT_REQUESTS_BLOCKED_MESSAGE,
      };
    }

    const result = await supportService.getTicketMessages(
      this._selectedTicketId,
    );

    if (await this._handleUnauthorized(result)) {
      return {
        ok: false,
        status: 401,
        resp: null,
        error: "Требуется повторная авторизация",
      };
    }

    if (!result.ok) {
      this._selectedMessages = [];

      if (result.status === 404) {
        this._applyRequestError(
          result,
          "Не удалось загрузить сообщения обращения.",
        );
      } else if (showError) {
        this._noticeMessage =
          result.error || "Не удалось загрузить сообщения обращения.";
        this._noticeTone = "error";
      }

      return result;
    }

    const selectedTicket = this._getSelectedTicket();
    const extractedMessages = extractSupportMessages(result.resp, {
      currentUserId: this._currentUser.id || selectedTicket?.userId,
      currentUserEmail: this._currentUser.email,
    });

    this._selectedMessages = buildSupportConversationMessages(
      selectedTicket,
      extractedMessages,
      {
        currentUserId: this._currentUser.id || selectedTicket?.userId,
        currentUserEmail: this._currentUser.email,
        currentUserDisplayName: this._currentUser.displayName,
      },
    );

    return result;
  }

  _buildViewContext(overrides = {}) {
    const filteredTickets = this._getFilteredTickets();
    const selectedTicket =
      filteredTickets.find((ticket) => ticket.id === this._selectedTicketId) ||
      null;
    const selectedFilterLabel = getFilterLabel(this._selectedStatus);

    return {
      isLoading: false,
      isAdmin: this._currentUser.isAdmin,
      filterOptions: buildFilterOptions(this._selectedStatus),
      overviewCards: buildOverviewCards(this._tickets),
      ticketsSummary: buildTicketsSummary(
        filteredTickets.length,
        this._selectedStatus,
        selectedFilterLabel,
      ),
      emptyListMessage: buildEmptyListMessage(this._selectedStatus),
      tickets: filteredTickets.map((ticket) =>
        buildTicketCardView(ticket, this._selectedTicketId),
      ),
      selectedTicket: selectedTicket
        ? buildSelectedTicketView(
            selectedTicket,
            this._selectedMessages,
            {
              id: this._currentUser.id,
              email: this._currentUser.email,
              displayName: this._currentUser.displayName,
              role: this._currentUser.role,
              isAdmin: this._currentUser.isAdmin,
              canManageStatuses: this._currentUser.canManageStatuses,
              ratingValue: this._ratingValue,
            },
          )
        : null,
      noticeMessage: this._noticeMessage,
      noticeClass: buildNoticeClass(this._noticeTone),
      noticeTone: this._noticeTone,
      replyError: this._replyError,
      replyDraft: this._replyDraftText,
      ratingError: this._ratingError,
      hasTickets: Boolean(filteredTickets.length),
      ...overrides,
    };
  }

  _refreshView(overrides = {}) {
    if (!this.el) {
      return;
    }

    this._isViewRefreshInProgress = true;

    try {
      this.refresh(this._buildViewContext(overrides));
    } finally {
      this._isViewRefreshInProgress = false;
    }
  }

  _getFilteredTickets() {
    if (this._selectedStatus === "all") {
      return this._tickets;
    }

    return this._tickets.filter(
      (ticket) => ticket.status === this._selectedStatus,
    );
  }

  _getSelectedTicket() {
    return (
      this._tickets.find((ticket) => ticket.id === this._selectedTicketId) ||
      null
    );
  }

  _resolveSelectedTicketId(preferredTicketId = "") {
    const filteredTickets = this._getFilteredTickets();

    if (!filteredTickets.length) {
      return "";
    }

    if (
      preferredTicketId &&
      filteredTickets.some((ticket) => ticket.id === preferredTicketId)
    ) {
      return preferredTicketId;
    }

    return filteredTickets[0]?.id || "";
  }

  _touchTicket(ticketId, updates = {}) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return;
    }

    this._tickets = this._tickets.map((ticket) =>
      ticket.id === normalizedTicketId
        ? {
            ...ticket,
            ...updates,
          }
        : ticket,
    );
  }

  _clearComposerState() {
    this._replyError = "";
    this._ratingError = "";

    if (this._isRequestBlocked) {
      this._noticeMessage = SUPPORT_REQUESTS_BLOCKED_MESSAGE;
      this._noticeTone = "error";
      return;
    }

    this._noticeMessage = "";
    this._noticeTone = "";
  }

  _renderReplyState() {
    const errorNode = this.el.querySelector("#support-reply-error");
    const noticeNode = this.el.querySelector("#support-tickets-notice");

    if (errorNode) {
      errorNode.textContent = this._replyError || "";
    }

    if (!noticeNode) {
      return;
    }

    noticeNode.textContent = this._noticeMessage || "";
    noticeNode.className = "support-tickets__notice";

    if (this._noticeMessage && this._noticeTone) {
      noticeNode.classList.add(`support-tickets__notice--${this._noticeTone}`);
    }
  }

  _renderRatingState() {
    const errorNode = this.el.querySelector("#support-rating-error");

    if (errorNode) {
      errorNode.textContent = this._ratingError || "";
    }
  }

  _renderReplyFileState(file = null) {
    const fileMetaNode = this.el.querySelector("#support-reply-file-meta");

    if (!fileMetaNode) {
      return;
    }

    if (file instanceof File && file.name) {
      fileMetaNode.textContent = `Файл: ${file.name}`;
      fileMetaNode.classList.add("support-tickets__reply-file-meta--filled");
      return;
    }

    fileMetaNode.textContent = "Можно приложить PNG, JPG, WEBP или PDF до 10 МБ";
    fileMetaNode.classList.remove("support-tickets__reply-file-meta--filled");
  }

  _resolveCurrentUser(user = authStore.getState().user || {}) {
    const id = String(user?.id || user?.user_id || "").trim();
    const email = String(user?.email || "user@vkino.tech").trim();
    const role = String(user?.role || "user").trim().toLowerCase() || "user";

    return {
      id,
      email,
      displayName: getDisplayNameFromEmail(email) || "Вы",
      role,
      isAdmin: isAdminRole(role),
      canManageStatuses: canManageSupportTicketStatus(role),
    };
  }

  _syncRatingDraftFromSelectedTicket({ force = false } = {}) {
    const selectedTicket = this._getSelectedTicket();

    if (
      !selectedTicket ||
      (selectedTicket.status !== "resolved" &&
        selectedTicket.status !== "closed")
    ) {
      this._ratingValue = "";
      this._ratingError = "";
      return;
    }

    const normalizedTicketRating = normalizeTicketRating(selectedTicket.rating);
    const normalizedDraftRating = normalizeTicketRating(this._ratingValue);

    if (force || !normalizedDraftRating) {
      this._ratingValue = normalizedTicketRating
        ? String(normalizedTicketRating)
        : "";
    }
  }

  _connectRealtime() {
    if (this._isRequestBlocked || this._isRealtimeUnavailable) {
      return;
    }

    supportRealtimeService.connect({
      onMessage: this._handleRealtimeMessage,
      onError: this._handleRealtimeError,
    });
  }

  _syncRealtimeSubscription() {
    if (this._isRequestBlocked || this._isRealtimeUnavailable) {
      supportRealtimeService.disconnect();
      return;
    }

    if (!this._selectedTicketId) {
      supportRealtimeService.unsubscribe();
      return;
    }

    supportRealtimeService.subscribe(this._selectedTicketId);
  }

  _handleRealtimeMessage = async (payload) => {
    if (
      this._isRequestBlocked ||
      this._isRealtimeSyncing ||
      !shouldSyncSupportRealtimePayload(payload, this._selectedTicketId)
    ) {
      return;
    }

    this._isRealtimeSyncing = true;

    try {
      const messagesResult = await this._loadSelectedMessages({
        showError: false,
      });

      if (messagesResult.status === 401) {
        return;
      }

      if (messagesResult.ok) {
        this._touchTicket(this._selectedTicketId, {
          updatedAt: new Date().toISOString(),
        });
        this._noticeMessage = "Диалог обновлён в реальном времени.";
        this._noticeTone = "info";
      }

      this._refreshView();
      this._connectRealtime();
      this._syncRealtimeSubscription();
    } finally {
      this._isRealtimeSyncing = false;
    }
  };

  _handleRealtimeError = () => {
    if (this._isRequestBlocked) {
      return;
    }

    this._isRealtimeUnavailable = true;
    supportRealtimeService.disconnect();
    this._noticeMessage =
      "WS недоступен. Перезагрузите страницу, чтобы получить новые сообщения и статусы.";
    this._noticeTone = "error";
    this._refreshView();
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
      this._refreshView();
    }

    return false;
  }

  _applyRequestError(result, fallbackMessage) {
    if (result?.status === 404) {
      this._isRequestBlocked = true;
      this._noticeMessage = SUPPORT_REQUESTS_BLOCKED_MESSAGE;
      this._noticeTone = "error";
      supportRealtimeService.disconnect();
      return;
    }

    this._noticeMessage = result?.error || fallbackMessage;
    this._noticeTone = "error";
  }
}

function buildFilterOptions(selectedStatus) {
  return STATUS_FILTER_OPTIONS.map((option) => ({
    ...option,
    selectedAttr: option.value === selectedStatus ? " selected" : "",
  }));
}

function buildSelectedTicketView(ticket, messages = [], userContext = {}) {
  const statusMeta = getStatusMeta(ticket.status);
  const actionButtons = buildTicketActionButtons();
  const resolvedRating = normalizeTicketRating(
    userContext.ratingValue || ticket.rating,
  );
  const canRate =
    userContext.role === "user" &&
    (ticket.status === "resolved" || ticket.status === "closed");

  return {
    id: ticket.id,
    subject: ticket.subject,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    subtitle: `Обращение #${ticket.id} • ${ticket.subject}`,
    updatedAtLabel: `Обновлено ${formatCardDate(ticket.updatedAt || ticket.createdAt)}`,
    messagesCountLabel: `${messages.length} ${pluralizeSupportMessages(messages.length)}`,
    hasMessages: Boolean(messages.length),
    messages: messages.map((message) => ({
      messageClass: message.isFromCurrentUser
        ? "support-tickets__message support-tickets__message--outgoing"
        : "support-tickets__message",
      senderLabel:
        message.senderName ||
        (message.isFromCurrentUser
          ? userContext.displayName || "Вы"
          : "Поддержка"),
      sentAtLabel: formatMessageDate(message.sentAt),
      text: message.text,
      attachmentName: message.attachmentName,
      isOutgoing: message.isFromCurrentUser,
    })),
    actionButtons,
    hasActionButtons: Boolean(actionButtons.length),
    canRate,
    ratingSummary: resolvedRating
      ? `Текущая оценка: ${resolvedRating} из 5`
      : "Оценка ещё не выставлена.",
    ratingSubmitLabel: resolvedRating ? "Обновить оценку" : "Сохранить оценку",
    ratingOptions: buildRatingOptions(resolvedRating),
  };
}

function buildTicketCardView(ticket, selectedTicketId) {
  const statusMeta = getStatusMeta(ticket.status);

  return {
    id: ticket.id,
    cardClass:
      ticket.id === selectedTicketId
        ? "support-tickets__ticket-card support-tickets__ticket-card--active"
        : "support-tickets__ticket-card",
    subject: ticket.subject,
    statusLabel: statusMeta.label,
    statusTone: statusMeta.tone,
    metaLabel: `#${ticket.id}`,
    updatedAtLabel: formatCardDate(ticket.updatedAt || ticket.createdAt),
    isActive: ticket.id === selectedTicketId,
  };
}

function buildOverviewCards(tickets = []) {
  const summary = tickets.reduce(
    (acc, ticket) => {
      acc.total += 1;

      if (ticket.status === "open" || ticket.status === "waiting_user") {
        acc.attention += 1;
      }

      if (ticket.status === "in_progress") {
        acc.inProgress += 1;
      }

      if (ticket.status === "resolved" || ticket.status === "closed") {
        acc.resolved += 1;
      }

      return acc;
    },
    {
      total: 0,
      attention: 0,
      inProgress: 0,
      resolved: 0,
    },
  );

  return [
    {
      label: "Всего обращений",
      value: String(summary.total),
      caption: "Вся история поддержки",
    },
    {
      label: "Нужен ответ",
      value: String(summary.attention),
      caption: "Новые и ожидающие",
    },
    {
      label: "В работе",
      value: String(summary.inProgress),
      caption: "Обращения в процессе",
    },
    {
      label: "Закрыто",
      value: String(summary.resolved),
      caption: "Уже решённые кейсы",
    },
  ];
}

function buildTicketsSummary(count, selectedStatus, selectedFilterLabel) {
  if (!count) {
    if (selectedStatus === "all") {
      return "Пока нет обращений. Создайте первое, чтобы начать диалог с поддержкой.";
    }

    return `В фильтре «${selectedFilterLabel}» пока пусто.`;
  }

  if (selectedStatus === "all") {
    return `${count} ${pluralizeSupportTickets(count)} в вашей истории поддержки.`;
  }

  return `${count} ${pluralizeSupportTickets(count)} со статусом «${selectedFilterLabel}».`;
}

function buildEmptyListMessage(selectedStatus) {
  if (selectedStatus === "all") {
    return "Создайте первое обращение, чтобы быстро связаться с поддержкой и отслеживать ответ прямо в диалоге.";
  }

  return `По статусу «${getFilterLabel(selectedStatus)}» обращений пока нет. Попробуйте другой фильтр или создайте новое обращение.`;
}

function buildTicketActionButtons() {
  return [];
}

function canApplyActionByRole(role, nextStatus) {
  if (canManageSupportTicketStatus(role)) {
    return (
      nextStatus === "open" ||
      nextStatus === "in_progress" ||
      nextStatus === "waiting_user" ||
      nextStatus === "resolved" ||
      nextStatus === "closed"
    );
  }

  return false;
}

function buildNoticeClass(tone) {
  if (!tone) {
    return "support-tickets__notice";
  }

  return `support-tickets__notice support-tickets__notice--${tone}`;
}

function getFilterLabel(status) {
  return (
    STATUS_FILTER_OPTIONS.find((option) => option.value === status)?.label ||
    STATUS_FILTER_OPTIONS[0].label
  );
}

function getStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.open;
}

function formatCardDate(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function formatMessageDate(value) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsedDate);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function pluralizeSupportTickets(count) {
  const absCount = Math.abs(Number(count));
  const lastTwoDigits = absCount % 100;
  const lastDigit = absCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "обращений";
  }

  if (lastDigit === 1) {
    return "обращение";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "обращения";
  }

  return "обращений";
}

function pluralizeSupportMessages(count) {
  const absCount = Math.abs(Number(count));
  const lastTwoDigits = absCount % 100;
  const lastDigit = absCount % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "сообщений";
  }

  if (lastDigit === 1) {
    return "сообщение";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "сообщения";
  }

  return "сообщений";
}

function buildRatingOptions(selectedRating = 0) {
  return [1, 2, 3, 4, 5].map((value) => ({
    value: String(value),
    label: `${value} из 5`,
    selectedAttr: value === selectedRating ? " selected" : "",
  }));
}

function buildLocalReplyMessage({
  senderId = "",
  text = "",
  attachmentName = "",
  senderName = "",
  senderEmail = "",
  sentAt = "",
} = {}) {
  return {
    id: crypto.randomUUID?.() ?? String(Date.now()),
    senderId,
    senderName,
    senderEmail,
    sentAt: sentAt || new Date().toISOString(),
    text: text || (attachmentName ? "Прикреплён файл" : ""),
    attachmentName,
    isFromAdmin: false,
    isFromCurrentUser: true,
  };
}

function isAdminRole(role = "") {
  return String(role || "").trim().toLowerCase() === "admin";
}

function pickSelectedFile(value) {
  if (!(value instanceof File)) {
    return null;
  }

  if (!value.name && value.size === 0) {
    return null;
  }

  return value;
}

function normalizeTicketRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 0;
  }

  return rating;
}

function resolveRatingErrorMessage(result = {}) {
  const rawError = String(
    result.error ||
      result.resp?.Error ||
      result.resp?.error ||
      result.resp?.message ||
      "",
  )
    .trim()
    .toLowerCase();

  if (result.status === 400 && rawError.includes("invalid_json_body")) {
    return "Текущий контракт PATCH /support/tickets/{id} на бэке пока не принимает поле rating.";
  }

  return result.error || "Не удалось сохранить оценку.";
}

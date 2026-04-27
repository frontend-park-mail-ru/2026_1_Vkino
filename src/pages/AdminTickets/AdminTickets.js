import BasePage from "../BasePage.js";
import "./AdminTickets.precompiled.js";
import "../../css/support-tickets.scss";
import "../../css/admin-tickets.scss";

import HeaderComponent from "../../components/Header/Header.js";
import {
  useAdminTickets,
  getAdminTicketStatusMeta,
} from "../../hooks/useAdminTickets.js";
import { supportRealtimeService } from "../../js/SupportRealtimeService.js";
import { router } from "../../router/index.js";
import { authStore } from "../../store/authStore.js";
import { getDisplayNameFromEmail } from "../../utils/user.js";
import {
  canManageSupportTicketStatus,
  getSupportCategoryLabel,
  shouldSyncSupportRealtimePayload,
} from "../../utils/support.js";

/**
 * Нативная страница администратора со всеми обращениями системы.
 */
export default class AdminTicketsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "AdminTicketsPage: не передан корневой элемент для AdminTicketsPage",
      );
    }

    super(
      {
        isLoading: true,
        searchQuery: "",
        statusOptions: [],
        categoryOptions: [],
        statisticsCards: [],
        tickets: [],
        selectedTicket: null,
        noticeClass: "support-tickets__notice",
        noticeMessage: "",
        replyError: "",
        hasTickets: false,
        ...context,
      },
      Handlebars.templates["AdminTickets.hbs"],
      parent,
      el,
      "AdminTicketsPage",
    );

    this._authUnsubscribe = null;
    this._ticketsHook = null;
    this._noticeMessage = "";
    this._noticeTone = "";
    this._replyError = "";
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

        if (!nextState.user) {
          router.go("/sign-in");
          return;
        }

        if (!canManageSupportTicketStatus(nextState.user?.role)) {
          router.go("/support");
          return;
        }

        this._ensureTicketsHook(nextState.user);
        super.init();

        if (!this._isViewRefreshInProgress) {
          await this.loadContext();
        }
      });

      return super.init();
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    if (!canManageSupportTicketStatus(state.user?.role)) {
      router.go("/support");
      return this;
    }

    this._ensureTicketsHook(state.user);
    super.init();

    if (!this._isViewRefreshInProgress) {
      this.loadContext();
    }

    return this;
  }

  async loadContext({ source = "manual" } = {}) {
    if (!this._ticketsHook) {
      return;
    }

    if (source === "realtime") {
      if (this._isRealtimePaused || this._isRealtimeRequestInFlight) {
        return;
      }

      this._isRealtimeRequestInFlight = true;
    }

    try {
      const result = await this._ticketsHook.load();

      if (result.aborted) {
        return;
      }

      if (await this._handleUnauthorized(result)) {
        return;
      }

      if (!result.ok && result.error) {
        this._noticeMessage = result.error;
        this._noticeTone = "error";

        if (result.status === 404) {
          this._pauseRealtimeSync();
        }
      } else if (result.ok) {
        this._resumeRealtimeSync();
      }

      if (!this.el) {
        return;
      }

      this._refreshView(result.snapshot);

      if (!this._isRealtimePaused && !this._isRealtimeUnavailable) {
        this._connectRealtime();
        this._syncRealtimeSubscription();
      }
    } finally {
      if (source === "realtime") {
        this._isRealtimeRequestInFlight = false;
      }
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

  _refreshView(snapshot) {
    if (!this.el) {
      return;
    }

    this._isViewRefreshInProgress = true;

    try {
      this.refresh(this._buildViewContext(snapshot));
    } finally {
      this._isViewRefreshInProgress = false;
    }
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "AdminTicketsPage: не найден header в шаблоне AdminTickets.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));
  }

  _onClick = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (actionTarget?.dataset.action === "close-ticket") {
      event.preventDefault();
      await this._handleCloseTicket();
      return;
    }

    const ticketCard = event.target.closest("[data-ticket-id]");

    if (!ticketCard || !this._ticketsHook) {
      return;
    }

    this._clearUiFeedback();
    const result = await this._ticketsHook.selectTicket(
      ticketCard.dataset.ticketId,
    );
    await this._applyHookResult(result);
  };

  _onChange = async (event) => {
    if (!this._ticketsHook) {
      return;
    }

    if (event.target.matches('[name="statusFilter"]')) {
      this._clearUiFeedback();
      const result = await this._ticketsHook.setStatusFilter(
        event.target.value,
      );
      await this._applyHookResult(result);
      return;
    }

    if (event.target.matches('[name="categoryFilter"]')) {
      this._clearUiFeedback();
      const result = await this._ticketsHook.setCategoryFilter(
        event.target.value,
      );
      await this._applyHookResult(result);
      return;
    }

    if (event.target.matches('[name="reply"]')) {
      this._replyError = "";
      this._refreshReplyError();
    }
  };

  _onInput = async (event) => {
    if (!this._ticketsHook) {
      return;
    }

    if (event.target.matches('[name="ticketSearch"]')) {
      this._clearUiFeedback();
      const result = await this._ticketsHook.setSearchQuery(event.target.value);
      await this._applyHookResult(result);
      return;
    }

    if (event.target.matches('[name="reply"]')) {
      this._replyError = "";
      this._refreshReplyError();
    }
  };

  _onSubmit = async (event) => {
    const statusForm = event.target.closest('[data-action="update-ticket-status"]');

    if (statusForm) {
      event.preventDefault();
      await this._handleStatusSubmit(statusForm);
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
    if (!this._ticketsHook) {
      return;
    }

    const formData = new FormData(form);
    const replyFile = pickSelectedFile(formData.get("replyFile"));
    const result = await this._ticketsHook.replyToSelectedTicket({
      text: formData.get("reply"),
      attachment: replyFile,
    });

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      this._replyError = result.error || "Не удалось отправить ответ";
      this._noticeMessage = "";
      this._noticeTone = "";
      this._refreshNotice();
      this._refreshReplyError();
      return;
    }

    this._replyError = "";
    this._noticeMessage = result.message || "";
    this._noticeTone = "info";
    form.reset();
    await this._applyHookResult(result);
  }

  async _handleStatusSubmit(form) {
    if (!this._ticketsHook) {
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
      this._noticeMessage = result.error || "Не удалось обновить статус.";
      this._noticeTone = "error";
      this.refresh(this._buildViewContext(result.snapshot));
      return;
    }

    this._noticeMessage = result.message || "";
    this._noticeTone = "info";
    await this._applyHookResult(result);
  }

  async _handleCloseTicket() {
    if (!this._ticketsHook) {
      return;
    }

    const result = await this._ticketsHook.closeSelectedTicket();

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok) {
      this._noticeMessage = result.error || "Не удалось закрыть обращение.";
      this._noticeTone = "error";
      this.refresh(this._buildViewContext(result.snapshot));
      return;
    }

    this._replyError = "";
    this._noticeMessage = result.message || "";
    this._noticeTone = "info";
    await this._applyHookResult(result);
  }

  async _applyHookResult(result = {}) {
    if (result.aborted) {
      return;
    }

    if (await this._handleUnauthorized(result)) {
      return;
    }

    if (!result.ok && result.error) {
      this._noticeMessage = result.error;
      this._noticeTone = "error";

      if (result.status === 404) {
        this._pauseRealtimeSync();
      }
    } else if (result.ok) {
      this._resumeRealtimeSync();
    }

    if (!this.el) {
      return;
    }

    this.refresh(this._buildViewContext(result.snapshot));

    if (!this._isRealtimePaused && !this._isRealtimeUnavailable) {
      this._connectRealtime();
      this._syncRealtimeSubscription();
    }
  }

  _buildViewContext(snapshot = this._ticketsHook?.getSnapshot() || {}) {
    const selectedTicket = snapshot.selectedTicket
      ? buildSelectedTicketView(
          snapshot.selectedTicket,
          snapshot.selectedMessages,
          snapshot.currentAdmin || {},
        )
      : null;

    return {
      isLoading: false,
      searchQuery: snapshot.searchQuery || "",
      statusOptions: (snapshot.statusOptions || []).map((option) => ({
        ...option,
        selectedAttr: option.value === snapshot.statusFilter ? " selected" : "",
      })),
      categoryOptions: (snapshot.categoryOptions || []).map((option) => ({
        ...option,
        selectedAttr:
          option.value === snapshot.categoryFilter ? " selected" : "",
      })),
      statisticsCards: snapshot.statisticsCards || [],
      tickets: (snapshot.filteredTickets || []).map((ticket) =>
        buildTicketCardView(ticket, snapshot.selectedTicket?.id),
      ),
      selectedTicket,
      noticeClass: buildNoticeClass(this._noticeTone, this._noticeMessage),
      noticeMessage: this._noticeMessage,
      replyError: this._replyError,
      hasTickets: Boolean(snapshot.filteredTickets?.length),
    };
  }

  _clearUiFeedback() {
    this._replyError = "";
    this._noticeMessage = "";
    this._noticeTone = "";
  }

  _refreshReplyError() {
    const errorNode = this.el.querySelector("#admin-tickets-reply-error");

    if (errorNode) {
      errorNode.textContent = this._replyError || "";
    }
  }

  _refreshNotice() {
    const noticeNode = this.el.querySelector("#admin-tickets-notice");

    if (!noticeNode) {
      return;
    }

    noticeNode.textContent = this._noticeMessage || "";
    noticeNode.className = buildNoticeClass(
      this._noticeTone,
      this._noticeMessage,
    );
  }

  _ensureTicketsHook(user) {
    if (this._ticketsHook) {
      return;
    }

    this._ticketsHook = useAdminTickets({
      id: user?.id || user?.user_id || "",
      email: user?.email || "admin@vkino.tech",
      role: user?.role || "admin",
      displayName:
        getDisplayNameFromEmail(user?.email || "") || "Администратор VKino",
    });
  }

  _connectRealtime() {
    if (this._isRealtimeUnavailable) {
      return;
    }

    supportRealtimeService.connect({
      onMessage: this._handleRealtimeMessage,
      onError: this._handleRealtimeError,
    });
  }

  _syncRealtimeSubscription() {
    if (this._isRealtimePaused || this._isRealtimeUnavailable) {
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
      this._isRealtimePaused ||
      this._isRealtimeRequestInFlight ||
      !shouldSyncSupportRealtimePayload(payload, selectedTicketId)
    ) {
      return;
    }

    this._isRealtimeRequestInFlight = true;
    const result = await this._ticketsHook.handleRealtimeSync();

    try {
      if (result.aborted) {
        return;
      }

      if (await this._handleUnauthorized(result)) {
        return;
      }

      this._noticeMessage = result.message || "";
      this._noticeTone = "info";
      await this._applyHookResult(result);
    } finally {
      this._isRealtimeRequestInFlight = false;
    }
  };

  _handleRealtimeError = () => {
    this._isRealtimeUnavailable = true;
    supportRealtimeService.disconnect();
    this._noticeMessage =
      "WS недоступен. Перезагрузите страницу, чтобы получить новые сообщения и статусы.";
    this._noticeTone = "error";
    this.refresh(this._buildViewContext());
  };

  async _handleUnauthorized(result) {
    if (result?.status !== 401) {
      return false;
    }

    await authStore.logout();
    router.go("/sign-in");
    return true;
  }

  _pauseRealtimeSync() {
    if (this._isRealtimePaused) {
      return;
    }

    this._isRealtimePaused = true;
    supportRealtimeService.disconnect();
  }

  _resumeRealtimeSync() {
    this._isRealtimePaused = false;
  }
}

function buildTicketCardView(ticket, selectedTicketId) {
  const statusMeta = getAdminTicketStatusMeta(ticket.status);

  return {
    id: ticket.id,
    subject: ticket.subject,
    userEmail: ticket.userEmail,
    createdAtLabel: formatShortDate(ticket.createdAt),
    statusLabel: statusMeta.label,
    cardClass:
      ticket.id === selectedTicketId
        ? "support-tickets__ticket-card support-tickets__ticket-card--active"
        : "support-tickets__ticket-card",
    statusClass: `support-tickets__status-badge support-tickets__status-badge--${statusMeta.tone}`,
  };
}

function buildSelectedTicketView(ticket, messages = [], currentAdmin = {}) {
  const statusMeta = getAdminTicketStatusMeta(ticket.status);

  return {
    id: ticket.id,
    subject: ticket.subject,
    userEmail: ticket.userEmail,
    createdAtLabel: formatFullDate(ticket.createdAt),
    categoryLabel:
      getSupportCategoryLabel(
        ticket.categoryPrimary || ticket.categoryKey || ticket.categorySecondary,
      ),
    statusLabel: statusMeta.label,
    statusClass: `support-tickets__status-badge support-tickets__status-badge--${statusMeta.tone}`,
    statusOptions: buildTicketStatusOptions(ticket.status),
    messages: messages.map((message) => ({
      senderLabel:
        message.senderName ||
        (message.isFromCurrentUser
          ? currentAdmin.displayName || "Вы"
          : ticket.userEmail || "Пользователь"),
      senderEmail:
        message.senderEmail ||
        (message.isFromCurrentUser
          ? currentAdmin.email || ""
          : ticket.userEmail || ""),
      sentAtLabel: formatFullDate(message.sentAt),
      text: message.text,
      attachmentName: message.attachmentName,
      messageClass: message.isFromCurrentUser
        ? "support-tickets__message support-tickets__message--outgoing"
        : "support-tickets__message",
    })),
  };
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

function buildTicketStatusOptions(selectedStatus = "") {
  return [
    { value: "open", label: "Открыт" },
    { value: "in_progress", label: "В работе" },
    { value: "waiting_user", label: "Ждёт пользователя" },
    { value: "resolved", label: "Решён" },
    { value: "closed", label: "Закрыт" },
  ].map((option) => ({
    ...option,
    selectedAttr: option.value === selectedStatus ? " selected" : "",
  }));
}

function buildNoticeClass(tone, message) {
  if (!message) {
    return "support-tickets__notice";
  }

  return `support-tickets__notice support-tickets__notice--${tone || "info"}`;
}

function formatShortDate(value) {
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

function formatFullDate(value) {
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

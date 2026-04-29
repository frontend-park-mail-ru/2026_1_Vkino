// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import {
  canManageSupportTicketStatus,
  getSupportCategoryLabel,
} from "./support.ts";
import { getDisplayNameFromEmail } from "./user.ts";

export const DEFAULT_SUPPORT_REPLY_FILE_HINT =
  "Можно приложить PNG, JPG, WEBP или PDF до 10 МБ";

export const SUPPORT_REQUESTS_BLOCKED_MESSAGE =
  "Сервис обращений пока недоступен. Перезагрузите страницу после появления ручки.";

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "open", label: "Открыты" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_user", label: "Ждут пользователя" },
  { value: "resolved", label: "Решены" },
  { value: "closed", label: "Закрыты" },
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

export function resolveSupportCurrentUser(user = {}) {
  const id = String(user?.id || user?.user_id || "").trim();
  const email = String(user?.email || "").trim();
  const role = String(user?.role || "user").trim().toLowerCase() || "user";
  const isStaff = canManageSupportTicketStatus(role);

  return {
    id,
    email,
    role,
    displayName: getDisplayNameFromEmail(email) || (isStaff ? "Поддержка" : "Вы"),
    isStaff,
    isAdmin: role === "admin",
  };
}

export function buildSupportShellContext({
  isLoading = false,
  currentUser = {},
} = {}) {
  return {
    isLoading,
    isStaff: Boolean(currentUser.isStaff),
    pageClass: currentUser.isStaff
      ? "page page_support-tickets page_admin-tickets"
      : "page page_support-tickets",
    mainClass: currentUser.isStaff
      ? "support-tickets-page admin-tickets-page"
      : "support-tickets-page",
    heroClass: currentUser.isStaff
      ? "support-tickets__hero support-tickets__hero--admin"
      : "support-tickets__hero",
    sidebarClass: currentUser.isStaff
      ? "support-tickets__sidebar admin-tickets__sidebar"
      : "support-tickets__sidebar",
    chatClass: currentUser.isStaff
      ? "support-tickets__chat admin-tickets__chat"
      : "support-tickets__chat",
  };
}

export function buildSupportHeroContext(snapshot = {}, currentUser = {}) {
  if (currentUser.isStaff) {
    return {
      isStaff: true,
      eyebrow: "Панель поддержки",
      title: "Статистика по обращениям",
      description: buildStaffHeroDescription(currentUser.role),
      hasActions: false,
      hasStatistics: true,
      statisticsCards: snapshot.statisticsCards || [],
    };
  }

  return {
    isStaff: false,
    eyebrow: "Центр поддержки",
    title: "Все обращения, статусы и ответы в одном окне",
    description:
      "Следите за диалогами, не теряйте контекст переписки и создавайте новые обращения без лишних переходов.",
    hasActions: true,
    actions: [
      {
        href: "/support/new",
        label: "Создать обращение",
        className:
          "support-tickets__hero-button support-tickets__hero-button--accent",
        isRouterLink: true,
      },
      {
        href: "#support-ticket-list",
        label: "Открыть список диалогов",
        className: "support-tickets__hero-button",
        isRouterLink: false,
      },
    ],
    hasStatistics: true,
    statisticsCards: buildUserOverviewCards(snapshot.allTickets || []),
  };
}

export function buildSupportSidebarContext(snapshot = {}, currentUser = {}) {
  const filteredTickets = snapshot.filteredTickets || [];
  const selectedTicketId = snapshot.selectedTicket?.id || snapshot.selectedTicketId;
  const selectedFilterLabel = getFilterLabel(snapshot.statusFilter);

  return {
    isStaff: Boolean(currentUser.isStaff),
    eyebrow: currentUser.isStaff ? "Панель поддержки" : "Ваши диалоги",
    title: "Обращения",
    ticketsSummary: currentUser.isStaff
      ? buildStaffTicketsSummary(
          filteredTickets.length,
          snapshot.searchQuery,
          snapshot.statusFilter,
          snapshot.categoryFilter,
        )
      : buildUserTicketsSummary(
          filteredTickets.length,
          snapshot.statusFilter,
          selectedFilterLabel,
        ),
    hasSearch: Boolean(currentUser.isStaff),
    searchQuery: snapshot.searchQuery || "",
    hasCategoryFilter: Boolean(currentUser.isStaff),
    hasCreateAction: !currentUser.isStaff,
    statusOptions: buildSelectOptions(
      snapshot.statusOptions || STATUS_FILTER_OPTIONS,
      snapshot.statusFilter,
    ),
    categoryOptions: buildCategoryOptions(
      snapshot.categoryOptions || [],
      snapshot.categoryFilter,
    ),
    hasTickets: Boolean(filteredTickets.length),
    emptyListMessage: currentUser.isStaff
      ? "По выбранным фильтрам обращений не найдено."
      : buildUserEmptyListMessage(snapshot.statusFilter),
    showEmptyAction: !currentUser.isStaff,
    tickets: filteredTickets.map((ticket) =>
      buildTicketCardView(ticket, selectedTicketId, currentUser),
    ),
  };
}

export function buildSupportConversationContext(
  snapshot = {},
  currentUser = {},
  uiState = {},
) {
  const selectedTicket = snapshot.selectedTicket || null;
  const normalizedReplyFileMeta =
    uiState.replyFileMeta || DEFAULT_SUPPORT_REPLY_FILE_HINT;

  return {
    isStaff: Boolean(currentUser.isStaff),
    noticeClass: buildSupportNoticeClass(uiState.noticeTone),
    noticeMessage: uiState.noticeMessage || "",
    selectedTicket: selectedTicket
      ? buildSelectedTicketView(
          selectedTicket,
          snapshot.selectedMessages || [],
          currentUser,
          uiState,
        )
      : null,
    replyDraft: uiState.replyDraft || "",
    replyError: uiState.replyError || "",
    replyFileMeta: normalizedReplyFileMeta,
    ratingError: uiState.ratingError || "",
    emptyStateTitle: currentUser.isStaff ? "Выберите обращение" : "Выберите диалог",
    emptyStateText: currentUser.isStaff
      ? "Откройте обращение слева, чтобы увидеть историю переписки и ответить пользователю."
      : "Откройте обращение слева, чтобы увидеть историю переписки и продолжить диалог с поддержкой.",
    showEmptyAction: !currentUser.isStaff,
  };
}

export function normalizeSupportReplyText(value) {
  return String(value || "").trim();
}

export function pickSelectedSupportFile(value) {
  if (!(value instanceof File)) {
    return null;
  }

  if (!value.name && value.size === 0) {
    return null;
  }

  return value;
}

export function normalizeSupportTicketRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 0;
  }

  return rating;
}

export function buildSupportNoticeClass(tone = "") {
  if (!tone) {
    return "support-tickets__notice";
  }

  return `support-tickets__notice support-tickets__notice--${tone}`;
}

export function resolveSupportRatingErrorMessage(result = {}) {
  return result.error || "Не удалось сохранить оценку.";
}

export function getSupportStatusMeta(status = "") {
  return STATUS_META[status] || STATUS_META.open;
}

function buildStaffHeroDescription(role = "") {
  if (role === "support_l1") {
    return "Сводка по обращениям первой линии поддержки: bug, complaint и question. Список ниже уже ограничен доступными категориями.";
  }

  if (role === "support_l2") {
    return "Сводка по обращениям второй линии поддержки: feature и other. Список ниже уже ограничен доступными категориями.";
  }

  return "Общая сводка по доступным обращениям: сколько открыто, в работе, ждут пользователя, решены и закрыты.";
}

function buildUserOverviewCards(tickets = []) {
  const summary = tickets.reduce(
    (accumulator, ticket) => {
      accumulator.total += 1;

      if (ticket.status === "open" || ticket.status === "waiting_user") {
        accumulator.attention += 1;
      }

      if (ticket.status === "in_progress") {
        accumulator.inProgress += 1;
      }

      if (ticket.status === "resolved" || ticket.status === "closed") {
        accumulator.resolved += 1;
      }

      return accumulator;
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

function buildUserTicketsSummary(count, selectedStatus, selectedFilterLabel) {
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

function buildStaffTicketsSummary(
  count,
  searchQuery = "",
  statusFilter = "all",
  categoryFilter = "all",
) {
  const filters = [];

  if (statusFilter !== "all") {
    filters.push(`статус «${getFilterLabel(statusFilter)}»`);
  }

  if (categoryFilter !== "all") {
    filters.push(`категория «${getSupportCategoryLabel(categoryFilter)}»`);
  }

  if (searchQuery) {
    filters.push(`поиск «${searchQuery}»`);
  }

  if (!count) {
    return filters.length
      ? `0 обращений, подходят под ${filters.join(", ")}.`
      : "По доступным обращениям пока пусто.";
  }

  if (!filters.length) {
    return `${count} ${pluralizeSupportTickets(count)} в текущей выборке.`;
  }

  return `${count} ${pluralizeSupportTickets(count)} подходят под ${filters.join(", ")}.`;
}

function buildUserEmptyListMessage(selectedStatus) {
  if (selectedStatus === "all") {
    return "Создайте первое обращение, чтобы быстро связаться с поддержкой и отслеживать ответ прямо в диалоге.";
  }

  return `По статусу «${getFilterLabel(selectedStatus)}» обращений пока нет. Попробуйте другой фильтр или создайте новое обращение.`;
}

function buildTicketCardView(ticket, selectedTicketId, currentUser = {}) {
  const statusMeta = getSupportStatusMeta(ticket.status);
  const isActive = ticket.id === selectedTicketId;

  return {
    id: ticket.id,
    cardClass: isActive
      ? "support-tickets__ticket-card support-tickets__ticket-card--active"
      : "support-tickets__ticket-card",
    subject: ticket.subject,
    statusLabel: statusMeta.label,
    statusClass: `support-tickets__status-badge support-tickets__status-badge--${statusMeta.tone}`,
    metaLabel: currentUser.isStaff ? `#${ticket.id}` : `#${ticket.id}`,
    timeLabel: currentUser.isStaff
      ? formatCardDate(ticket.createdAt)
      : formatCardDate(ticket.updatedAt || ticket.createdAt),
    userEmail: currentUser.isStaff ? ticket.userEmail : "",
  };
}

function buildSelectedTicketView(
  ticket,
  messages = [],
  currentUser = {},
  uiState = {},
) {
  const statusMeta = getSupportStatusMeta(ticket.status);
  const normalizedRating = normalizeSupportTicketRating(
    uiState.ratingValue || ticket.rating,
  );
  const canRate =
    !currentUser.isStaff &&
    (ticket.status === "resolved" || ticket.status === "closed");

  return {
    id: ticket.id,
    subject: ticket.subject,
    subtitle: currentUser.isStaff
      ? ticket.subject
      : `Обращение #${ticket.id} • ${ticket.subject}`,
    statusLabel: statusMeta.label,
    statusClass: `support-tickets__status-badge support-tickets__status-badge--${statusMeta.tone}`,
    metaPills: currentUser.isStaff
      ? [
          `#${ticket.id}`,
          ticket.userEmail || "Пользователь без почты",
          getSupportCategoryLabel(
            ticket.categoryPrimary || ticket.categoryKey || ticket.categorySecondary,
          ),
          formatMessageDate(ticket.createdAt),
        ]
      : [
          `#${ticket.id}`,
          `Обновлено ${formatCardDate(ticket.updatedAt || ticket.createdAt)}`,
          `${messages.length} ${pluralizeSupportMessages(messages.length)}`,
        ],
    showStatusForm: Boolean(currentUser.isStaff),
    statusOptions: buildTicketStatusOptions(ticket.status),
    hasMessages: Boolean(messages.length),
    messages: messages.map((message) => {
      const presentation = resolveConversationMessagePresentation(
        message,
        ticket,
        currentUser,
      );

      return {
        senderLabel: presentation.senderLabel,
        senderEmail: presentation.senderEmail,
        showSenderEmail: presentation.showSenderEmail,
        sentAtLabel: formatMessageDate(message.sentAt),
        text: message.text,
        attachmentName: message.attachmentName,
        messageClass: presentation.isOutgoing
          ? "support-tickets__message support-tickets__message--outgoing"
          : "support-tickets__message",
      };
    }),
    emptyMessagesTitle: "Диалог пока пуст",
    emptyMessagesText: currentUser.isStaff
      ? "Сообщения появятся здесь после первого обращения пользователя."
      : "Напишите первое сообщение в это обращение, чтобы поддержка увидела детали быстрее.",
    showRatingForm: canRate,
    ratingSummary: normalizedRating
      ? `Текущая оценка: ${normalizedRating} из 5`
      : "Оценка ещё не выставлена.",
    ratingSubmitLabel: normalizedRating ? "Обновить оценку" : "Сохранить оценку",
    ratingOptions: buildRatingOptions(normalizedRating),
  };
}

function resolveConversationMessagePresentation(
  message = {},
  ticket = {},
  currentUser = {},
) {
  const ticketOwnerId = String(ticket.userId || "").trim();
  const senderId = String(message.senderId || "").trim();
  const isUserMessage =
    Boolean(ticketOwnerId && senderId && senderId === ticketOwnerId) ||
    (!ticketOwnerId && !message.isFromAdmin);
  const isSupportMessage = !isUserMessage;

  if (currentUser.isStaff) {
    return {
      isOutgoing: isSupportMessage,
      senderLabel: isSupportMessage
        ? "Поддержка"
        : ticket.userEmail || message.senderEmail || "Пользователь",
      senderEmail: isSupportMessage
        ? ""
        : message.senderEmail || ticket.userEmail || "",
      showSenderEmail: Boolean(
        !isSupportMessage && (message.senderEmail || ticket.userEmail),
      ),
    };
  }

  return {
    isOutgoing: !isSupportMessage,
    senderLabel: isSupportMessage ? "Поддержка" : "Вы",
    senderEmail: "",
    showSenderEmail: false,
  };
}

function buildSelectOptions(options = [], selectedValue = "") {
  return options.map((option) => ({
    ...option,
    selectedAttr: option.value === selectedValue ? " selected" : "",
  }));
}

function buildCategoryOptions(options = [], selectedValue = "") {
  const normalizedOptions = [
    {
      value: "all",
      label: "Все категории",
    },
    ...options,
  ];

  return buildSelectOptions(normalizedOptions, selectedValue || "all");
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

function buildRatingOptions(selectedRating = 0) {
  return [1, 2, 3, 4, 5].map((value) => ({
    value: String(value),
    label: `${value} из 5`,
    selectedAttr: value === selectedRating ? " selected" : "",
  }));
}

function getFilterLabel(status = "all") {
  return (
    STATUS_FILTER_OPTIONS.find((option) => option.value === status)?.label ||
    STATUS_FILTER_OPTIONS[0].label
  );
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

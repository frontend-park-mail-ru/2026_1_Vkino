import { unwrapPayload } from "./apiResponse.js";

export const SUPPORT_CATEGORY_OPTIONS = [
  { value: "bug", label: "Ошибка" },
  { value: "feature", label: "Новая функция" },
  { value: "complaint", label: "Жалоба" },
  { value: "question", label: "Вопрос" },
  { value: "other", label: "Другое" },
];

export const SUPPORT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const REALTIME_IGNORED_ACTIONS = new Set([
  "subscribe",
  "subscribed",
  "unsubscribe",
  "unsubscribed",
  "connected",
  "connection_established",
  "ping",
  "pong",
  "ack",
]);

export function extractSupportTickets(payload, options = {}) {
  const unwrapped = unwrapPayload(payload);
  const collection = pickArrayCandidate(unwrapped, [
    "tickets",
    "Tickets",
    "items",
    "Items",
    "supportTickets",
    "support_tickets",
    "results",
    "Results",
  ]);

  if (!Array.isArray(collection)) {
    return [];
  }

  return collection
    .map((ticket) => normalizeSupportTicket(ticket, options))
    .filter((ticket) => ticket.id);
}

export function extractSupportTicket(payload, options = {}) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object" || Array.isArray(unwrapped)) {
    return null;
  }

  const candidate =
    pickObjectCandidate(unwrapped, [
      "ticket",
      "Ticket",
      "item",
      "Item",
      "result",
      "Result",
    ]) || unwrapped;

  return normalizeSupportTicket(candidate, options);
}

export function extractSupportMessages(payload, options = {}) {
  const unwrapped = unwrapPayload(payload);
  const collection = pickArrayCandidate(unwrapped, [
    "messages",
    "Messages",
    "items",
    "Items",
    "chat",
    "Chat",
    "results",
    "Results",
  ]);

  if (!Array.isArray(collection)) {
    return [];
  }

  return collection.map((message) => normalizeSupportMessage(message, options));
}

export function extractSupportStatistics(payload, fallbackTickets = []) {
  const unwrapped = unwrapPayload(payload);
  const statsSource =
    pickObjectCandidate(unwrapped, [
      "statistics",
      "Statistics",
      "stats",
      "Stats",
      "summary",
      "Summary",
      "data",
      "Data",
    ]) ||
    (unwrapped && typeof unwrapped === "object" && !Array.isArray(unwrapped)
      ? unwrapped
      : {});

  const fallback = buildStatisticsFromTickets(fallbackTickets);

  return {
    total: toNumber(
      statsSource.total,
      statsSource.Total,
      statsSource.count,
      statsSource.Count,
      fallback.total,
    ),
    openCount: toNumber(
      statsSource.open,
      statsSource.Open,
      statsSource.new,
      statsSource.New,
      statsSource.open_count,
      statsSource.openCount,
      fallback.openCount,
    ),
    inProgressCount: toNumber(
      statsSource.in_progress,
      statsSource.inProgress,
      statsSource.processing,
      statsSource.Processing,
      fallback.inProgressCount,
    ),
    waitingUserCount: toNumber(
      statsSource.waiting_user,
      statsSource.waitingUser,
      statsSource.waiting,
      statsSource.Waiting,
      fallback.waitingUserCount,
    ),
    resolvedCount: toNumber(
      statsSource.resolved,
      statsSource.Resolved,
      fallback.resolvedCount,
    ),
    closedCount: toNumber(
      statsSource.closed,
      statsSource.Closed,
      fallback.closedCount,
    ),
    averageRating: toDecimal(
      statsSource.average_rating,
      statsSource.averageRating,
      fallback.averageRating,
    ),
  };
}

export function normalizeSupportTicket(ticket = {}, options = {}) {
  if (!ticket || typeof ticket !== "object") {
    return createEmptyTicket();
  }

  const id = pickString(
    ticket.id,
    ticket.ID,
    ticket.ticket_id,
    ticket.ticketId,
  );
  const userId = pickString(
    ticket.user_id,
    ticket.userId,
    ticket.author_id,
    ticket.authorId,
    ticket.user?.id,
    ticket.author?.id,
  );
  const { categoryPrimary, categorySecondary, categoryKey } =
    resolveSupportCategory(ticket);
  const createdAt = pickString(
    ticket.created_at,
    ticket.createdAt,
    ticket.date_created,
    ticket.dateCreated,
    ticket.created,
    ticket.date,
    ticket.updated_at,
    ticket.updatedAt,
  );
  const updatedAt = pickString(
    ticket.updated_at,
    ticket.updatedAt,
    ticket.last_message_at,
    ticket.lastMessageAt,
    createdAt,
  );
  const rating = normalizeSupportTicketRating(
    pickSupportRatingCandidate(
      ticket.rating,
      ticket.user_rating,
      ticket.userRating,
      ticket.feedback_rating,
      ticket.feedbackRating,
      ticket.satisfaction_rating,
      ticket.satisfactionRating,
      ticket.score,
    ),
  );

  return {
    id,
    userId,
    subject:
      pickString(ticket.subject, ticket.title, ticket.topic, ticket.name) ||
      (id ? `Обращение #${id}` : "Обращение"),
    description: pickString(
      ticket.description,
      ticket.body,
      ticket.message,
      ticket.content,
    ),
    status: normalizeSupportStatus(
      pickString(ticket.status, ticket.state, ticket.ticket_status),
    ),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || createdAt || new Date().toISOString(),
    userEmail:
      pickString(
        ticket.user_email,
        ticket.userEmail,
        ticket.email,
        ticket.customer_email,
        ticket.customerEmail,
        ticket.user?.email,
        ticket.author?.email,
      ) ||
      options.currentUserEmail ||
      "",
    attachmentFileKey: pickString(
      ticket.attachment_file_key,
      ticket.attachmentFileKey,
      ticket.file_key,
      ticket.fileKey,
    ),
    attachmentName:
      pickString(
        ticket.attachment_name,
        ticket.attachmentName,
        ticket.file_name,
        ticket.fileName,
      ) || getSupportFileDisplayName(
        pickString(
          ticket.attachment_file_key,
          ticket.attachmentFileKey,
          ticket.file_key,
          ticket.fileKey,
        ),
      ),
    rating,
    categoryPrimary,
    categorySecondary,
    categoryKey,
  };
}

export function normalizeSupportMessage(message = {}, options = {}) {
  if (!message || typeof message !== "object") {
    return createEmptyMessage();
  }

  const senderId = pickString(
    message.sender_id,
    message.senderId,
    message.user_id,
    message.userId,
    message.author_id,
    message.authorId,
    message.sender?.id,
    message.user?.id,
  );
  const senderEmail = pickString(
    message.sender_email,
    message.senderEmail,
    message.user_email,
    message.userEmail,
    message.email,
    message.author?.email,
    message.sender?.email,
    message.user?.email,
  );
  const senderName =
    pickString(
      message.sender_name,
      message.senderName,
      message.name,
      message.author?.name,
      message.sender?.name,
      message.user?.name,
    ) || inferNameFromEmail(senderEmail);
  const role = pickString(
    message.sender_role,
    message.senderRole,
    message.role,
    message.author_role,
    message.authorRole,
    message.sender?.role,
  ).toLowerCase();
  const isFromAdmin =
    Boolean(
      message.is_admin ??
      message.isAdmin ??
      message.is_support ??
      message.isSupport,
    ) ||
    role.includes("admin") ||
    role.includes("support") ||
    /support|admin/i.test(senderEmail || "");
  const currentUserEmail = String(options.currentUserEmail || "")
    .trim()
    .toLowerCase();
  const currentUserId = String(options.currentUserId || "").trim();
  const attachmentFileKey = pickString(
    message.content_file_key,
    message.contentFileKey,
    message.attachment_file_key,
    message.attachmentFileKey,
    message.file_key,
    message.fileKey,
    message.attachment?.key,
    message.file?.key,
  );
  const attachmentName =
    pickString(
      message.attachment_name,
      message.attachmentName,
      message.file_name,
      message.fileName,
      message.attachment?.name,
      message.file?.name,
    ) || getSupportFileDisplayName(attachmentFileKey);
  const isFromCurrentUser =
    Boolean(
      (currentUserId && senderId && senderId === currentUserId) ||
      (currentUserEmail && senderEmail.toLowerCase() === currentUserEmail),
    );

  return {
    id:
      pickString(
        message.id,
        message.ID,
        message.message_id,
        message.messageId,
      ) ||
      crypto.randomUUID?.() ||
      String(Date.now()),
    senderId,
    senderName,
    senderEmail,
    sentAt:
      pickString(
        message.created_at,
        message.createdAt,
        message.sent_at,
        message.sentAt,
        message.date,
        message.time,
      ) || new Date().toISOString(),
    text:
      pickString(
        message.message,
        message.text,
        message.content,
        message.body,
      ) || (attachmentName ? "Прикреплён файл" : ""),
    attachmentFileKey,
    attachmentName,
    isFromAdmin,
    isFromCurrentUser: Boolean(isFromCurrentUser),
  };
}

export function resolveSupportCategory(source) {
  if (!source) {
    return {
      categoryPrimary: "",
      categorySecondary: "",
      categoryKey: "",
    };
  }

  const explicitPrimary = pickString(
    source.category_primary,
    source.categoryPrimary,
    source.primary,
  );
  const explicitSecondary = pickString(
    source.category_secondary,
    source.categorySecondary,
    source.secondary,
  );
  const rawCategory = pickString(
    source.category_key,
    source.categoryKey,
    source.category,
    source.type,
  );

  if (explicitPrimary || explicitSecondary) {
    return {
      categoryPrimary: explicitPrimary,
      categorySecondary: explicitSecondary,
      categoryKey:
        explicitPrimary && explicitSecondary
          ? `${explicitPrimary}:${explicitSecondary}`
          : explicitPrimary || explicitSecondary,
    };
  }

  if (!rawCategory) {
    return {
      categoryPrimary: "",
      categorySecondary: "",
      categoryKey: "",
    };
  }

  const normalizedCategory = String(rawCategory).trim();
  const [categoryPrimary = "", categorySecondary = ""] =
    normalizedCategory.split(":");

  return {
    categoryPrimary,
    categorySecondary,
    categoryKey:
      categoryPrimary && categorySecondary
        ? `${categoryPrimary}:${categorySecondary}`
        : normalizedCategory,
  };
}

export function getSupportCategoryLabel(rawCategory = "") {
  const normalizedCategory = String(rawCategory || "").trim().toLowerCase();

  if (!normalizedCategory) {
    return "Другое";
  }

  const categoryKey = normalizedCategory.split(":")[0] || normalizedCategory;
  const matchedCategory = SUPPORT_CATEGORY_OPTIONS.find(
    (option) => option.value === categoryKey,
  );

  if (matchedCategory) {
    return matchedCategory.label;
  }

  return "Другое";
}

export function normalizeSupportStatus(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "open" || normalized === "new") {
    return "open";
  }

  if (
    normalized === "in_progress" ||
    normalized === "in-progress" ||
    normalized === "processing"
  ) {
    return "in_progress";
  }

  if (
    normalized === "waiting_user" ||
    normalized === "waiting-user" ||
    normalized === "waiting" ||
    normalized === "pending"
  ) {
    return "waiting_user";
  }

  if (normalized === "resolved" || normalized === "done") {
    return "resolved";
  }

  if (normalized === "closed" || normalized === "close") {
    return "closed";
  }

  return normalized;
}

export function shouldSyncSupportRealtimePayload(
  payload,
  selectedTicketId = "",
) {
  const normalizedSelectedTicketId = String(selectedTicketId || "").trim();

  if (!normalizedSelectedTicketId) {
    return false;
  }

  const unwrapped = unwrapPayload(payload);
  const action = pickString(
    unwrapped?.action,
    unwrapped?.type,
    unwrapped?.event,
    unwrapped?.kind,
  ).toLowerCase();

  if (REALTIME_IGNORED_ACTIONS.has(action)) {
    return false;
  }

  const ticketId = extractSupportRealtimeTicketId(unwrapped);

  if (ticketId && ticketId !== normalizedSelectedTicketId) {
    return false;
  }

  return true;
}

export function extractSupportRealtimeTicketId(payload) {
  const unwrapped = unwrapPayload(payload);

  return pickString(
    unwrapped?.ticket_id,
    unwrapped?.ticketId,
    unwrapped?.id,
    unwrapped?.ticket?.id,
    unwrapped?.message?.ticket_id,
    unwrapped?.message?.ticketId,
    unwrapped?.data?.ticket_id,
    unwrapped?.data?.ticketId,
  );
}

export function buildStatisticsCards(statistics = {}) {
  return [
    {
      key: "total",
      label: "Всего",
      value: String(statistics.total ?? 0),
    },
    {
      key: "open",
      label: "Открыты",
      value: String(statistics.openCount ?? 0),
    },
    {
      key: "in_progress",
      label: "В работе",
      value: String(statistics.inProgressCount ?? 0),
    },
    {
      key: "waiting_user",
      label: "Ждут пользователя",
      value: String(statistics.waitingUserCount ?? 0),
    },
    {
      key: "resolved",
      label: "Решены",
      value: String(statistics.resolvedCount ?? 0),
    },
    {
      key: "closed",
      label: "Закрыты",
      value: String(statistics.closedCount ?? 0),
    },
    {
      key: "average_rating",
      label: "Средняя оценка",
      value: formatAverageRating(statistics.averageRating),
    },
  ];
}

export function buildSupportConversationMessages(
  ticket = {},
  messages = [],
  options = {},
) {
  const normalizedMessages = Array.isArray(messages) ? [...messages] : [];
  const initialMessage = buildInitialTicketMessage(ticket, options);

  if (!initialMessage) {
    return normalizedMessages;
  }

  const firstMessage = normalizedMessages[0];

  if (
    firstMessage &&
    firstMessage.senderId === initialMessage.senderId &&
    firstMessage.text === initialMessage.text &&
    firstMessage.attachmentFileKey === initialMessage.attachmentFileKey
  ) {
    return normalizedMessages;
  }

  return [initialMessage, ...normalizedMessages];
}

export function canManageSupportTicketStatus(role = "") {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();

  return (
    normalizedRole === "admin" ||
    normalizedRole === "support_l1" ||
    normalizedRole === "support_l2"
  );
}

function buildStatisticsFromTickets(tickets = []) {
  const summary = tickets.reduce(
    (accumulator, ticket) => {
      const status = normalizeSupportStatus(ticket?.status);
      const rating = normalizeSupportTicketRating(ticket?.rating);

      accumulator.total += 1;

      if (status === "closed") {
        accumulator.closedCount += 1;
      } else if (status === "resolved") {
        accumulator.resolvedCount += 1;
      } else if (status === "in_progress") {
        accumulator.inProgressCount += 1;
      } else if (status === "waiting_user") {
        accumulator.waitingUserCount += 1;
      } else {
        accumulator.openCount += 1;
      }

      if (rating) {
        accumulator.ratingSum += rating;
        accumulator.ratingCount += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      openCount: 0,
      inProgressCount: 0,
      waitingUserCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      ratingSum: 0,
      ratingCount: 0,
    },
  );

  return {
    total: summary.total,
    openCount: summary.openCount,
    inProgressCount: summary.inProgressCount,
    waitingUserCount: summary.waitingUserCount,
    resolvedCount: summary.resolvedCount,
    closedCount: summary.closedCount,
    averageRating: summary.ratingCount
      ? summary.ratingSum / summary.ratingCount
      : 0,
  };
}

function createEmptyTicket() {
  return {
    id: "",
    userId: "",
    subject: "",
    description: "",
    status: "open",
    createdAt: "",
    updatedAt: "",
    userEmail: "",
    attachmentFileKey: "",
    attachmentName: "",
    rating: 0,
    categoryPrimary: "",
    categorySecondary: "",
    categoryKey: "",
  };
}

function createEmptyMessage() {
  return {
    id: "",
    senderId: "",
    senderName: "",
    senderEmail: "",
    sentAt: "",
    text: "",
    attachmentFileKey: "",
    attachmentName: "",
    isFromAdmin: false,
    isFromCurrentUser: false,
  };
}

export function validateSupportFile(file) {
  if (!(file instanceof File)) {
    return "";
  }

  if (file.size > SUPPORT_MAX_FILE_SIZE_BYTES) {
    return "Файл должен быть не больше 10 МБ.";
  }

  if (!isSupportedSupportFile(file)) {
    return "Поддерживаются только PNG, JPG, WEBP и PDF.";
  }

  return "";
}

export function isSupportedSupportFile(file) {
  const fileType = String(file?.type || "").toLowerCase();
  const fileName = String(file?.name || "").toLowerCase();

  return (
    fileType === "image/png" ||
    fileType === "image/jpeg" ||
    fileType === "image/webp" ||
    fileType === "application/pdf" ||
    fileName.endsWith(".png") ||
    fileName.endsWith(".jpg") ||
    fileName.endsWith(".jpeg") ||
    fileName.endsWith(".webp") ||
    fileName.endsWith(".pdf")
  );
}

export function getSupportFileDisplayName(fileKey = "") {
  const normalizedKey = String(fileKey || "").trim();

  if (!normalizedKey) {
    return "";
  }

  const parts = normalizedKey.split("/");

  return parts[parts.length - 1] || normalizedKey;
}

function pickArrayCandidate(source, keys = []) {
  if (Array.isArray(source)) {
    return source;
  }

  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    if (Array.isArray(source[key])) {
      return source[key];
    }
  }

  return null;
}

function pickObjectCandidate(source, keys = []) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  for (const key of keys) {
    const candidate = source[key];

    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate)
    ) {
      return candidate;
    }
  }

  return null;
}

function inferNameFromEmail(email = "") {
  const normalized = String(email || "").trim();

  if (!normalized) {
    return "";
  }

  const [namePart = ""] = normalized.split("@");

  return namePart;
}

function normalizeSupportTicketRating(value) {
  const rating = Number(value);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return 0;
  }

  return rating;
}

function pickSupportRatingCandidate(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }

    if (typeof value === "string" && !value.trim()) {
      continue;
    }

    return value;
  }

  return null;
}

function formatAverageRating(value) {
  const rating = Number(value);

  if (!Number.isFinite(rating) || rating <= 0) {
    return "0.0";
  }

  return rating.toFixed(1);
}

function toDecimal(...values) {
  for (const value of values) {
    const normalized = Number(value);

    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return 0;
}

function buildInitialTicketMessage(ticket = {}, options = {}) {
  const description = String(ticket.description || "").trim();
  const attachmentFileKey = String(ticket.attachmentFileKey || "").trim();
  const attachmentName =
    String(ticket.attachmentName || "").trim() ||
    getSupportFileDisplayName(attachmentFileKey);

  if (!description && !attachmentFileKey) {
    return null;
  }

  const ticketUserId = String(ticket.userId || "").trim();
  const ticketUserEmail = String(ticket.userEmail || "").trim();
  const currentUserId = String(options.currentUserId || "").trim();
  const currentUserEmail = String(options.currentUserEmail || "")
    .trim()
    .toLowerCase();
  const isFromCurrentUser = Boolean(
    (ticketUserId && currentUserId && ticketUserId === currentUserId) ||
      (ticketUserEmail && currentUserEmail && ticketUserEmail.toLowerCase() === currentUserEmail),
  );

  return {
    id: `ticket-${ticket.id || "new"}-description`,
    senderId: ticketUserId,
    senderName:
      inferNameFromEmail(ticketUserEmail) ||
      (isFromCurrentUser
        ? String(options.currentUserDisplayName || "Вы").trim()
        : "Пользователь"),
    senderEmail: ticketUserEmail,
    sentAt: ticket.createdAt || new Date().toISOString(),
    text: description || (attachmentName ? "Прикреплён файл" : ""),
    attachmentFileKey,
    attachmentName,
    isFromAdmin: false,
    isFromCurrentUser,
  };
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function toNumber(...values) {
  for (const value of values) {
    const normalized = Number(value);

    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return 0;
}

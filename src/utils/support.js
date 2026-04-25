import { unwrapPayload } from "./apiResponse.js";

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
    newCount: toNumber(
      statsSource.new,
      statsSource.New,
      statsSource.open,
      statsSource.Open,
      statsSource.new_count,
      statsSource.newCount,
      fallback.newCount,
    ),
    inProgressCount: toNumber(
      statsSource.in_progress,
      statsSource.inProgress,
      statsSource.processing,
      statsSource.Processing,
      fallback.inProgressCount,
    ),
    resolvedCount: toNumber(
      statsSource.resolved,
      statsSource.Resolved,
      statsSource.closed,
      statsSource.Closed,
      fallback.resolvedCount,
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

  return {
    id,
    subject:
      pickString(ticket.subject, ticket.title, ticket.topic, ticket.name) ||
      (id ? `Обращение #${id}` : "Обращение"),
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
    categoryPrimary,
    categorySecondary,
    categoryKey,
  };
}

export function normalizeSupportMessage(message = {}, options = {}) {
  if (!message || typeof message !== "object") {
    return createEmptyMessage();
  }

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
  const isFromCurrentUser =
    currentUserEmail && senderEmail.toLowerCase() === currentUserEmail;

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
      ) || "",
    attachmentName: pickString(
      message.attachment_name,
      message.attachmentName,
      message.file_name,
      message.fileName,
      message.attachment?.name,
      message.file?.name,
    ),
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

export function normalizeSupportStatus(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "open") {
    return "new";
  }

  if (
    normalized === "in_progress" ||
    normalized === "in-progress" ||
    normalized === "processing"
  ) {
    return "in_progress";
  }

  if (normalized === "waiting" || normalized === "pending") {
    return "waiting";
  }

  if (
    normalized === "resolved" ||
    normalized === "closed" ||
    normalized === "done"
  ) {
    return "resolved";
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
      key: "new",
      label: "Новые",
      value: String(statistics.newCount ?? 0),
    },
    {
      key: "in_progress",
      label: "В работе",
      value: String(statistics.inProgressCount ?? 0),
    },
    {
      key: "resolved",
      label: "Закрытые",
      value: String(statistics.resolvedCount ?? 0),
    },
  ];
}

function buildStatisticsFromTickets(tickets = []) {
  return tickets.reduce(
    (accumulator, ticket) => {
      const status = normalizeSupportStatus(ticket?.status);

      accumulator.total += 1;

      if (status === "resolved") {
        accumulator.resolvedCount += 1;
      } else if (status === "in_progress") {
        accumulator.inProgressCount += 1;
      } else {
        accumulator.newCount += 1;
      }

      return accumulator;
    },
    {
      total: 0,
      newCount: 0,
      inProgressCount: 0,
      resolvedCount: 0,
    },
  );
}

function createEmptyTicket() {
  return {
    id: "",
    subject: "",
    status: "new",
    createdAt: "",
    updatedAt: "",
    userEmail: "",
    categoryPrimary: "",
    categorySecondary: "",
    categoryKey: "",
  };
}

function createEmptyMessage() {
  return {
    id: "",
    senderName: "",
    senderEmail: "",
    sentAt: "",
    text: "",
    attachmentName: "",
    isFromAdmin: false,
    isFromCurrentUser: false,
  };
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

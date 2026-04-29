// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import { supportService } from "@/js/SupportService.ts";
import {
  buildSupportConversationMessages,
  buildStatisticsCards,
  canManageSupportTicketStatus,
  extractSupportMessages,
  extractSupportStatistics,
  extractSupportTickets,
  normalizeSupportMessage,
  SUPPORT_CATEGORY_OPTIONS,
} from "@/utils/support.ts";
import type { AnyRecord } from "@/types/shared.ts";

const STATUS_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "open", label: "Открыты" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_user", label: "Ждут пользователя" },
  { value: "resolved", label: "Решены" },
  { value: "closed", label: "Закрыты" },
];

export function useSupportTickets(currentUser: AnyRecord = {}) {
  let contextAbortController: AbortController | null = null;
  let messageAbortController: AbortController | null = null;
  const state = {
    searchQuery: "",
    statusFilter: "all",
    categoryFilter: "all",
    selectedTicketId: "",
    allTickets: [] as AnyRecord[],
    selectedMessages: [] as AnyRecord[],
    statistics: createEmptyStatistics(),
  };

  const roleContext: AnyRecord = {
    ...currentUser,
    isStaff: canManageSupportTicketStatus(currentUser.role),
  };

  async function load({
    preserveSelection = true,
    signal = null,
  }: {
    preserveSelection?: boolean;
    signal?: AbortSignal | null;
  } = {}) {
    return refreshData({
      preserveSelection,
      signal: signal || createContextSignal(),
    });
  }

  async function refreshData({
    preserveSelection = true,
    signal = null,
  }: {
    preserveSelection?: boolean;
    signal?: AbortSignal | null;
  } = {}) {
    const previousSelectedTicketId = preserveSelection
      ? state.selectedTicketId
      : "";
    const requestSignal = signal || createContextSignal();
    const requests = [
      supportService.getTickets({
        signal: requestSignal,
      }),
    ];

    if (roleContext.isStaff) {
      requests.push(
        supportService.getStatistics({
          signal: requestSignal,
        }),
      );
    }

    const [ticketsResult, statisticsResult = null] = await Promise.all(requests);

    if (ticketsResult.aborted || statisticsResult?.aborted) {
      return buildResult([], getSnapshot(), {
        ok: false,
        status: 0,
        aborted: true,
      });
    }

    if (ticketsResult.ok) {
      state.allTickets = extractSupportTickets(ticketsResult.resp, {
        currentUserId: roleContext.id,
        currentUserEmail: roleContext.email,
      });
    } else if (!state.allTickets.length) {
      state.allTickets = [];
    }

    state.statistics = roleContext.isStaff
      ? statisticsResult?.ok
        ? extractSupportStatistics(statisticsResult.resp, state.allTickets)
        : extractSupportStatistics({}, state.allTickets)
      : extractSupportStatistics({}, state.allTickets);

    state.selectedTicketId = resolveSelectedTicketId(previousSelectedTicketId);

    const messagesResult = await loadSelectedMessages({
      signal: requestSignal,
      preserveOnError: false,
    });

    return buildResult(
      [ticketsResult, statisticsResult, messagesResult],
      getSnapshot(),
      {
        blocked: ticketsResult.status === 404 || statisticsResult?.status === 404,
      },
    );
  }

  async function setSearchQuery(value) {
    state.searchQuery = String(value || "");
    return syncSelectionAfterFilter();
  }

  async function setStatusFilter(value) {
    state.statusFilter = String(value || "all");
    return syncSelectionAfterFilter();
  }

  async function setCategoryFilter(value) {
    state.categoryFilter = String(value || "all");
    return syncSelectionAfterFilter();
  }

  async function selectTicket(ticketId) {
    state.selectedTicketId = String(ticketId || "").trim();
    return loadSelectedMessages({
      signal: createMessageSignal(),
      preserveOnError: false,
    });
  }

  async function replyToSelectedTicket({
    text = "",
    attachment = null,
  }: {
    text?: string;
    attachment?: File | null;
  } = {}) {
    if (!state.selectedTicketId) {
      return buildResult(
        [
          {
            ok: false,
            status: 0,
            error: "Обращение не выбрано.",
          },
        ],
        getSnapshot(),
      );
    }

    const result = await supportService.createTicketMessage(state.selectedTicketId, {
      message: text,
      attachment,
    });

    if (!result.ok) {
      return buildResult([result], getSnapshot());
    }

    const createdMessage = extractCreatedSupportMessage(result.resp, roleContext);

    if (createdMessage) {
      appendSelectedMessage(createdMessage);
      touchSelectedTicket({
        updatedAt: createdMessage.sentAt || new Date().toISOString(),
      });

      return {
        ...buildResult([result], getSnapshot()),
        message: "Сообщение отправлено.",
      };
    }

    const syncResult = await syncSelectedMessages();

    return {
      ...syncResult,
      message: "Сообщение отправлено.",
    };
  }

  async function setSelectedTicketStatus(nextStatus) {
    if (!state.selectedTicketId) {
      return buildResult(
        [
          {
            ok: false,
            status: 0,
            error: "Обращение не выбрано.",
          },
        ],
        getSnapshot(),
      );
    }

    const normalizedStatus = String(nextStatus || "").trim();

    if (!normalizedStatus) {
      return buildResult(
        [
          {
            ok: false,
            status: 400,
            error: "Выберите статус обращения.",
          },
        ],
        getSnapshot(),
      );
    }

    const result = await supportService.updateTicket(state.selectedTicketId, {
      status: normalizedStatus,
    });

    if (!result.ok) {
      return buildResult([result], getSnapshot());
    }

    const syncResult = await refreshData({ preserveSelection: true });

    return {
      ...syncResult,
      message: `Статус обращения #${state.selectedTicketId} обновлён.`,
    };
  }

  async function rateSelectedTicket(rating) {
    if (!state.selectedTicketId) {
      return buildResult(
        [
          {
            ok: false,
            status: 0,
            error: "Обращение не выбрано.",
          },
        ],
        getSnapshot(),
      );
    }

    const normalizedRating = Number(rating);

    if (
      !Number.isInteger(normalizedRating) ||
      normalizedRating < 1 ||
      normalizedRating > 5
    ) {
      return buildResult(
        [
          {
            ok: false,
            status: 400,
            error: "Выберите оценку от 1 до 5.",
          },
        ],
        getSnapshot(),
      );
    }

    const result = await supportService.updateTicket(state.selectedTicketId, {
      rating: normalizedRating,
    });

    if (!result.ok) {
      return buildResult([result], getSnapshot());
    }

    const syncResult = await refreshData({ preserveSelection: true });

    return {
      ...syncResult,
      message: `Оценка для обращения #${state.selectedTicketId} сохранена.`,
    };
  }

  async function handleRealtimeSync() {
    const syncResult = await refreshData({ preserveSelection: true });

    return {
      ...syncResult,
      message: "Диалог обновлён в реальном времени.",
    };
  }

  function cancelPendingRequests() {
    contextAbortController?.abort();
    messageAbortController?.abort();
    contextAbortController = null;
    messageAbortController = null;
  }

  function getSnapshot() {
    const filteredTickets = getFilteredTickets();
    const selectedTicket =
      filteredTickets.find((ticket) => ticket.id === state.selectedTicketId) ||
      null;

    return {
      searchQuery: state.searchQuery,
      statusFilter: state.statusFilter,
      categoryFilter: state.categoryFilter,
      statusOptions: STATUS_OPTIONS,
      categoryOptions: SUPPORT_CATEGORY_OPTIONS,
      filteredTickets,
      selectedTicketId: state.selectedTicketId,
      selectedTicket,
      selectedMessages: state.selectedMessages,
      allTickets: state.allTickets,
      statistics: state.statistics,
      statisticsCards: buildStatisticsCards(state.statistics),
      currentUser: roleContext,
    };
  }

  async function syncSelectionAfterFilter() {
    const previousSelectedTicketId = state.selectedTicketId;

    state.selectedTicketId = resolveSelectedTicketId(previousSelectedTicketId);

    if (state.selectedTicketId !== previousSelectedTicketId) {
      return loadSelectedMessages({ signal: createMessageSignal() });
    }

    return buildResult([], getSnapshot());
  }

  async function loadSelectedMessages({
    signal = null,
    preserveOnError = false,
  }: {
    signal?: AbortSignal | null;
    preserveOnError?: boolean;
  } = {}) {
    if (!state.selectedTicketId) {
      state.selectedMessages = [];
      return buildResult([], getSnapshot());
    }

    const requestSignal = signal || createMessageSignal();
    const result = await supportService.getTicketMessages(state.selectedTicketId, {
      signal: requestSignal,
    });

    if (result.aborted) {
      return buildResult([], getSnapshot(), {
        ok: false,
        status: 0,
        aborted: true,
      });
    }

    if (!result.ok) {
      if (!preserveOnError) {
        state.selectedMessages = [];
      }
      return buildResult([result], getSnapshot());
    }

    const selectedTicket =
      state.allTickets.find((ticket) => ticket.id === state.selectedTicketId) ||
      null;
    const extractedMessages = extractSupportMessages(result.resp, {
      currentUserId: roleContext.id,
      currentUserEmail: roleContext.email,
    });

    state.selectedMessages = buildSupportConversationMessages(
      selectedTicket,
      extractedMessages,
      {
        currentUserId: roleContext.id,
        currentUserEmail: roleContext.email,
        currentUserDisplayName: roleContext.displayName,
      },
    );

    return buildResult([], getSnapshot());
  }

  async function syncSelectedMessages({
    signal = null,
  }: {
    signal?: AbortSignal | null;
  } = {}) {
    const syncResult = await loadSelectedMessages({
      signal: signal || createMessageSignal(),
      preserveOnError: true,
    });

    if (syncResult.ok) {
      touchSelectedTicket({
        updatedAt: new Date().toISOString(),
      });
      return syncResult;
    }

    return buildResult([], getSnapshot());
  }

  function getFilteredTickets() {
    const normalizedQuery = String(state.searchQuery || "")
      .trim()
      .toLowerCase();

    return state.allTickets.filter((ticket) => {
      const ticketCategory = String(
        ticket.categoryPrimary || ticket.categoryKey || "",
      )
        .trim()
        .toLowerCase();
      const matchesSearch =
        !roleContext.isStaff ||
        !normalizedQuery ||
        String(ticket.id || "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(ticket.userEmail || "")
          .toLowerCase()
          .includes(normalizedQuery) ||
        String(ticket.subject || "")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesStatus =
        state.statusFilter === "all" || ticket.status === state.statusFilter;
      const matchesCategory =
        !roleContext.isStaff ||
        state.categoryFilter === "all" ||
        ticketCategory === String(state.categoryFilter || "").toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }

  function resolveSelectedTicketId(preferredTicketId = "") {
    const filteredTickets = getFilteredTickets();

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

  function createContextSignal() {
    contextAbortController?.abort();
    messageAbortController?.abort();
    contextAbortController = new AbortController();
    messageAbortController = null;
    return contextAbortController.signal;
  }

  function createMessageSignal() {
    messageAbortController?.abort();
    messageAbortController = new AbortController();
    return messageAbortController.signal;
  }

  function appendSelectedMessage(message) {
    if (!message || !message.id) {
      return;
    }

    state.selectedMessages = [...state.selectedMessages, message];
  }

  function touchSelectedTicket(updates: AnyRecord = {}) {
    if (!state.selectedTicketId) {
      return;
    }

    state.allTickets = state.allTickets.map((ticket) =>
      ticket.id === state.selectedTicketId
        ? {
            ...ticket,
            ...updates,
          }
        : ticket,
    );
  }

  return {
    load,
    getSnapshot,
    setSearchQuery,
    setStatusFilter,
    setCategoryFilter,
    selectTicket,
    replyToSelectedTicket,
    setSelectedTicketStatus,
    rateSelectedTicket,
    handleRealtimeSync,
    cancelPendingRequests,
  };
}

function buildResult(
  results: AnyRecord[] = [],
  snapshot: AnyRecord = {},
  {
    ok = null,
    status = null,
    error = "",
    aborted = false,
    blocked = false,
  }: {
    ok?: boolean | null;
    status?: number | null;
    error?: string;
    aborted?: boolean;
    blocked?: boolean;
  } = {},
) {
  const normalizedResults = results.filter(Boolean);
  const failedResult = normalizedResults.find((result) => result.ok === false);

  return {
    ok: ok ?? !failedResult,
    status: status ?? (failedResult?.status || 200),
    error: error || failedResult?.error || "",
    aborted: Boolean(aborted || normalizedResults.find((result) => result.aborted)),
    blocked,
    snapshot,
  };
}

function createEmptyStatistics(): AnyRecord {
  return {
    total: 0,
    openCount: 0,
    inProgressCount: 0,
    waitingUserCount: 0,
    resolvedCount: 0,
    closedCount: 0,
    averageRating: 0,
  };
}

function extractCreatedSupportMessage(
  payload: AnyRecord | null,
  currentUser: AnyRecord = {},
) {
  const messagePayload =
    payload?.message ||
    payload?.Message ||
    payload?.item ||
    payload?.Item ||
    payload?.result ||
    payload?.Result ||
    null;

  if (!messagePayload || typeof messagePayload !== "object") {
    return null;
  }

  return normalizeSupportMessage(messagePayload, {
    currentUserId: currentUser.id,
    currentUserEmail: currentUser.email,
  });
}

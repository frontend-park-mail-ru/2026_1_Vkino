import { supportService } from "../js/SupportService.js";
import {
  buildSupportConversationMessages,
  buildStatisticsCards,
  extractSupportMessages,
  extractSupportStatistics,
  extractSupportTickets,
  SUPPORT_CATEGORY_OPTIONS,
} from "../utils/support.js";

const STATUS_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "open", label: "Открыты" },
  { value: "in_progress", label: "В работе" },
  { value: "waiting_user", label: "Ждут пользователя" },
  { value: "resolved", label: "Решены" },
  { value: "closed", label: "Закрыты" },
];

const CATEGORY_OPTIONS = SUPPORT_CATEGORY_OPTIONS;

const STATUS_META = {
  open: {
    label: "Открыт",
    tone: "open",
  },
  in_progress: {
    label: "В работе",
    tone: "progress",
  },
  resolved: {
    label: "Решён",
    tone: "resolved",
  },
  waiting_user: {
    label: "Ждёт пользователя",
    tone: "waiting",
  },
  closed: {
    label: "Закрыт",
    tone: "resolved",
  },
};

/**
 * Локальный data-layer для панели обращений администратора.
 * Позволяет быстро заменить mock-логику на реальные REST endpoint'ы.
 *
 * @param {Object} currentAdmin
 * @returns {Object}
 */
export function useAdminTickets(currentAdmin = {}) {
  let contextAbortController = null;
  let messageAbortController = null;
  const state = {
    searchQuery: "",
    statusFilter: "all",
    categoryFilter: "all",
    selectedTicketId: "",
    allTickets: [],
    selectedMessages: [],
    statistics: {
      total: 0,
      openCount: 0,
      inProgressCount: 0,
      waitingUserCount: 0,
      resolvedCount: 0,
      closedCount: 0,
      averageRating: 0,
    },
  };

  async function load() {
    return refreshData({
      preserveSelection: true,
      signal: createContextSignal(),
    });
  }

  async function refreshData({ preserveSelection = true, signal = null } = {}) {
    const previousSelectedTicketId = preserveSelection
      ? state.selectedTicketId
      : "";
    const requestSignal = signal || createContextSignal();
    const [ticketsResult, statisticsResult] = await Promise.all([
      supportService.getTickets({
        signal: requestSignal,
      }),
      supportService.getStatistics({ signal: requestSignal }),
    ]);

    if (ticketsResult.aborted || statisticsResult.aborted) {
      return {
        ok: false,
        status: 0,
        error: "",
        aborted: true,
        snapshot: getSnapshot(),
      };
    }

    if (ticketsResult.ok) {
      state.allTickets = extractSupportTickets(ticketsResult.resp);
    } else if (!state.allTickets.length) {
      state.allTickets = [];
    }

    state.statistics = statisticsResult.ok
      ? extractSupportStatistics(statisticsResult.resp, state.allTickets)
      : extractSupportStatistics({}, state.allTickets);

    state.selectedTicketId = resolveSelectedTicketId(previousSelectedTicketId);

    const messagesResult = await loadSelectedMessages({
      signal: requestSignal,
    });

    return buildResult([ticketsResult, messagesResult], getSnapshot());
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
    return loadSelectedMessages({ signal: createMessageSignal() });
  }

  async function replyToSelectedTicket({ text = "", attachment = null } = {}) {
    if (!state.selectedTicketId) {
      return buildResult(
        [
          {
            ok: false,
            status: 0,
            error: "Обращение не выбрано",
          },
        ],
        getSnapshot(),
      );
    }

    const result = await supportService.createTicketMessage(
      state.selectedTicketId,
      {
        message: text,
        attachment,
      },
    );

    if (!result.ok) {
      return buildResult([result], getSnapshot());
    }

    const syncResult = await refreshData({ preserveSelection: true });

    return {
      ...syncResult,
      message: "Ответ отправлен.",
    };
  }

  async function closeSelectedTicket() {
    return setSelectedTicketStatus("closed");
  }

  async function setSelectedTicketStatus(nextStatus) {
    if (!state.selectedTicketId) {
      return buildResult(
        [
          {
            ok: false,
            status: 0,
            error: "Обращение не выбрано",
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
            error: "Выберите статус обращения",
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
      categoryOptions: CATEGORY_OPTIONS,
      filteredTickets,
      selectedTicket,
      selectedMessages: state.selectedMessages,
      statistics: state.statistics,
      statisticsCards: buildStatisticsCards(state.statistics),
      currentAdmin,
    };
  }

  async function syncSelectionAfterFilter() {
    const previousSelectedTicketId = state.selectedTicketId;

    state.selectedTicketId = resolveSelectedTicketId(previousSelectedTicketId);

    if (state.selectedTicketId !== previousSelectedTicketId) {
      return loadSelectedMessages({ signal: createMessageSignal() });
    }

    return {
      ok: true,
      status: 200,
      error: "",
      snapshot: getSnapshot(),
    };
  }

  async function loadSelectedMessages({ signal = null } = {}) {
    if (!state.selectedTicketId) {
      state.selectedMessages = [];

      return {
        ok: true,
        status: 200,
        error: "",
        aborted: false,
        snapshot: getSnapshot(),
      };
    }

    const requestSignal = signal || createMessageSignal();
    const result = await supportService.getTicketMessages(
      state.selectedTicketId,
      {
        signal: requestSignal,
      },
    );

    if (result.aborted) {
      return {
        ok: false,
        status: 0,
        error: "",
        aborted: true,
        snapshot: getSnapshot(),
      };
    }

    if (!result.ok) {
      state.selectedMessages = [];
      return buildResult([result], getSnapshot());
    }

    const selectedTicket =
      state.allTickets.find((ticket) => ticket.id === state.selectedTicketId) ||
      null;
    const extractedMessages = extractSupportMessages(result.resp, {
      currentUserId: currentAdmin.id,
      currentUserEmail: currentAdmin.email,
    });

    state.selectedMessages = buildSupportConversationMessages(
      selectedTicket,
      extractedMessages,
      {
        currentUserId: currentAdmin.id,
        currentUserEmail: currentAdmin.email,
        currentUserDisplayName: currentAdmin.displayName,
      },
    );

    return {
      ok: true,
      status: 200,
      error: "",
      snapshot: getSnapshot(),
    };
  }

  function getFilteredTickets() {
    const normalizedQuery = String(state.searchQuery || "")
      .trim()
      .toLowerCase();

    return state.allTickets.filter((ticket) => {
      const matchesSearch =
        !normalizedQuery ||
        String(ticket.id).toLowerCase().includes(normalizedQuery) ||
        String(ticket.userEmail || "")
          .toLowerCase()
          .includes(normalizedQuery);

      const matchesStatus =
        state.statusFilter === "all" || ticket.status === state.statusFilter;
      const matchesCategory =
        state.categoryFilter === "all" ||
        ticket.categoryKey === state.categoryFilter;

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

  return {
    load,
    getSnapshot,
    setSearchQuery,
    setStatusFilter,
    setCategoryFilter,
    selectTicket,
    replyToSelectedTicket,
    closeSelectedTicket,
    setSelectedTicketStatus,
    handleRealtimeSync,
    cancelPendingRequests,
  };
}

export function getAdminTicketStatusMeta(status) {
  return STATUS_META[status] || STATUS_META.open;
}

function buildResult(results = [], snapshot = {}) {
  const failedResult = results.find((result) => result && result.ok === false);

  return {
    ok: !failedResult,
    status: failedResult?.status || 200,
    error: failedResult?.error || "",
    aborted: Boolean(results.find((result) => result?.aborted)),
    snapshot,
  };
}

import { apiService } from "./api.js";
import { resolveSupportCategory } from "../utils/support.js";

export class SupportService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("support");
  }

  async createTicket(payload = {}, requestOptions = {}) {
    const category = resolveSupportCategory({ category: payload.category });
    const normalizedPayload = {
      category:
        category.categoryPrimary ||
        String(payload.category || "").trim() ||
        "other",
      title: String(payload.subject || "").trim(),
      description: String(payload.message || "").trim(),
      // API gateway сейчас принимает только file key, не бинарный файл.
      attachment_file_key: "",
    };

    return this.api.request("/tickets", {
      method: "POST",
      data: normalizedPayload,
      signal: requestOptions.signal || null,
    });
  }

  async getTickets({
    role = "",
    status = "",
    category = "",
    supportLine = null,
    signal = null,
  } = {}) {
    return this.api.request("/tickets", {
      method: "GET",
      data: {
        role: String(role || "").trim(),
        status: String(status || "").trim(),
        category: String(category || "").trim(),
        support_line:
          Number.isFinite(Number(supportLine)) && Number(supportLine) > 0
            ? Number(supportLine)
            : 0,
      },
      signal,
    });
  }

  async updateTicket(ticketId, payload = {}, requestOptions = {}) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "SupportService: не передан id обращения",
      };
    }

    return this.api.request(
      `/tickets/${encodeURIComponent(normalizedTicketId)}`,
      {
        method: "PATCH",
        data: payload,
        signal: requestOptions.signal || null,
      },
    );
  }

  async getTicketMessages(ticketId, { signal = null } = {}) {
    const normalizedTicketId = String(ticketId || "").trim();

    if (!normalizedTicketId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "SupportService: не передан id обращения",
      };
    }

    return this.api.request(
      `/tickets/${encodeURIComponent(normalizedTicketId)}/messages`,
      {
        method: "GET",
        signal,
      },
    );
  }

  async createTicketMessage(ticketId, payload = {}, requestOptions = {}) {
    const normalizedTicketId = String(ticketId || "").trim();
    const normalizedContent = String(payload.message || "").trim();

    if (!normalizedTicketId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "SupportService: не передан id обращения",
      };
    }

    if (!normalizedContent) {
      return {
        ok: false,
        status: 400,
        resp: null,
        error: "Введите текст сообщения",
      };
    }

    return this.api.request(
      `/tickets/${encodeURIComponent(normalizedTicketId)}/messages`,
      {
        method: "POST",
        data: {
          content: normalizedContent,
          // API gateway сейчас принимает только file key, не бинарный файл.
          content_file_key: "",
        },
        signal: requestOptions.signal || null,
      },
    );
  }

  async getStatistics({ signal = null } = {}) {
    return this.api.request("/statistics", {
      method: "GET",
      signal,
    });
  }
}

export const supportService = new SupportService(apiService);

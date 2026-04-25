import { apiService } from "./api.js";

export class SupportService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("support");
  }

  async createTicket(payload = {}, requestOptions = {}) {
    const normalizedPayload = {
      user_email: String(payload.email).trim(),
      title: String(payload.subject || payload.title || "").trim(),
      category: String(payload.category || "").trim(),
      description: String(payload.message || payload.description || "").trim(),
      attachment_file_key:
        payload.attachmentFileKey === null ||
        payload.attachment_file_key === null ||
        !(payload.attachment instanceof File)
          ? null
          : String(
              payload.attachmentFileKey || payload.attachment_file_key || "",
            ).trim() || null,
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

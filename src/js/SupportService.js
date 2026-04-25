import { apiService } from "./api.js";

export class SupportService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("support");
  }

  async createTicket(payload = {}, requestOptions = {}) {
    const normalizedPayload = {
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

  async getTickets({ admin = false, signal = null } = {}) {
    const params = new URLSearchParams();

    if (admin) {
      params.set("admin", "true");
    }

    const suffix = params.toString() ? `?${params.toString()}` : "";

    return this.api.request(`/tickets${suffix}`, {
      method: "GET",
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

    if (!normalizedTicketId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "SupportService: не передан id обращения",
      };
    }

    const formData = new FormData();

    formData.append("message", String(payload.message || "").trim());

    if (payload.attachment instanceof File) {
      formData.append("attachment", payload.attachment);
    }

    return this.api.request(
      `/tickets/${encodeURIComponent(normalizedTicketId)}/messages`,
      {
        method: "POST",
        data: formData,
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

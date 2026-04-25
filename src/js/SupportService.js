import { apiService } from "./api.js";
import { resolveSupportCategory } from "../utils/support.js";

export class SupportService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("support");
  }

  async createTicket(payload = {}, requestOptions = {}) {
    const category = resolveSupportCategory({ category: payload.category });
    const normalizedPayload = {
      subject: String(payload.subject || "").trim(),
      category: String(payload.category || "").trim(),
      message: String(payload.message || "").trim(),
      attachment: null,
    };

    if (category.categoryPrimary) {
      normalizedPayload.category_primary = category.categoryPrimary;
    }

    if (category.categorySecondary) {
      normalizedPayload.category_secondary = category.categorySecondary;
    }

    if (!(payload.attachment instanceof File)) {
      return this.api.request("/tickets", {
        method: "POST",
        data: normalizedPayload,
        signal: requestOptions.signal || null,
      });
    }

    const formData = new FormData();

    formData.append("subject", normalizedPayload.subject);
    formData.append("category", normalizedPayload.category);
    formData.append("message", normalizedPayload.message);

    if (normalizedPayload.category_primary) {
      formData.append("category_primary", normalizedPayload.category_primary);
    }

    if (normalizedPayload.category_secondary) {
      formData.append(
        "category_secondary",
        normalizedPayload.category_secondary,
      );
    }

    formData.append("attachment", payload.attachment);

    return this.api.request("/tickets", {
      method: "POST",
      data: formData,
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

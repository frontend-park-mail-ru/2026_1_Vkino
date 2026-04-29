import { apiService } from "@/js/api.js";
import {
  getSupportFileDisplayName,
  validateSupportFile,
} from "@/utils/support.js";

export class SupportService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("support");
  }

  async createTicket(payload = {}, requestOptions = {}) {
    const uploadedAttachment = await this._resolveUpload({
      file:
        payload.attachment instanceof File
          ? payload.attachment
          : payload.file instanceof File
            ? payload.file
            : null,
      fileKey: payload.attachmentFileKey || payload.attachment_file_key || "",
      signal: requestOptions.signal || null,
    });

    if (!uploadedAttachment.ok) {
      return uploadedAttachment;
    }

    const normalizedUserEmail = String(
      payload.email || payload.userEmail || payload.user_email || "",
    ).trim();
    const normalizedPayload = {
      title: String(payload.subject || payload.title || "").trim(),
      category: String(payload.category || "").trim(),
      description: String(payload.message || payload.description || "").trim(),
    };

    if (normalizedUserEmail) {
      normalizedPayload.user_email = normalizedUserEmail;
    }

    if (uploadedAttachment.fileKey) {
      normalizedPayload.attachment_file_key = uploadedAttachment.fileKey;
    }

    return this.api.request("/tickets", {
      method: "POST",
      data: normalizedPayload,
      signal: requestOptions.signal || null,
    });
  }

  async getTickets({
    status = "",
    category = "",
    userEmail = "",
    supportLine = null,
    signal = null,
  } = {}) {
    const query = {};
    const normalizedStatus = String(status || "").trim();
    const normalizedCategory = String(category || "").trim();
    const normalizedUserEmail = String(
      userEmail || "",
    ).trim();
    const normalizedSupportLine = Number(supportLine);

    if (normalizedStatus) {
      query.status = normalizedStatus;
    }

    if (normalizedCategory) {
      query.category = normalizedCategory;
    }

    if (normalizedUserEmail) {
      query.user_email = normalizedUserEmail;
    }

    if (
      Number.isFinite(normalizedSupportLine) &&
      normalizedSupportLine > 0
    ) {
      query.support_line = normalizedSupportLine;
    }

    return this.api.get("/tickets", {
      query,
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

    const uploadedAttachment = await this._resolveUpload({
      file:
        payload.attachment instanceof File
          ? payload.attachment
          : payload.file instanceof File
            ? payload.file
            : null,
      fileKey: payload.attachmentFileKey || payload.attachment_file_key || "",
      signal: requestOptions.signal || null,
    });

    if (!uploadedAttachment.ok) {
      return uploadedAttachment;
    }

    const normalizedPayload = {};
    const normalizedCategory = String(payload.category || "").trim();
    const normalizedStatus = String(payload.status || "").trim();
    const normalizedTitle = String(payload.title || "").trim();
    const normalizedUserEmail = String(
      payload.userEmail || payload.user_email || "",
    ).trim();
    const normalizedDescription = String(payload.description || "").trim();
    const normalizedRating = Number(payload.rating ?? payload.score);

    if (normalizedCategory) {
      normalizedPayload.category = normalizedCategory;
    }

    if (normalizedStatus) {
      normalizedPayload.status = normalizedStatus;
    }

    if (normalizedTitle) {
      normalizedPayload.title = normalizedTitle;
    }

    if (normalizedUserEmail) {
      normalizedPayload.user_email = normalizedUserEmail;
    }

    if (normalizedDescription) {
      normalizedPayload.description = normalizedDescription;
    }

    if (uploadedAttachment.fileKey) {
      normalizedPayload.attachment_file_key = uploadedAttachment.fileKey;
    }

    if (
      Number.isInteger(normalizedRating) &&
      normalizedRating >= 1 &&
      normalizedRating <= 5
    ) {
      normalizedPayload.rating = normalizedRating;
    }

    const result = await this.api.request(`/tickets/${encodeURIComponent(normalizedTicketId)}`, {
      method: "PATCH",
      data: normalizedPayload,
      signal: requestOptions.signal || null,
    });

    if (
      !result.ok &&
      Object.prototype.hasOwnProperty.call(normalizedPayload, "rating") &&
      result.status === 400 &&
      /invalid_json_body/i.test(result.error || result.resp?.Error || "")
    ) {
      return {
        ...result,
        error:
          "Ошибка обновления рейтинга. Попробуйте позже!",
      };
    }

    return result;
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
    const normalizedContent = String(
      payload.message || payload.content || "",
    ).trim();

    if (!normalizedTicketId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "SupportService: не передан id обращения",
      };
    }

    const uploadedAttachment = await this._resolveUpload({
      file:
        payload.attachment instanceof File
          ? payload.attachment
          : payload.file instanceof File
            ? payload.file
            : null,
      fileKey: payload.contentFileKey || payload.content_file_key || "",
      signal: requestOptions.signal || null,
    });

    if (!uploadedAttachment.ok) {
      return uploadedAttachment;
    }

    if (!normalizedContent && !uploadedAttachment.fileKey) {
      return {
        ok: false,
        status: 400,
        resp: null,
        error: "Введите текст сообщения или приложите файл",
      };
    }

    const messagePayload = {};

    if (normalizedContent) {
      messagePayload.content = normalizedContent;
    }

    if (uploadedAttachment.fileKey) {
      messagePayload.content_file_key = uploadedAttachment.fileKey;
    }

    return this.api.request(
      `/tickets/${encodeURIComponent(normalizedTicketId)}/messages`,
      {
        method: "POST",
        data: messagePayload,
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

  async _resolveUpload({ file = null, fileKey = "", signal = null } = {}) {
    const normalizedFileKey = String(fileKey || "").trim();

    if (normalizedFileKey) {
      return {
        ok: true,
        status: 200,
        resp: {
          file_key: normalizedFileKey,
          file_name: getSupportFileDisplayName(normalizedFileKey),
        },
        error: "",
        aborted: false,
        fileKey: normalizedFileKey,
      };
    }

    if (!(file instanceof File)) {
      return {
        ok: true,
        status: 200,
        resp: null,
        error: "",
        aborted: false,
        fileKey: "",
      };
    }

    if (!file.name && file.size === 0) {
      return {
        ok: true,
        status: 200,
        resp: null,
        error: "",
        aborted: false,
        fileKey: "",
      };
    }

    const validationError = validateSupportFile(file);

    if (validationError) {
      return {
        ok: false,
        status: validationError.includes("10 МБ") ? 413 : 415,
        resp: null,
        error: validationError,
        aborted: false,
        fileKey: "",
      };
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadResult = await this.api.request("/files", {
      method: "POST",
      data: formData,
      signal,
    });

    if (!uploadResult.ok) {
      return {
        ...uploadResult,
        fileKey: "",
      };
    }

    const uploadedFileKey = String(
      uploadResult.resp?.file_key ||
        uploadResult.resp?.fileKey ||
        uploadResult.resp?.key ||
        "",
    ).trim();

    if (!uploadedFileKey) {
      return {
        ok: false,
        status: 500,
        resp: uploadResult.resp,
        error: "Не удалось получить ключ загруженного файла.",
        aborted: false,
        fileKey: "",
      };
    }

    return {
      ...uploadResult,
      fileKey: uploadedFileKey,
    };
  }
}

export const supportService = new SupportService(apiService);

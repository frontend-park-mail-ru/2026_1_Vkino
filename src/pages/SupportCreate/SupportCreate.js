import BasePage from "../BasePage.js";
import "./SupportCreate.precompiled.js";
import "../../css/support-create.scss";
import { supportService } from "../../js/SupportService.js";
import { router } from "../../router/index.js";
import { extractSupportTicket } from "../../utils/support.js";

const SUPPORT_CATEGORY_GROUPS = [
  {
    label: "bug",
    options: [
      { value: "bug:other", label: "other" },
      { value: "bug:feature", label: "feature" },
    ],
  },
  {
    label: "complaint",
    options: [
      { value: "complaint:other", label: "other" },
      { value: "complaint:feature", label: "feature" },
    ],
  },
  {
    label: "question",
    options: [
      { value: "question:other", label: "other" },
      { value: "question:feature", label: "feature" },
    ],
  },
];
const SUPPORT_WIDGET_EVENTS = {
  closeRequest: "vkino:support-widget-close-request",
  ticketCreated: "vkino:support-ticket-created",
};

/**
 * Страница создания нового обращения в техническую поддержку.
 */
export default class SupportCreatePage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "SupportCreatePage: не передан корневой элемент для SupportCreatePage",
      );
    }

    const isEmbedded = resolveEmbeddedMode(context);

    super(
      {
        categoryGroups: SUPPORT_CATEGORY_GROUPS,
        ...context,
        ...buildSupportCreateViewContext(isEmbedded),
        isEmbedded,
      },
      Handlebars.templates["SupportCreate.hbs"],
      parent,
      el,
      "SupportCreatePage",
    );

    this._fieldHandlers = new Map();
    this._submitHandler = null;
    this._isSubmitting = false;
    this._isEmbedded = isEmbedded;
  }

  addEventListeners() {
    const form = this._getForm();

    if (!form) {
      return;
    }

    [
      ["subject", "input"],
      ["category", "change"],
      ["message", "input"],
      ["attachment", "change"],
    ].forEach(([fieldName, eventName]) => {
      const field = this._getField(fieldName);
      if (!field) {
        return;
      }

      const handler = () => {
        this._setStatus("");
        this._validateField(fieldName);
      };

      field.addEventListener(eventName, handler);
      field.addEventListener("blur", handler);
      this._fieldHandlers.set(fieldName, { field, eventName, handler });
    });

    this._submitHandler = this._handleSubmit.bind(this);
    form.addEventListener("submit", this._submitHandler);

    if (this._isEmbedded) {
      document.addEventListener("keydown", this._onEmbeddedKeyDown);
    }
  }

  removeEventListeners() {
    const form = this._getForm();

    this._fieldHandlers.forEach(({ field, eventName, handler }) => {
      field.removeEventListener(eventName, handler);
      field.removeEventListener("blur", handler);
    });
    this._fieldHandlers.clear();

    if (form && this._submitHandler) {
      form.removeEventListener("submit", this._submitHandler);
    }

    if (this._isEmbedded) {
      document.removeEventListener("keydown", this._onEmbeddedKeyDown);
    }

    this._submitHandler = null;
  }

  async _handleSubmit(event) {
    event.preventDefault();
    this._setStatus("");

    if (!this._validateForm()) {
      return;
    }

    const form = this._getForm();
    const attachmentField = this._getField("attachment");

    if (!form || !attachmentField) {
      return;
    }

    this._setSubmitting(true);

    const result = await supportService.createTicket({
      subject: this._getField("subject")?.value,
      category: this._getField("category")?.value,
      message: this._getField("message")?.value,
      attachment: attachmentField.files?.[0] || null,
    });

    this._setSubmitting(false);

    if (result.status === 401) {
      if (this._isEmbedded && window.top && window.top !== window) {
        window.top.location.assign("/sign-in");
        return;
      }

      router.go("/sign-in");
      return;
    }

    if (!result.ok) {
      this._setStatus(
        result.error || "Не удалось создать обращение. Попробуйте ещё раз.",
        "error",
      );
      return;
    }

    const createdTicket = extractSupportTicket(result.resp);

    form.reset();
    this._clearValidationState();
    this._setStatus(
      createdTicket?.id
        ? `Обращение #${createdTicket.id} создано и отправлено в поддержку.`
        : "Обращение создано и отправлено в поддержку.",
      "success",
    );

    this._notifyParent(SUPPORT_WIDGET_EVENTS.ticketCreated, {
      ticketId: createdTicket?.id || "",
      message: createdTicket?.id
        ? `Обращение #${createdTicket.id} отправлено в поддержку.`
        : "Обращение отправлено в поддержку.",
    });
  }

  _onEmbeddedKeyDown = (event) => {
    if (event.key !== "Escape") {
      return;
    }

    this._notifyParent(SUPPORT_WIDGET_EVENTS.closeRequest);
  };

  _validateForm() {
    const fieldNames = ["subject", "category", "message", "attachment"];

    return fieldNames.every((fieldName) => !this._validateField(fieldName));
  }

  _validateField(fieldName) {
    const field = this._getField(fieldName);
    const errorEl = this._getErrorElement(fieldName);

    if (!field || !errorEl) {
      return "";
    }

    let message = "";

    switch (fieldName) {
      case "subject":
        message = String(field.value || "").trim()
          ? ""
          : "Укажите тему обращения";
        break;
      case "category":
        message = String(field.value || "").trim() ? "" : "Выберите категорию";
        break;
      case "message":
        message = String(field.value || "").trim() ? "" : "Опишите проблему";
        break;
      case "attachment":
        message = this._validateAttachment(field);
        break;
      default:
        break;
    }

    field.classList.toggle("is-error", Boolean(message));
    errorEl.textContent = message;

    return message;
  }

  _validateAttachment(field) {
    const file = field.files?.[0];

    if (!file) {
      return "";
    }

    return isSupportedAttachment(file)
      ? ""
      : "Поддерживаются только изображения и PDF";
  }

  _clearValidationState() {
    ["subject", "category", "message", "attachment"].forEach((fieldName) => {
      const field = this._getField(fieldName);
      const errorEl = this._getErrorElement(fieldName);

      field?.classList.remove("is-error");
      if (errorEl) {
        errorEl.textContent = "";
      }
    });
  }

  _setStatus(message, tone = "") {
    const status = this.el.querySelector("#support-create-status");

    if (!status) {
      return;
    }

    status.textContent = message || "";
    status.className = "support-create__status";

    if (tone) {
      status.classList.add(`support-create__status--${tone}`);
    }
  }

  _setSubmitting(isSubmitting) {
    this._isSubmitting = Boolean(isSubmitting);

    const submitButton = this.el.querySelector('[type="submit"]');

    if (submitButton) {
      submitButton.disabled = this._isSubmitting;
      submitButton.textContent = this._isSubmitting
        ? "Отправляем..."
        : "Создать обращение";
    }
  }

  _getForm() {
    return this.el.querySelector('[data-support-form="create-ticket"]');
  }

  _getField(fieldName) {
    return this.el.querySelector(`[name="${fieldName}"]`);
  }

  _getErrorElement(fieldName) {
    const errorIds = {
      subject: "#support-subject-error",
      category: "#support-category-error",
      message: "#support-message-error",
      attachment: "#support-attachment-error",
    };

    return this.el.querySelector(errorIds[fieldName] || "");
  }

  _notifyParent(type, payload = {}) {
    if (!this._isEmbedded || window.parent === window) {
      return;
    }

    window.parent.postMessage(
      {
        type,
        ...payload,
      },
      window.location.origin,
    );
  }
}

function isSupportedAttachment(file) {
  const fileType = String(file?.type || "").toLowerCase();
  const fileName = String(file?.name || "").toLowerCase();

  return (
    fileType.startsWith("image/") ||
    fileType === "application/pdf" ||
    fileName.endsWith(".pdf")
  );
}

function resolveEmbeddedMode(context = {}) {
  if (typeof context.isEmbedded === "boolean") {
    return context.isEmbedded;
  }

  const params = new URLSearchParams(window.location.search);

  return params.get("embed") === "1";
}

function buildSupportCreateViewContext(isEmbedded) {
  if (isEmbedded) {
    return {
      pageClass: "page page_support-create page_support-create--embed",
      mainClass: "support-create-page support-create-page--embed",
      heroClass: "support-create__hero support-create__hero--embed",
      cardClass: "support-create__card support-create__card--embed",
      titleText: "Создать обращение",
      descriptionText:
        "Опишите проблему и отправьте обращение без перехода с текущей страницы.",
    };
  }

  return {
    pageClass: "page page_support-create",
    mainClass: "support-create-page",
    heroClass: "support-create__hero",
    cardClass: "support-create__card",
    titleText: "Новое обращение",
    descriptionText: "Опишите проблему, выберите категорию и приложите файл.",
  };
}

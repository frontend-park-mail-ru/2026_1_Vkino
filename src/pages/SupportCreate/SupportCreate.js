import BasePage from "../BasePage.js";
import "./SupportCreate.precompiled.js";
import "../../css/support-create.scss";
import { supportService } from "../../js/SupportService.js";
import { router } from "../../router/index.js";
import { authStore } from "../../store/authStore.js";
import { extractSupportTicket } from "../../utils/support.js";

const SUPPORT_CATEGORY_OPTIONS = [
  { value: "bug", label: "bug" },
  { value: "feature", label: "feature" },
  { value: "complaint", label: "complaint" },
  { value: "question", label: "question" },
  { value: "other", label: "other" },
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
    const authState = authStore.getState();
    const isNotAuthorized = authState.status !== "authenticated";
    const userEmail = isNotAuthorized
      ? String(authState.user?.email || "").trim()
      : "";

    super(
      {
        categoryOptions: SUPPORT_CATEGORY_OPTIONS,
        ...context,
        ...buildSupportCreateViewContext(isEmbedded),
        isEmbedded,
        isNotAuthorized,
        userEmail,
      },
      Handlebars.templates["SupportCreate.hbs"],
      parent,
      el,
      "SupportCreatePage",
    );

    this._fieldHandlers = new Map();
    this._submitHandler = null;
    this._submitButtonHandler = null;
    this._isSubmitting = false;
    this._isEmbedded = isEmbedded;
    this._categoryMenuHandler = null;
    this._categoryOutsideHandler = null;
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

        if (fieldName === "message") {
          this._syncMessageHeight();
        }

        if (fieldName === "attachment") {
          this._syncAttachmentName();
        }
      };

      field.addEventListener(eventName, handler);
      field.addEventListener("blur", handler);
      this._fieldHandlers.set(fieldName, { field, eventName, handler });
    });

    this._submitHandler = this._handleSubmit.bind(this);
    form.addEventListener("submit", this._submitHandler);

    const submitButton = this._getSubmitButton();
    this._submitButtonHandler = (event) => {
      event.preventDefault();
      this._handleSubmit(event);
    };
    submitButton?.addEventListener("click", this._submitButtonHandler);

    this._bindCategoryDropdown();
    this._syncMessageHeight();

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

    const submitButton = this._getSubmitButton();
    if (submitButton && this._submitButtonHandler) {
      submitButton.removeEventListener("click", this._submitButtonHandler);
    }

    this._unbindCategoryDropdown();

    if (this._isEmbedded) {
      document.removeEventListener("keydown", this._onEmbeddedKeyDown);
    }

    this._submitHandler = null;
    this._submitButtonHandler = null;
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
    let result;

    try {
      result = await supportService.createTicket({
        email: this._getField("email")?.value,
        subject: this._getField("subject")?.value,
        category: this._getField("category")?.value,
        message: this._getField("message")?.value,
        attachment: attachmentField.files?.[0] || null,
      });
    } catch (error) {
      this._setSubmitting(false);
      this._setStatus(
        mapSupportCreateError({
          error: error instanceof Error ? error.message : "",
        }),
        "error",
      );
      return;
    }

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
        mapSupportCreateError(result),
        "error",
      );
      return;
    }

    const createdTicket = extractSupportTicket(result.resp);

    form.reset();
    this._clearValidationState();
    this._resetCategorySelection();
    this._syncMessageHeight();
    this._syncAttachmentName();
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
    const control = this._getFieldControl(fieldName);

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
    control?.classList.toggle("is-error", Boolean(message));
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
      const control = this._getFieldControl(fieldName);
      const errorEl = this._getErrorElement(fieldName);

      field?.classList.remove("is-error");
      control?.classList.remove("is-error");
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

  _getSubmitButton() {
    return this.el.querySelector('button[type="submit"]');
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

  _getFieldControl(fieldName) {
    const controlSelectors = {
      category: ".support-create__category-trigger",
      attachment: ".support-create__file-trigger",
    };

    const selector = controlSelectors[fieldName];

    if (!selector) {
      return null;
    }

    return this.el.querySelector(selector);
  }

  _syncAttachmentName() {
    const attachmentField = this._getField("attachment");
    const attachmentName = this.el.querySelector("#support-attachment-name");

    if (!attachmentName) {
      return;
    }

    attachmentName.textContent = attachmentField?.files?.[0]?.name || "";
  }

  _syncMessageHeight() {
    const messageField = this._getField("message");

    if (!messageField) {
      return;
    }

    messageField.style.height = "auto";
    messageField.style.height = `${messageField.scrollHeight}px`;
  }

  _bindCategoryDropdown() {
    const categoryRoot = this.el.querySelector("[data-support-category]");

    if (!categoryRoot) {
      return;
    }

    this._categoryMenuHandler = (event) => {
      const option = event.target.closest("[data-support-category-option]");
      const trigger = event.target.closest("[data-support-category-trigger]");

      if (trigger) {
        this._toggleCategoryMenu();
        return;
      }

      if (!option) {
        return;
      }

      this._selectCategoryOption(option.dataset.value || "", option.textContent);
    };

    this._categoryOutsideHandler = (event) => {
      if (categoryRoot.contains(event.target)) {
        return;
      }

      this._closeCategoryMenu();
    };

    categoryRoot.addEventListener("click", this._categoryMenuHandler);
    document.addEventListener("click", this._categoryOutsideHandler);
  }

  _unbindCategoryDropdown() {
    const categoryRoot = this.el.querySelector("[data-support-category]");

    if (categoryRoot && this._categoryMenuHandler) {
      categoryRoot.removeEventListener("click", this._categoryMenuHandler);
    }

    if (this._categoryOutsideHandler) {
      document.removeEventListener("click", this._categoryOutsideHandler);
    }

    this._categoryMenuHandler = null;
    this._categoryOutsideHandler = null;
  }

  _toggleCategoryMenu() {
    const menu = this.el.querySelector("[data-support-category-menu]");

    if (!menu) {
      return;
    }

    if (menu.hidden) {
      this._openCategoryMenu();
      return;
    }

    this._closeCategoryMenu();
  }

  _openCategoryMenu() {
    const root = this.el.querySelector("[data-support-category]");
    const menu = this.el.querySelector("[data-support-category-menu]");
    const trigger = this.el.querySelector("[data-support-category-trigger]");

    if (!root || !menu || !trigger) {
      return;
    }

    root.classList.add("is-open");
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  _closeCategoryMenu() {
    const root = this.el.querySelector("[data-support-category]");
    const menu = this.el.querySelector("[data-support-category-menu]");
    const trigger = this.el.querySelector("[data-support-category-trigger]");

    if (!root || !menu || !trigger) {
      return;
    }

    root.classList.remove("is-open");
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  _selectCategoryOption(value, label = "") {
    const field = this._getField("category");
    const fieldLabel = this.el.querySelector("[data-support-category-label]");

    if (!field || !fieldLabel) {
      return;
    }

    field.value = String(value || "");
    fieldLabel.textContent = String(label || "").trim() || "Выберите категорию";
    field.dispatchEvent(new Event("change", { bubbles: true }));
    this._closeCategoryMenu();
    this._setStatus("");
    this._validateField("category");
  }

  _resetCategorySelection() {
    const field = this._getField("category");
    const fieldLabel = this.el.querySelector("[data-support-category-label]");

    if (field) {
      field.value = "";
    }

    if (fieldLabel) {
      fieldLabel.textContent = "Выберите категорию";
    }

    this._closeCategoryMenu();
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

function mapSupportCreateError(result = {}) {
  const rawError = String(
    result.error ||
      result.resp?.Error ||
      result.resp?.error ||
      result.resp?.message ||
      result.resp?.raw ||
      "",
  )
    .trim()
    .toLowerCase();

  if (!rawError && result.status === 0) {
    return "Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз позже.";
  }

  if (
    rawError.includes("invalid json body") ||
    rawError.includes("unexpected end of json") ||
    rawError.includes("cannot unmarshal") ||
    rawError.includes("json")
  ) {
    return "Сервер не смог обработать обращение. Попробуйте отправить его ещё раз позже.";
  }

  if (
    rawError.includes("payload too large") ||
    rawError.includes("request entity too large") ||
    result.status === 413
  ) {
    return "Файл слишком большой. Загрузите файл меньшего размера.";
  }

  if (
    rawError.includes("unsupported media type") ||
    rawError.includes("invalid file type") ||
    result.status === 415
  ) {
    return "Поддерживаются только изображения и PDF-документы.";
  }

  if (result.status === 400) {
    return "Проверьте заполнение полей формы и попробуйте ещё раз.";
  }

  if (result.status === 401) {
    return "Нужно заново войти в аккаунт.";
  }

  if (result.status === 403) {
    return "У вас нет доступа к отправке обращений.";
  }

  if (result.status >= 500) {
    return "На сервере произошла ошибка. Попробуйте ещё раз позже.";
  }

  return (
    result.error ||
    result.resp?.Error ||
    result.resp?.error ||
    result.resp?.message ||
    "Не удалось создать обращение. Попробуйте ещё раз."
  );
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

import BasePage from "../BasePage.js";
import "./Settings.precompiled.js";
import "@/css/settings.scss";
import "@/css/subscription.scss";

import { initPasswordToggle } from "@/js/password/eye-btn.js";
import { setError, validatePassword } from "@/js/password/validation.js";
import { userService } from "@/js/UserService.js";
import { authStore } from "@/store/authStore.js";
import { router } from "@/router/index.js";
import HeaderComponent from "@/components/Header/Header.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import { resolveAvatarUrl } from "@/utils/avatar.js";
import { extractProfile } from "@/utils/apiResponse.js";
import {
  normalizeSubscriptionFromApi,
  markPlansForPreview,
  getDefaultSubscriptionPlansPreview,
} from "@/utils/subscriptionDisplay.js";
import {
  extractCoinsBalanceFromProfile,
  normalizeCoinsHistoryResponse,
  VKINO_COINS_INFO_TEXT,
  VKINO_COIN_ICON_SRC,
} from "@/utils/coinsDisplay.js";
import { initCoinsInfoPopover } from "@/js/coinsInfoPopover.js";
import {
  paymentService,
  PENDING_PAYMENT_KEY,
  PENDING_PAYMENT_CONTEXT_KEY,
  PAYMENT_CONTEXT_COINS,
} from "@/js/PaymentService.js";
import {
  pollPaymentStatus,
  resolvePaymentId,
} from "@/js/paymentStatusPoll.js";

const BIRTHDATE_MIN_YEAR = 1900;
const BIRTHDATE_MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];
const BIRTHDATE_MONTH_NAMES_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

export default class SettingsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "SettingsPage: не передан корневой элемент для SettingsPage",
      );
    }

    const finalContext = {
      userData: { email: "", birthDate: "", avatarUrl: "" }, // временно
      coinHistory: [],
      coinsBalance: "—",
      coinsPacks: [],
      coinsPacksError: "Загрузка пакетов…",
      coinsIconSrc: VKINO_COIN_ICON_SRC,
      coinsInfoText: VKINO_COINS_INFO_TEXT,
      emptyCoinsTitle: "Пока здесь пусто",
      emptyCoinsDescription:
        "Смотрите фильмы и участвуйте в активностях VKino, чтобы начать зарабатывать Vkino coins.",
      currentSubscription: null,
      subscriptionPlans: markPlansForPreview(
        getDefaultSubscriptionPlansPreview(),
        null,
      ),
      ...context,
    };

    super(
      finalContext,
      Handlebars.templates["Settings.hbs"],
      parent,
      el,
      "SettingsPage",
    );

    this._detachStyles = null;
    this._destroyPasswordToggle = null;
    this._originalValues = {};
    this._editableInputHandlers = new Map();
    this._passwordInputHandlers = new Map();
    this._buttonHandlers = new Map();
    this._birthdateCalendar = null;
    this._birthdateCalendarHandlers = [];
    this._avatarInputHandler = null;
    this._pendingAvatarFile = null;
    this._authUnsubscribe = null;
    this._settingsSubscriptionHydrated = false;
    this._coinsSectionHydrated = false;
    this._destroyCoinsInfoPopover = null;
    this._buyCoinsModalHandlers = [];
    this._bodyLockSnapshot = null;
    this._paymentPollController = null;
    this._paymentReturnHandled = false;
    this._coinsPaymentResultToShow = null;

    this.context.userData = this._buildUserDataFromStore(authStore.getState());
    this.context.coinsBalance = this._formatCoinsBalance(
      authStore.getState().user,
    );
  }

  init() {
    const state = authStore.getState();

    if (state.status === "loading") {
      this._authUnsubscribe = authStore.subscribe((newState) => {
        if (newState.status === "loading") return;

        if (!newState.user) {
          router.go("/sign-in");
          return;
        }

        this._authUnsubscribe?.();
        this._authUnsubscribe = null;

        this._settingsSubscriptionHydrated = false;
        this._coinsSectionHydrated = false;
        this.refresh({
          ...this.context,
          userData: this._buildUserDataFromStore(newState),
        });
      });

      return super.init();
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    this.context.userData = this._buildUserDataFromStore(state);
    super.init();

    if (!this._settingsSubscriptionHydrated) {
      void this._loadSubscriptionSection();
    }
    if (!this._coinsSectionHydrated) {
      void this.loadCoinsContext();
    }
    this._scrollSubscriptionIntoViewIfNeeded();
    this._scrollBuyCoinsIntoViewIfNeeded();

    return this;
  }

  _buildUserDataFromStore(state) {
    const userFromStore = state?.user || {};

    return {
      email: userFromStore.email || "",
      birthDate: normalizeDateInputValue(userFromStore.birthdate),
      avatarUrl: resolveAvatarUrl(userFromStore.avatar_url),
    };
  }

  async _loadSubscriptionSection() {
    const state = authStore.getState();
    let current = state.user?.subscription ?? null;
    let usageSummary = null;

    if (state.user?.usage) {
      usageSummary = this._buildUsageSummary(state.user.usage, state.user.capabilities);
    }

    const [plansRes, subRes] = await Promise.all([
      userService.getSubscriptionPlans(),
      !current || !usageSummary
        ? userService.getCurrentUserSubscription()
        : Promise.resolve({ ok: true, resp: null }),
    ]);

    if ((!current || !usageSummary) && subRes.ok) {
      current = current ?? normalizeSubscriptionFromApi(subRes.resp?.subscription);
      if (subRes.resp?.usage) {
        usageSummary = this._buildUsageSummary(subRes.resp.usage, subRes.resp?.capabilities);
      }
    }

    let previewPlans = getDefaultSubscriptionPlansPreview();
    if (
      plansRes.ok &&
      Array.isArray(plansRes.resp?.plans) &&
      plansRes.resp.plans.length > 0
    ) {
      previewPlans = plansRes.resp.plans.map((p) => ({
        id: p.id,
        name: p.name,
        tier: Number(p.tier) || 0,
        priceSummary:
          p.tier > 0 && p.priceMoney
            ? `${p.priceMoney} ₽ / мес`
            : p.tier > 0 && p.price
              ? String(p.price).includes("₽")
                ? `${p.price} / мес`
                : `${p.price} / мес`
              : "Бесплатно",
      }));
    }

    const subscriptionPlans = markPlansForPreview(previewPlans, current);

    this._settingsSubscriptionHydrated = true;
    this.refresh({
      ...this.context,
      currentSubscription: current,
      subscriptionPlans,
      subscriptionUsageSummary: usageSummary,
    });

    this._scrollSubscriptionIntoViewIfNeeded();
  }

  async loadCoinsContext({ afterPayment = false } = {}) {
    if (afterPayment) {
      await authStore.refreshUserProfile();
    }

    const [historyRes, packsRes] = await Promise.all([
      userService.getCoinsHistory({ limit: 50, offset: 0 }),
      paymentService.getCoinsPacks(),
    ]);

    const coinHistory = historyRes.ok
      ? normalizeCoinsHistoryResponse(historyRes.resp).items
      : [];

    let coinsPacks = [];
    let coinsPacksError = "";

    if (packsRes.ok && Array.isArray(packsRes.resp?.packs)) {
      coinsPacks = packsRes.resp.packs.map((pack) => ({
        id: pack.id,
        title: pack.title || `${pack.coins_amount} VKino coins`,
        coinsAmount: pack.coins_amount,
        priceLabel: `${pack.price_money} ₽`,
      }));
    } else {
      coinsPacksError = getApiErrorMessage(packsRes, {
        fallback: "Не удалось загрузить пакеты. Попробуйте позже.",
      });
    }

    const coinsBalance = this._formatCoinsBalance(authStore.getState().user);

    this._coinsSectionHydrated = true;
    this.refresh({
      ...this.context,
      coinHistory,
      coinsBalance,
      coinsPacks,
      coinsPacksError: coinsPacksError || (coinsPacks.length ? "" : "Пакеты временно недоступны."),
    });

    if (this._coinsPaymentResultToShow) {
      this._openBuyCoinsResultModal();
      this._setBuyCoinsResultView(this._coinsPaymentResultToShow);
      this._coinsPaymentResultToShow = null;
      sessionStorage.removeItem(PENDING_PAYMENT_CONTEXT_KEY);
      this._cleanPaymentReturnUrl();
      return;
    }

    void this._handlePaymentReturn();
  }

  _formatCoinsBalance(user) {
    const balance = extractCoinsBalanceFromProfile(user);
    return balance === null ? "—" : String(balance);
  }

  _buildUsageSummary(usage, capabilities) {
    if (!usage) return null;

    const parts = [];
    if (usage.coinsRemainingToday != null) {
      parts.push(`Coins сегодня: ${usage.coinsRemainingToday}`);
    }
    if (usage.roomsRemainingThisMonth != null) {
      parts.push(`Комнат в этом месяце: ${usage.roomsRemainingThisMonth}`);
    } else if (capabilities?.monthlyRoomLimit == null) {
      parts.push("Комнаты: без лимита");
    }

    return parts.length ? parts.join(" · ") : null;
  }

  _scrollSubscriptionIntoViewIfNeeded() {
    if (window.location.hash !== "#subscription") {
      return;
    }
    requestAnimationFrame(() => {
      document
        .getElementById("subscription")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  _scrollBuyCoinsIntoViewIfNeeded() {
    if (window.location.hash !== "#buy-coins") {
      return;
    }
    requestAnimationFrame(() => {
      document
        .getElementById("buy-coins")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  addEventListeners() {
    this._destroyPasswordToggle = initPasswordToggle(this.el);
    this._destroyCoinsInfoPopover = initCoinsInfoPopover(this.el);
    this._setupEditableFields();
    this._setupBirthdateCalendar();
    this._setupAvatarUpload();
    this._setupPasswordValidation();
    this._setupButtonHandlers();
    this._setupBuyCoinsModal();
    this._checkForChanges();
  }

  _setupEditableFields() {
    const editableInputs = this.el.querySelectorAll(
      ".settings__input_editable",
    );
    editableInputs.forEach((input) => {
      const field = input.dataset.field;
      this._originalValues[field] = input.value;

      const onInput = () => {
        if (field === "birthdate") {
          this._validateBirthDate();
        }

        this._setProfileSaveError("");
        this._checkForChanges();
      };

      input.addEventListener("input", onInput);
      input.addEventListener("blur", onInput);
      this._editableInputHandlers.set(input, onInput);
    });
  }

  _validateBirthDate() {
    const birthDateInput = this.el.querySelector("#birthDate");
    const errorEl = this.el.querySelector("#birthdate-error");
    const trigger = this.el.querySelector('[data-role="birthdate-trigger"]');
    const value = normalizeDateInputValue(birthDateInput?.value);

    if (!birthDateInput) {
      return "";
    }

    if (!value) {
      setError(birthDateInput, errorEl, "");
      trigger?.classList.remove("is-error");
      return "";
    }

    const parsedBirthDate = parseStrictDateInputValue(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let message = "";

    if (!parsedBirthDate) {
      message = "Введите корректную дату рождения";
    } else if (parsedBirthDate > today) {
      message = "Дата рождения не может быть позже сегодняшнего дня";
    }

    setError(birthDateInput, errorEl, message);
    trigger?.classList.toggle("is-error", Boolean(message));
    return message;
  }

  _setupBirthdateCalendar() {
    const root = this.el.querySelector('[data-role="birthdate-picker"]');
    const input = this.el.querySelector("#birthDate");
    const trigger = this.el.querySelector('[data-role="birthdate-trigger"]');
    const popup = this.el.querySelector('[data-role="birthdate-calendar"]');
    const label = this.el.querySelector('[data-role="birthdate-label"]');
    const grid = this.el.querySelector('[data-role="birthdate-calendar-grid"]');
    const monthSelect = this.el.querySelector('[data-role="birthdate-month"]');
    const yearSelect = this.el.querySelector('[data-role="birthdate-year"]');

    if (
      !root ||
      !input ||
      !trigger ||
      !popup ||
      !label ||
      !grid ||
      !monthSelect ||
      !yearSelect
    ) {
      return;
    }

    const selectedValue = normalizeDateInputValue(input.value);
    input.value = selectedValue;

    const selectedDate = parseStrictDateInputValue(selectedValue);
    const today = getTodayDate();
    const viewSource = selectedDate || today;

    this._birthdateCalendar = {
      root,
      input,
      trigger,
      popup,
      label,
      grid,
      monthSelect,
      yearSelect,
      viewDate: new Date(viewSource.getFullYear(), viewSource.getMonth(), 1),
    };

    this._syncBirthdateCalendarLabel();
    this._renderBirthdateCalendar();

    const onRootClick = (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (!actionButton || !root.contains(actionButton)) {
        return;
      }

      const { action } = actionButton.dataset;

      if (action === "toggle-birthdate-calendar") {
        event.preventDefault();
        this._toggleBirthdateCalendar();
        return;
      }

      if (action === "birthdate-prev-month") {
        event.preventDefault();
        this._shiftBirthdateCalendarMonth(-1);
        return;
      }

      if (action === "birthdate-next-month") {
        event.preventDefault();
        this._shiftBirthdateCalendarMonth(1);
        return;
      }

      if (action === "select-birthdate") {
        event.preventDefault();
        if (!actionButton.disabled) {
          this._setBirthdateCalendarValue(actionButton.dataset.date || "");
          this._closeBirthdateCalendar();
        }
        return;
      }

      if (action === "clear-birthdate") {
        event.preventDefault();
        this._setBirthdateCalendarValue("");
        this._closeBirthdateCalendar();
      }
    };

    const onRootChange = (event) => {
      if (event.target === monthSelect) {
        const month = Number(monthSelect.value);
        if (Number.isInteger(month)) {
          this._setBirthdateCalendarView(
            this._birthdateCalendar.viewDate.getFullYear(),
            month,
          );
        }
      }

      if (event.target === yearSelect) {
        const year = Number(yearSelect.value);
        if (Number.isInteger(year)) {
          this._setBirthdateCalendarView(
            year,
            this._birthdateCalendar.viewDate.getMonth(),
          );
        }
      }
    };

    const onDocumentClick = (event) => {
      if (!root.contains(event.target)) {
        this._closeBirthdateCalendar();
      }
    };

    const onDocumentKeydown = (event) => {
      if (event.key === "Escape") {
        this._closeBirthdateCalendar();
        trigger.focus();
      }
    };

    root.addEventListener("click", onRootClick);
    root.addEventListener("change", onRootChange);
    document.addEventListener("click", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeydown);

    this._birthdateCalendarHandlers = [
      { target: root, type: "click", handler: onRootClick },
      { target: root, type: "change", handler: onRootChange },
      { target: document, type: "click", handler: onDocumentClick },
      { target: document, type: "keydown", handler: onDocumentKeydown },
    ];
  }

  _toggleBirthdateCalendar() {
    if (!this._birthdateCalendar) {
      return;
    }

    if (this._birthdateCalendar.popup.hidden) {
      this._openBirthdateCalendar();
    } else {
      this._closeBirthdateCalendar();
    }
  }

  _openBirthdateCalendar() {
    if (!this._birthdateCalendar) {
      return;
    }

    const { popup, trigger } = this._birthdateCalendar;
    popup.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  _closeBirthdateCalendar() {
    if (!this._birthdateCalendar) {
      return;
    }

    const { popup, trigger } = this._birthdateCalendar;
    popup.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  _shiftBirthdateCalendarMonth(step) {
    if (!this._birthdateCalendar) {
      return;
    }

    const { viewDate } = this._birthdateCalendar;
    this._setBirthdateCalendarView(
      viewDate.getFullYear(),
      viewDate.getMonth() + step,
    );
  }

  _setBirthdateCalendarView(year, month) {
    if (!this._birthdateCalendar) {
      return;
    }

    const today = getTodayDate();
    const nextViewDate = new Date(year, month, 1);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const minMonthStart = new Date(BIRTHDATE_MIN_YEAR, 0, 1);

    if (nextViewDate > currentMonthStart) {
      this._birthdateCalendar.viewDate = currentMonthStart;
    } else if (nextViewDate < minMonthStart) {
      this._birthdateCalendar.viewDate = minMonthStart;
    } else {
      this._birthdateCalendar.viewDate = nextViewDate;
    }

    this._renderBirthdateCalendar();
  }

  _setBirthdateCalendarValue(value) {
    if (!this._birthdateCalendar) {
      return;
    }

    const normalizedValue = normalizeDateInputValue(value);
    const { input } = this._birthdateCalendar;
    const selectedDate = parseStrictDateInputValue(normalizedValue);

    input.value = selectedDate ? normalizedValue : "";

    if (selectedDate) {
      this._birthdateCalendar.viewDate = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        1,
      );
    }

    this._syncBirthdateCalendarLabel();
    this._renderBirthdateCalendar();
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  _syncBirthdateCalendarLabel() {
    if (!this._birthdateCalendar) {
      return;
    }

    const { input, label, trigger } = this._birthdateCalendar;
    const normalizedValue = normalizeDateInputValue(input.value);
    const labelText = formatBirthdateDisplayValue(normalizedValue);

    label.textContent = labelText || "Выберите дату";
    trigger.classList.toggle("has-value", Boolean(labelText));
  }

  _renderBirthdateCalendar() {
    if (!this._birthdateCalendar) {
      return;
    }

    const {
      grid,
      input,
      monthSelect,
      yearSelect,
      popup,
      viewDate,
    } = this._birthdateCalendar;
    const selectedValue = normalizeDateInputValue(input.value);
    const today = getTodayDate();
    const todayValue = formatDateInputValue(today);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const minYear = Math.min(BIRTHDATE_MIN_YEAR, year);
    const maxYear = today.getFullYear();

    monthSelect.replaceChildren(
      ...BIRTHDATE_MONTH_NAMES.map((monthName, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = monthName;
        option.selected = index === month;
        option.disabled =
          year === today.getFullYear() && index > today.getMonth();
        return option;
      }),
    );

    const yearOptions = [];
    for (let optionYear = maxYear; optionYear >= minYear; optionYear -= 1) {
      const option = document.createElement("option");
      option.value = String(optionYear);
      option.textContent = String(optionYear);
      option.selected = optionYear === year;
      yearOptions.push(option);
    }
    yearSelect.replaceChildren(...yearOptions);

    const firstDay = new Date(year, month, 1);
    const firstWeekday = getMondayBasedWeekday(firstDay);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < firstWeekday; index += 1) {
      const placeholder = document.createElement("span");
      placeholder.className = "settings-date__day-placeholder";
      cells.push(placeholder);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      const dateValue = formatDateInputValue(date);
      const button = document.createElement("button");

      button.type = "button";
      button.className = "settings-date__day";
      button.dataset.action = "select-birthdate";
      button.dataset.date = dateValue;
      button.textContent = String(day);
      button.disabled = date > today;
      button.classList.toggle("is-selected", dateValue === selectedValue);
      button.classList.toggle("is-today", dateValue === todayValue);
      cells.push(button);
    }

    grid.replaceChildren(...cells);

    const previousButton = popup.querySelector(
      '[data-action="birthdate-prev-month"]',
    );
    const nextButton = popup.querySelector(
      '[data-action="birthdate-next-month"]',
    );
    const nextMonth = new Date(year, month + 1, 1);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    if (previousButton) {
      previousButton.disabled = year <= BIRTHDATE_MIN_YEAR && month === 0;
    }
    if (nextButton) {
      nextButton.disabled = nextMonth > currentMonthStart;
    }
  }

  _destroyBirthdateCalendar() {
    for (const { target, type, handler } of this._birthdateCalendarHandlers) {
      target.removeEventListener(type, handler);
    }
    this._birthdateCalendarHandlers = [];
    this._birthdateCalendar = null;
  }

  _setupAvatarUpload() {
    const avatarInput = this.el.querySelector("#avatarInput");
    if (!avatarInput) return;

    const onChange = () => {
      const file = avatarInput.files?.[0] || null;
      if (!file) {
        this._pendingAvatarFile = null;
        this._setAvatarError("");
        this._checkForChanges();
        return;
      }

      const validationError = this._validateAvatarFile(file);
      if (validationError) {
        this._pendingAvatarFile = null;
        avatarInput.value = "";
        this._setAvatarError(validationError);
        this._checkForChanges();
        return;
      }

      this._pendingAvatarFile = file;
      this._setAvatarError("");
      this._previewAvatar(file);
      this._checkForChanges();
    };

    avatarInput.addEventListener("change", onChange);
    this._avatarInputHandler = onChange;
  }

  _validateAvatarFile(file) {
    const maxBytes = 5 * 1024 * 1024;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

    if (!allowedTypes.has(file.type)) {
      return "Поддерживаются только PNG, JPG и WEBP";
    }
    if (file.size > maxBytes) {
      return "Размер файла должен быть не больше 5MB";
    }
    return "";
  }

  _previewAvatar(file) {
    const avatarPreview = this.el.querySelector('[data-role="avatar-preview"]');
    if (!avatarPreview) return;
    const objectUrl = URL.createObjectURL(file);
    avatarPreview.src = objectUrl;
    avatarPreview.onload = () => URL.revokeObjectURL(objectUrl);
  }

  _renderAvatar(url) {
    const avatarPreview = this.el.querySelector('[data-role="avatar-preview"]');
    if (!avatarPreview) return;

    avatarPreview.src = resolveAvatarUrl(url);
  }

  _setAvatarError(message) {
    const errorEl = this.el.querySelector("#avatar-error");
    if (errorEl) errorEl.textContent = message;
  }

  _setProfileSaveError(message) {
    const errorEl = this.el.querySelector("#profile-save-error");
    if (errorEl) {
      errorEl.textContent = message || "";
    }
  }

  _setPasswordSuccess(message) {
    const successEl = this.el.querySelector("#password-success");
    if (successEl) {
      successEl.textContent = message || "";
    }
  }

  _setupPasswordValidation() {
    const passwordFields = this._getPasswordFields();

    passwordFields.forEach(({ input }) => {
      if (!input) return;
      const onInputOrBlur = () => {
        this._setPasswordSuccess("");
        this._validatePasswordField(input.id);
        this._updatePasswordButtonState();
      };
      input.addEventListener("input", onInputOrBlur);
      input.addEventListener("blur", onInputOrBlur);
      this._passwordInputHandlers.set(input, onInputOrBlur);
    });

    this._updatePasswordButtonState();
  }

  _getPasswordFields() {
    return [
      {
        id: "oldPassword",
        input: this.el.querySelector("#oldPassword"),
        errorEl: this.el.querySelector("#old-password-error"),
      },
      {
        id: "newPassword",
        input: this.el.querySelector("#newPassword"),
        errorEl: this.el.querySelector("#new-password-error"),
      },
      {
        id: "confirmPassword",
        input: this.el.querySelector("#confirmPassword"),
        errorEl: this.el.querySelector("#confirm-password-error"),
      },
    ];
  }

  _validatePasswordField(fieldId) {
    const old = this.el.querySelector("#oldPassword")?.value || "";
    const newP = this.el.querySelector("#newPassword")?.value || "";
    const conf = this.el.querySelector("#confirmPassword")?.value || "";

    const hasAny = !!old || !!newP || !!conf;

    if (fieldId === "oldPassword") {
      const msg = hasAny && !old ? "Введите текущий пароль" : "";
      setError(
        this.el.querySelector("#oldPassword"),
        this.el.querySelector("#old-password-error"),
        msg,
      );
      return msg;
    }

    if (fieldId === "newPassword") {
      const msg = newP
        ? validatePassword(newP)
        : hasAny
          ? "Введите новый пароль"
          : "";
      setError(
        this.el.querySelector("#newPassword"),
        this.el.querySelector("#new-password-error"),
        msg,
      );

      if (conf && conf !== newP) {
        setError(
          this.el.querySelector("#confirmPassword"),
          this.el.querySelector("#confirm-password-error"),
          "Пароли не совпадают",
        );
      } else if (!conf && newP) {
        setError(
          this.el.querySelector("#confirmPassword"),
          this.el.querySelector("#confirm-password-error"),
          "Повторите новый пароль",
        );
      } else {
        setError(
          this.el.querySelector("#confirmPassword"),
          this.el.querySelector("#confirm-password-error"),
          "",
        );
      }

      return msg;
    }

    if (fieldId === "confirmPassword") {
      const msg =
        conf && conf !== newP
          ? "Пароли не совпадают"
          : hasAny && !conf
            ? "Повторите новый пароль"
            : "";
      setError(
        this.el.querySelector("#confirmPassword"),
        this.el.querySelector("#confirm-password-error"),
        msg,
      );
      return msg;
    }

    return "";
  }

  _updatePasswordButtonState() {
    const old = this.el.querySelector("#oldPassword")?.value || "";
    const newP = this.el.querySelector("#newPassword")?.value || "";
    const conf = this.el.querySelector("#confirmPassword")?.value || "";

    const hasAny = !!old || !!newP || !!conf;
    const isComplete = !!old && !!newP && !!conf;
    const isValidPass = !validatePassword(newP);
    const passwordsMatch = newP === conf;

    const btn = this.el.querySelector('[data-action="change-password"]');
    if (!btn) return;

    const isActive = isComplete && isValidPass && passwordsMatch;

    if (isActive) {
      btn.classList.add("btn_accent");
      btn.classList.remove("btn_outline");
    } else {
      btn.classList.remove("btn_accent");
      btn.classList.add("btn_outline");
    }

    btn.disabled = !hasAny || !isActive;
  }

  _checkForChanges() {
    const editableInputs = this.el.querySelectorAll(
      ".settings__input_editable",
    );
    let hasChanges = false;
    const birthDateError = this._validateBirthDate();

    for (const input of editableInputs) {
      const field = input.dataset.field;
      if (input.value !== this._originalValues[field]) {
        hasChanges = true;
        break;
      }
    }

    hasChanges = hasChanges || !!this._pendingAvatarFile;

    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    if (!saveBtn) return;

    if (hasChanges) {
      saveBtn.classList.add("btn_accent");
      saveBtn.classList.remove("btn_outline");
      saveBtn.disabled = !!birthDateError;
    } else {
      saveBtn.classList.remove("btn_accent");
      saveBtn.classList.add("btn_outline");
      saveBtn.disabled = true;
    }
  }

  _setupButtonHandlers() {
    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    const changePwdBtn = this.el.querySelector(
      '[data-action="change-password"]',
    );

    if (saveBtn) {
      const onSaveClick = async (e) => {
        e.preventDefault();
        if (saveBtn.disabled) return;

        await this._saveProfile();
      };

      saveBtn.addEventListener("click", onSaveClick);
      this._buttonHandlers.set(saveBtn, onSaveClick);
    }

    if (changePwdBtn) {
      const onChangePasswordClick = async (e) => {
        e.preventDefault();
        if (!this._validateAllPasswordFields()) {
          this._updatePasswordButtonState();
          return;
        }
        await this._changePassword();
      };

      changePwdBtn.addEventListener("click", onChangePasswordClick);
      this._buttonHandlers.set(changePwdBtn, onChangePasswordClick);
    }
  }

  _getUpdatedData() {
    const birthdateInput = this.el.querySelector("#birthDate");
    const birthdate = normalizeDateInputValue(birthdateInput?.value);

    return {
      birthdate: birthdate || null,
    };
  }

  async _saveProfile() {
    const birthDateError = this._validateBirthDate();
    if (birthDateError) {
      return;
    }

    this._setProfileSaveError("");
    const updated = this._getUpdatedData();
    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    if (saveBtn) saveBtn.disabled = true;

    const profileResult = await userService.updateProfile(
      updated.birthdate,
      this._pendingAvatarFile,
    );
    if (!profileResult.ok) {
      this._setProfileSaveError(
        getApiErrorMessage(profileResult, {
          fallback: "Не удалось сохранить профиль. Попробуйте позже.",
        }),
      );
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    const normalizedProfile = extractProfile(profileResult.resp) || {};
    const currentUser = authStore.getState().user || {};
    const nextProfile = {
      ...currentUser,
      ...normalizedProfile,
      birthdate: updated.birthdate,
    };

    this._renderAvatar(nextProfile.avatar_url);

    this._pendingAvatarFile = null;
    const avatarInput = this.el.querySelector("#avatarInput");
    if (avatarInput) avatarInput.value = "";
    this._setAvatarError("");
    this._setProfileSaveError("");

    authStore.updateUserProfile(nextProfile);

    this._originalValues.birthdate = normalizeDateInputValue(nextProfile.birthdate);
    this.context.userData.birthDate = normalizeDateInputValue(nextProfile.birthdate);

    if (nextProfile.avatar_url !== undefined) {
      this.context.userData.avatarUrl = resolveAvatarUrl(
        nextProfile.avatar_url,
      );
    }

    // Обновляем оригинальные значения для отслеживания изменений
    Object.entries(updated).forEach(([field, value]) => {
      this._originalValues[field] = value;
    });

    if (saveBtn) {
      saveBtn.classList.remove("btn_accent");
      saveBtn.classList.add("btn_outline");
      saveBtn.disabled = true;
    }

    this._checkForChanges();
  }

  async _changePassword() {
    const old = this.el.querySelector("#oldPassword")?.value;
    const newP = this.el.querySelector("#newPassword")?.value;
    const conf = this.el.querySelector("#confirmPassword")?.value;

    if (newP !== conf) {
      return;
    }

    const changeResult = await userService.changePassword({
      old_password: old,
      new_password: newP,
    });

    if (!changeResult.ok) {
      this._setPasswordSuccess("");
      setError(
        this.el.querySelector("#oldPassword"),
        this.el.querySelector("#old-password-error"),
        getApiErrorMessage(changeResult, {
          context: "change-password",
          fallback: "Не удалось сменить пароль.",
        }),
      );
      return;
    }

    const inputs = this.el.querySelectorAll(".settings__input_password_field");
    inputs.forEach((input) => (input.value = ""));

    const fields = this._getPasswordFields();
    fields.forEach(({ input, errorEl }) => setError(input, errorEl, ""));
    this._setPasswordSuccess("Пароль успешно обновлен");

    const btn = this.el.querySelector('[data-action="change-password"]');
    if (btn) {
      btn.classList.remove("btn_accent");
      btn.classList.add("btn_outline");
      btn.disabled = true;
    }
  }

  _validateAllPasswordFields() {
    return this._getPasswordFields().every(
      ({ id }) => !this._validatePasswordField(id),
    );
  }

  _setupBuyCoinsModal() {
    const buyModal = this.el.querySelector("#buyCoinsModal");
    const resultModal = this.el.querySelector("#buyCoinsResultModal");
    const openBtn = this.el.querySelector('[data-action="open-buy-coins-modal"]');
    const confirmBtn = this.el.querySelector('[data-action="confirm-buy-coins"]');

    const onOpen = (event) => {
      event.preventDefault();
      this._openBuyCoinsModal();
    };

    const onConfirm = async (event) => {
      event.preventDefault();
      await this._confirmBuyCoins();
    };

    if (openBtn) {
      openBtn.addEventListener("click", onOpen);
      this._buyCoinsModalHandlers.push({ target: openBtn, type: "click", handler: onOpen });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", onConfirm);
      this._buyCoinsModalHandlers.push({
        target: confirmBtn,
        type: "click",
        handler: onConfirm,
      });
    }

    if (buyModal) {
      buyModal.querySelectorAll('[data-role="coins-pack-option"]').forEach((option) => {
        const radio = option.querySelector('input[type="radio"]');
        const syncActive = () => {
          buyModal.querySelectorAll('[data-role="coins-pack-option"]').forEach((el) => {
            el.classList.toggle(
              "payment-method_active",
              el.querySelector('input[type="radio"]')?.checked === true,
            );
          });
        };
        if (radio) {
          radio.addEventListener("change", syncActive);
          this._buyCoinsModalHandlers.push({
            target: radio,
            type: "change",
            handler: syncActive,
          });
        }
        syncActive();
      });
    }

    [buyModal, resultModal].forEach((modal) => {
      if (!modal) return;

      modal.querySelectorAll('[data-action="close-buy-coins-modal"], [data-action="close-buy-coins-result"]').forEach((btn) => {
        const handler = () => this._closeDialog(modal);
        btn.addEventListener("click", handler);
        this._buyCoinsModalHandlers.push({ target: btn, type: "click", handler });
      });

      const onBackdrop = (event) => {
        if (event.target === modal) {
          this._closeDialog(modal);
        }
      };
      modal.addEventListener("click", onBackdrop);
      this._buyCoinsModalHandlers.push({ target: modal, type: "click", handler: onBackdrop });

      const onClose = () => this._syncModalScrollLock();
      modal.addEventListener("close", onClose);
      this._buyCoinsModalHandlers.push({ target: modal, type: "close", handler: onClose });
    });
  }

  _openBuyCoinsModal() {
    const modal = this.el.querySelector("#buyCoinsModal");
    if (!modal) return;

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
  }

  _closeDialog(modal) {
    if (!modal) return;

    if (modal.id === "buyCoinsResultModal") {
      this._abortPaymentPoll();
      this._cleanPaymentReturnUrl();
    }

    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }

    this._syncModalScrollLock();
  }

  _lockBodyScroll() {
    if (this._bodyLockSnapshot) return;
    this._bodyLockSnapshot = { overflow: document.body.style.overflow };
    document.body.style.overflow = "hidden";
  }

  _restoreBodyScroll() {
    if (!this._bodyLockSnapshot) return;
    document.body.style.overflow = this._bodyLockSnapshot.overflow;
    this._bodyLockSnapshot = null;
  }

  _releaseBodyScrollLock() {
    if (this._bodyLockSnapshot) {
      document.body.style.overflow = this._bodyLockSnapshot.overflow || "";
      this._bodyLockSnapshot = null;
      return;
    }
    if (document.body.style.overflow === "hidden") {
      document.body.style.overflow = "";
    }
  }

  _syncModalScrollLock() {
    const hasOpenModal = Boolean(
      this.el?.querySelector("#buyCoinsModal[open], #buyCoinsResultModal[open]"),
    );
    if (!hasOpenModal) {
      this._restoreBodyScroll();
    }
  }

  _getSelectedCoinsPackId() {
    const selected = this.el.querySelector('input[name="coins-pack"]:checked');
    return Number(selected?.value);
  }

  async _confirmBuyCoins() {
    const packId = this._getSelectedCoinsPackId();
    const confirmBtn = this.el.querySelector("#confirmBuyCoinsBtn");

    if (!Number.isFinite(packId) || packId <= 0) {
      return;
    }

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = "Создаём платёж…";
    }

    const paymentResult = await paymentService.createCoinsPayment(packId);

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Перейти к оплате";
    }

    if (!paymentResult.ok) {
      window.alert(
        getApiErrorMessage(paymentResult, {
          fallback: "Не удалось создать платёж. Попробуйте позже.",
        }),
      );
      return;
    }

    const paymentId = paymentResult.resp?.payment_id;
    const confirmationUrl = paymentResult.resp?.confirmation_url;

    if (paymentId) {
      sessionStorage.setItem(PENDING_PAYMENT_KEY, String(paymentId));
      sessionStorage.setItem(PENDING_PAYMENT_CONTEXT_KEY, PAYMENT_CONTEXT_COINS);
    }

    if (confirmationUrl) {
      this._closeDialog(this.el.querySelector("#buyCoinsModal"));
      window.location.href = confirmationUrl;
      return;
    }

    window.alert("Не получена ссылка на оплату.");
  }

  _abortPaymentPoll() {
    this._paymentPollController?.abort();
    this._paymentPollController = null;
  }

  _cleanPaymentReturnUrl() {
    const onReturnPath = window.location.pathname.endsWith("/payments/return");
    const hasPaymentQuery = /payment|orderId/i.test(window.location.search);

    if (onReturnPath || hasPaymentQuery) {
      const url = new URL(window.location.href);
      url.pathname = "/settings";
      url.searchParams.delete("payment_id");
      url.searchParams.delete("paymentId");
      url.searchParams.delete("orderId");
      window.history.replaceState(
        null,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }

  async _handlePaymentReturn() {
    if (this._paymentReturnHandled) {
      return;
    }

    const paymentContext = sessionStorage.getItem(PENDING_PAYMENT_CONTEXT_KEY);
    const onReturnPath = window.location.pathname.endsWith("/payments/return");
    const params = new URLSearchParams(window.location.search);
    const hasUrlPaymentId = Boolean(
      params.get("payment_id") || params.get("paymentId") || params.get("orderId"),
    );
    const paymentId = resolvePaymentId();

    if (!paymentId) {
      if (onReturnPath && paymentContext === PAYMENT_CONTEXT_COINS) {
        this._paymentReturnHandled = true;
        this._openBuyCoinsResultModal();
        this._setBuyCoinsResultView({
          kind: "error",
          message: "Не найден идентификатор платежа.",
        });
      }
      return;
    }

    if (onReturnPath && paymentContext && paymentContext !== PAYMENT_CONTEXT_COINS) {
      router.go(`/subscription${window.location.search}`);
      return;
    }

    if (!onReturnPath && paymentContext !== PAYMENT_CONTEXT_COINS) {
      return;
    }

    if (!onReturnPath && !hasUrlPaymentId) {
      return;
    }

    this._paymentReturnHandled = true;
    await this._runCoinsPaymentPoll(paymentId);
  }

  _openBuyCoinsResultModal() {
    const modal = this.el.querySelector("#buyCoinsResultModal");
    if (!modal) return;

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
  }

  _setBuyCoinsResultView(result) {
    const modal = this.el.querySelector("#buyCoinsResultModal");
    if (!modal) return;

    const spinner = modal.querySelector('[data-role="buy-coins-result-spinner"]');
    const titleEl = modal.querySelector('[data-role="buy-coins-result-title"]');
    const textEl = modal.querySelector('[data-role="buy-coins-result-text"]');
    const metaEl = modal.querySelector('[data-role="buy-coins-result-meta"]');
    const actionsEl = modal.querySelector('[data-role="buy-coins-result-actions"]');

    spinner.hidden = result.kind !== "loading";
    metaEl.hidden = true;
    metaEl.textContent = "";

    let actionsHtml = "";

    switch (result.kind) {
      case "loading":
        titleEl.textContent = "Обрабатываем оплату…";
        textEl.textContent = "Пожалуйста, подождите. Мы проверяем статус платежа.";
        break;
      case "success": {
        titleEl.textContent = "VKino coins зачислены";
        const balance = extractCoinsBalanceFromProfile(authStore.getState().user);
        textEl.textContent = "Баланс обновлён.";
        if (balance !== null) {
          metaEl.innerHTML = `<span class="modal_payment-result__balance-line">Текущий баланс: <img class="modal_payment-result__balance-icon" src="${VKINO_COIN_ICON_SRC}" alt="" width="16" height="16" /><strong>${balance}</strong></span>`;
          metaEl.hidden = false;
        }
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-buy-coins-result">Отлично</button>';
        break;
      }
      case "canceled":
        titleEl.textContent = "Оплата отменена";
        textEl.textContent = "Платёж не был завершён. Вы можете попробовать снова.";
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-buy-coins-result">Понятно</button>';
        break;
      case "incomplete":
        titleEl.textContent = "Оплата не завершена";
        textEl.textContent =
          "Если вы отменили оплату на стороне ЮKassa, попробуйте снова. Если оплата прошла, баланс обновится в течение минуты.";
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-buy-coins-result">Понятно</button>';
        break;
      case "timeout":
        titleEl.textContent = "Статус уточняется";
        textEl.textContent = "Если оплата прошла, обновите страницу настроек.";
        actionsHtml =
          '<button type="button" class="btn btn_outline" data-action="retry-coins-payment-check">Проверить снова</button>';
        break;
      case "error":
        titleEl.textContent = "Не удалось проверить оплату";
        textEl.textContent = result.message || "Попробуйте позже.";
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-buy-coins-result">Понятно</button>';
        break;
      default:
        return;
    }

    actionsEl.innerHTML = actionsHtml;
    actionsEl.className =
      "modal__footer modal_payment-result__footer" +
      (result.kind === "timeout"
        ? ""
        : " modal_payment-result__footer--center");

    actionsEl.querySelectorAll("[data-action]").forEach((btn) => {
      const handler = async (event) => {
        event.preventDefault();
        const { action } = btn.dataset;

        if (action === "close-buy-coins-result") {
          this._closeDialog(modal);
          return;
        }

        if (action === "retry-coins-payment-check") {
          const retryId = resolvePaymentId();
          if (retryId) {
            await this._runCoinsPaymentPoll(retryId);
          }
        }
      };

      btn.addEventListener("click", handler);
      this._buyCoinsModalHandlers.push({ target: btn, type: "click", handler });
    });
  }

  async _runCoinsPaymentPoll(paymentId) {
    this._abortPaymentPoll();
    this._paymentPollController = new AbortController();

    this._openBuyCoinsResultModal();
    this._setBuyCoinsResultView({ kind: "loading" });

    const result = await pollPaymentStatus(paymentId, {
      signal: this._paymentPollController.signal,
    });

    if (result.kind === "aborted") {
      this._releaseBodyScrollLock();
      return;
    }

    if (result.kind === "unauthorized") {
      this._releaseBodyScrollLock();
      router.go("/sign-in");
      return;
    }

    if (result.kind === "success") {
      this._coinsPaymentResultToShow = { kind: "success" };
      await this.loadCoinsContext({ afterPayment: true });
      return;
    }

    this._setBuyCoinsResultView(result);
  }

  removeEventListeners() {
    if (this._authUnsubscribe) {
      this._authUnsubscribe();
      this._authUnsubscribe = null;
    }

    this._abortPaymentPoll();
    this._releaseBodyScrollLock();

    for (const { target, type, handler } of this._buyCoinsModalHandlers) {
      target.removeEventListener(type, handler);
    }
    this._buyCoinsModalHandlers = [];

    for (const [input, handler] of this._editableInputHandlers) {
      input.removeEventListener("input", handler);
      input.removeEventListener("blur", handler);
    }
    this._editableInputHandlers.clear();
    this._destroyBirthdateCalendar();

    for (const [input, handler] of this._passwordInputHandlers) {
      input.removeEventListener("input", handler);
      input.removeEventListener("blur", handler);
    }
    this._passwordInputHandlers.clear();

    if (this._avatarInputHandler) {
      const avatarInput = this.el.querySelector("#avatarInput");
      if (avatarInput)
        avatarInput.removeEventListener("change", this._avatarInputHandler);
      this._avatarInputHandler = null;
    }

    if (this._destroyPasswordToggle) {
      this._destroyPasswordToggle();
      this._destroyPasswordToggle = null;
    }

    if (this._destroyCoinsInfoPopover) {
      this._destroyCoinsInfoPopover();
      this._destroyCoinsInfoPopover = null;
    }

    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    const changePwdBtn = this.el.querySelector(
      '[data-action="change-password"]',
    );

    if (saveBtn)
      saveBtn.removeEventListener("click", this._buttonHandlers.get(saveBtn));
    if (changePwdBtn)
      changePwdBtn.removeEventListener(
        "click",
        this._buttonHandlers.get(changePwdBtn),
      );
  }

  beforeDestroy() {
    if (this._detachStyles) {
      this._detachStyles();
      this._detachStyles = null;
    }
  }

  setupChildren() {
    const header = this.el.querySelector("#header");
    if (!header) {
      throw new Error("Settings: не найден header в шаблоне Settings.hbs");
    }

    this.addChild(
      "header",
      new HeaderComponent(
        {
          isAuthorized: true,
          userName: this.context.userData.email,
        },
        this,
        header,
      ),
    );
  }
}

function normalizeDateInputValue(value) {
  const normalized = String(value || "").trim();

  if (!normalized) {
    return "";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoMatch?.[1]) {
    return isoMatch[1];
  }

  const ruMatch = normalized.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (ruMatch) {
    const [, day, month, year] = ruMatch;
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(normalized);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const year = parsedDate.getFullYear();
  if (!Number.isInteger(year) || year < 1000 || year > 9999) {
    return "";
  }
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const day = String(parsedDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseStrictDateInputValue(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const [, yearString, monthString, dayString] = match;
  const year = Number(yearString);
  const month = Number(monthString);
  const day = Number(dayString);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1000 ||
    year > 9999
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function getTodayDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getMondayBasedWeekday(date) {
  return (date.getDay() + 6) % 7;
}

function formatDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatBirthdateDisplayValue(value) {
  const date = parseStrictDateInputValue(value);

  if (!date) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = BIRTHDATE_MONTH_NAMES_GENITIVE[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

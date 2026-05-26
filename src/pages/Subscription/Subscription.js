import BasePage from "../BasePage.js";
import "./Subscription.precompiled.js";
import "@/css/subscription.scss";

import HeaderComponent from "@/components/Header/Header.js";
import {
  paymentService,
  PENDING_PAYMENT_KEY,
  PAYMENT_METHOD,
} from "@/js/PaymentService.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import {
  pollPaymentStatus,
  resolvePaymentId,
} from "@/js/paymentStatusPoll.js";
import {
  getTariffsLoadingPlans,
  normalizeSubscriptionFromApi,
} from "@/utils/subscriptionDisplay.js";
import { SUBSCRIPTION_FAQ_ITEMS } from "./subscriptionFaq.js";
import { VKINO_COIN_ICON_SRC } from "@/utils/coinsDisplay.js";

export default class SubscriptionPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("SubscriptionPage: не передан корневой элемент");
    }

    super(
      {
        isLoading: true,
        errorMessage: "",
        successMessage: "",
        currentUserSubscription: null,
        subscriptionTier: 0,
        plans: [],
        subscriptionFaq: SUBSCRIPTION_FAQ_ITEMS,
        coinsIconSrc: VKINO_COIN_ICON_SRC,
        ...context,
      },
      Handlebars.templates["Subscription.hbs"],
      parent,
      el,
      "SubscriptionPage",
    );

    this._selectedPlan = null;
    this._selectedPaymentMethod = PAYMENT_METHOD.YOOKASSA;
    this._subscriptionHydrated = false;
    this._authUnsubscribe = null;
    this._buttonHandlers = new Map();
    this._modalHandlers = new Map();
    this._modalCloseHandlers = new Map();
    this._bodyLockSnapshot = null;
    this._paymentPollController = null;
    this._paymentReturnHandled = false;
    this._paymentResultToShow = null;
  }

  init() {
    const state = authStore.getState();

    if (state.status === "loading") {
      this._authUnsubscribe = authStore.subscribe((nextState) => {
        if (nextState.status === "loading") return;
        if (!nextState.user) {
          router.go("/sign-in");
          return;
        }
        this._authUnsubscribe?.();
        this._authUnsubscribe = null;
        void this.loadContext();
      });
      return super.init();
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    super.init();
    if (!this._subscriptionHydrated) {
      void this.loadContext();
    }
    return this;
  }

  async loadContext() {
    const [plansResult, subscriptionResult] = await Promise.all([
      userService.getSubscriptionPlans(),
      userService.getCurrentUserSubscription(),
    ]);

    let plans = plansResult.ok ? plansResult.resp?.plans || [] : [];
    const tariffsUnavailable = !plansResult.ok;

    if (plans.length === 0) {
      plans = getTariffsLoadingPlans();
    }

    const rawSubscription = subscriptionResult.ok
      ? subscriptionResult.resp?.subscription
      : null;
    const currentSubscription = normalizeSubscriptionFromApi(rawSubscription);

    this._applyPlanUiFlags(plans, currentSubscription);

    let errorMessage = "";
    if (tariffsUnavailable) {
      errorMessage = getApiErrorMessage(plansResult, {
        fallback: "Не удалось загрузить тарифы. Оплата временно недоступна.",
      });
    }

    this._subscriptionHydrated = true;
    this.refresh({
      ...this.context,
      isLoading: false,
      plans,
      subscriptionFaq: SUBSCRIPTION_FAQ_ITEMS,
      currentUserSubscription: currentSubscription,
      subscriptionTier: currentSubscription?.tier ?? 0,
      errorMessage,
    });

    if (this._paymentResultToShow) {
      this._openPaymentResultModal();
      this._setPaymentResultView(this._paymentResultToShow);
      this._paymentResultToShow = null;
      return;
    }

    void this._handlePaymentReturn();
  }

  _applyPlanUiFlags(plans, currentSubscription) {
    const userTier = currentSubscription?.tier ?? 0;
    plans.forEach((plan) => {
      plan.isCurrent =
        Boolean(currentSubscription && plan.id === currentSubscription.planId) ||
        (!currentSubscription && plan.tier === 0);
      plan.isLowerTierThanUser = Boolean(currentSubscription && plan.tier < userTier);
      plan.isSameTierAsUser = plan.tier === userTier && !plan.isCurrent;
      plan.canUpgrade = Boolean(currentSubscription && plan.tier > userTier);
    });
  }

  addEventListeners() {
    this.el.querySelectorAll('[data-action="select-plan"]').forEach((btn) => {
      const handler = (e) => this._onSelectPlan(e);
      btn.addEventListener("click", handler);
      this._buttonHandlers.set(btn, handler);
    });

    this.el.querySelectorAll(
      '[data-action="dismiss-error"], [data-action="dismiss-success"]',
    ).forEach((btn) => {
      const handler = (e) => {
        e.currentTarget.closest(".subscription-banner")?.remove();
      };
      btn.addEventListener("click", handler);
      this._buttonHandlers.set(btn, handler);
    });

    this._setupModalHandlers();
  }

  _setupModalHandlers() {
    const paymentModal = this.el.querySelector("#paymentModal");
    const downgradeModal = this.el.querySelector("#downgradeModal");
    const resultModal = this.el.querySelector("#paymentResultModal");
    const modals = [paymentModal, downgradeModal, resultModal];

    modals.forEach((modal) => {
      if (!modal) return;

      modal.querySelectorAll('[data-action="close-modal"]').forEach((closeBtn) => {
        const handler = () => this._closeModal(modal);
        closeBtn.addEventListener("click", handler);
        this._modalHandlers.set(closeBtn, handler);
      });

      const clickHandler = (e) => {
        if (e.target === modal) {
          this._closeModal(modal);
          return;
        }

        if (modal === paymentModal) {
          const methodOption = e.target.closest("[data-payment-method]");
          if (
            methodOption &&
            !methodOption.hidden &&
            !methodOption.classList.contains("payment-method_disabled")
          ) {
            const method = methodOption.dataset.paymentMethod;
            const radio = methodOption.querySelector('input[type="radio"]');
            if (method && radio && !radio.disabled) {
              radio.checked = true;
              this._setPaymentMethod(method);
            }
          }
          return;
        }

        if (modal !== resultModal) return;

        const actionBtn = e.target.closest("[data-action]");
        if (!actionBtn) return;

        const action = actionBtn.dataset.action;
        if (action === "retry-payment-check") {
          void this._retryPaymentCheck();
        } else if (action === "go-profile") {
          this._closeModal(resultModal);
          router.go("/profile");
        } else if (action === "close-payment-result") {
          this._closeModal(resultModal);
        }
      };
      modal.addEventListener("click", clickHandler);
      this._modalHandlers.set(modal, clickHandler);

      const closeHandler = () => {
        if (modal === paymentModal) {
          this._selectedPlan = null;
        }
        this._syncModalScrollLock();
      };
      modal.addEventListener("close", closeHandler);
      this._modalCloseHandlers.set(modal, closeHandler);
    });

    const cancelPaymentBtn = paymentModal?.querySelector(
      '[data-action="cancel-payment"]',
    );
    if (cancelPaymentBtn) {
      const handler = () => this._closeModal(paymentModal);
      cancelPaymentBtn.addEventListener("click", handler);
      this._modalHandlers.set(cancelPaymentBtn, handler);
    }

    const confirmPaymentBtn = paymentModal?.querySelector(
      '[data-action="confirm-payment"]',
    );
    if (confirmPaymentBtn) {
      const handler = () => this._confirmPayment();
      confirmPaymentBtn.addEventListener("click", handler);
      this._modalHandlers.set(confirmPaymentBtn, handler);
    }
  }

  _onSelectPlan(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;

    const plan = this.context.plans.find((p) => p.id === btn.dataset.planId);
    if (!plan || plan.isLoadingStub || !plan.productRefId) return;

    if (plan.isLowerTierThanUser) {
      this._openDowngradeModal(plan);
      return;
    }

    if (plan.requiresPayment) {
      this._openPaymentModal(plan);
    }
  }

  _openPaymentModal(plan) {
    if (plan.isLoadingStub || !plan.productRefId) return;

    const modal = this.el.querySelector("#paymentModal");
    if (!modal) return;

    this._selectedPlan = plan;

    modal.querySelector('[data-role="modal-plan-name"]').textContent = plan.name;
    this._configurePaymentModal(plan);

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
  }

  _setPaymentMethod(method) {
    this._selectedPaymentMethod =
      method === PAYMENT_METHOD.VKINO_COINS
        ? PAYMENT_METHOD.VKINO_COINS
        : PAYMENT_METHOD.YOOKASSA;
    this._updatePaymentModalUi();
  }

  _configurePaymentModal(plan) {
    const modal = this.el.querySelector("#paymentModal");
    if (!modal) return;

    this._selectedPaymentMethod = PAYMENT_METHOD.YOOKASSA;

    const canPayWithCoins = Boolean(
      plan.isCoinsPaymentAvailable && plan.priceCoins > 0,
    );
    const coinsOption = modal.querySelector('[data-payment-method="vkino_coins"]');
    const coinsHint = modal.querySelector('[data-role="modal-coins-hint"]');
    const balanceWrap = modal.querySelector('[data-role="modal-coins-balance-wrap"]');
    const balanceEl = modal.querySelector('[data-role="modal-coins-balance"]');
    const coinsRadio = coinsOption?.querySelector('input[type="radio"]');
    const yookassaRadio = modal.querySelector(
      '[data-payment-method="yookassa"] input',
    );

    if (yookassaRadio) {
      yookassaRadio.checked = true;
    }

    if (coinsOption) {
      coinsOption.hidden = !canPayWithCoins;

      if (canPayWithCoins) {
        if (coinsHint) {
          coinsHint.textContent = `${plan.priceCoins} VKino coins`;
        }

        const balance = authStore.getState().user?.coinsBalance ?? 0;
        if (balanceEl) {
          balanceEl.textContent = String(balance);
        }
        if (balanceWrap) {
          balanceWrap.hidden = false;
        }

        const insufficient = balance < plan.priceCoins;
        coinsOption.classList.toggle("payment-method_disabled", insufficient);
        if (coinsRadio) {
          coinsRadio.disabled = insufficient;
        }
      } else if (balanceWrap) {
        balanceWrap.hidden = true;
      }
    }

    const priceEl = modal.querySelector('[data-role="modal-plan-price"]');
    if (priceEl) {
      if (canPayWithCoins && plan.price) {
        priceEl.innerHTML = `<span class="modal_payment__plan-price-money">${plan.price}</span><span class="modal_payment__plan-price-alt">или ${plan.priceCoins} VKino coins</span>`;
      } else {
        priceEl.textContent = String(plan.price || "");
      }
    }

    this._updatePaymentModalUi();
    this._resetConfirmPaymentButton();
  }

  _updatePaymentModalUi() {
    const modal = this.el.querySelector("#paymentModal");
    if (!modal) return;

    const isCoins = this._selectedPaymentMethod === PAYMENT_METHOD.VKINO_COINS;

    modal.querySelectorAll("[data-payment-method]").forEach((option) => {
      option.classList.toggle(
        "payment-method_active",
        option.dataset.paymentMethod === this._selectedPaymentMethod,
      );
    });

    const subtitle = modal.querySelector('[data-role="modal-payment-subtitle"]');
    if (subtitle) {
      subtitle.textContent = isCoins
        ? "Coins спишутся с баланса сразу после подтверждения."
        : "Вы будете перенаправлены на защищённую страницу оплаты ЮKassa.";
    }

    const confirmBtn = modal.querySelector("#confirmPaymentBtn");
    if (confirmBtn && !confirmBtn.disabled) {
      confirmBtn.textContent = isCoins ? "Оплатить coins" : "Перейти к оплате";
    }
  }

  _resetConfirmPaymentButton() {
    const btn = this.el.querySelector("#confirmPaymentBtn");
    if (!btn) return;

    btn.disabled = false;
    this._updatePaymentModalUi();
  }

  _openDowngradeModal(plan) {
    const modal = this.el.querySelector("#downgradeModal");
    const sub = this.context.currentUserSubscription;
    if (!modal || !sub) return;

    modal.querySelector('[data-role="downgrade-plan-name"]').textContent =
      plan.name;
    modal.querySelector('[data-role="downgrade-start-date"]').textContent =
      sub.renewsAt || "конца текущего периода";

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
  }

  _closeModal(modal) {
    if (!modal) return;

    const isResultModal = modal.id === "paymentResultModal";

    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }

    if (modal.id === "paymentModal") {
      this._selectedPlan = null;
    }

    if (isResultModal) {
      this._abortPaymentPoll();
      this._cleanPaymentReturnUrl();
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

  _syncModalScrollLock() {
    const hasOpenModal = Boolean(
      this.el?.querySelector(
        "#paymentModal[open], #downgradeModal[open], #paymentResultModal[open]",
      ),
    );
    if (!hasOpenModal) {
      this._restoreBodyScroll();
    }
  }

  _abortPaymentPoll() {
    this._paymentPollController?.abort();
    this._paymentPollController = null;
  }

  _cleanPaymentReturnUrl() {
    const onReturnPath = window.location.pathname.endsWith("/payments/return");
    const hasPaymentQuery = /payment|orderId/i.test(window.location.search);

    if (onReturnPath || hasPaymentQuery) {
      window.history.replaceState(null, "", "/subscription");
    }
  }

  _openPaymentResultModal() {
    const modal = this.el.querySelector("#paymentResultModal");
    if (!modal) return;

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
  }

  _setPaymentResultView(result) {
    const modal = this.el.querySelector("#paymentResultModal");
    if (!modal) return;

    const spinner = modal.querySelector('[data-role="result-spinner"]');
    const titleEl = modal.querySelector('[data-role="result-title"]');
    const textEl = modal.querySelector('[data-role="result-text"]');
    const metaEl = modal.querySelector('[data-role="result-meta"]');
    const actionsEl = modal.querySelector('[data-role="result-actions"]');

    spinner.hidden = result.kind !== "loading";
    metaEl.hidden = true;
    metaEl.textContent = "";

    let actionsHtml = "";

    switch (result.kind) {
      case "loading":
        titleEl.textContent = "Обрабатываем оплату…";
        textEl.textContent =
          "Пожалуйста, подождите. Мы проверяем статус платежа.";
        break;
      case "success":
        titleEl.textContent = "Подписка активирована";
        textEl.textContent = result.subscriptionLabel
          ? `Тариф «${result.subscriptionLabel}» успешно подключён.`
          : "Подписка успешно подключена.";
        if (result.renewsAt) {
          metaEl.textContent = `Активна до ${result.renewsAt}`;
          metaEl.hidden = false;
        }
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-payment-result">Понятно</button>';
        break;
      case "canceled":
        titleEl.textContent = "Оплата отменена";
        textEl.textContent =
          "Платёж не был завершён. Вы можете попробовать снова.";
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-payment-result">Понятно</button>';
        break;
      case "incomplete":
        titleEl.textContent = "Оплата не завершена";
        textEl.textContent =
          "Если вы отменили оплату на стороне ЮKassa, попробуйте снова. Если оплата прошла, проверьте подписку в профиле.";
        actionsHtml = `
          <button type="button" class="btn btn_accent" data-action="close-payment-result">Понятно</button>
          <button type="button" class="btn btn_outline" data-action="go-profile">В профиль</button>
        `;
        break;
      case "timeout":
        titleEl.textContent = "Статус уточняется";
        textEl.textContent =
          "Если оплата прошла, обновите страницу или проверьте подписку в профиле.";
        actionsHtml = `
          <button type="button" class="btn btn_outline" data-action="retry-payment-check">Проверить снова</button>
          <button type="button" class="btn btn_accent" data-action="go-profile">В профиль</button>
        `;
        break;
      case "error":
        titleEl.textContent = "Не удалось проверить оплату";
        textEl.textContent =
          result.message ||
          "Попробуйте позже или вернитесь на страницу подписки.";
        actionsHtml =
          '<button type="button" class="btn btn_accent" data-action="close-payment-result">Понятно</button>';
        break;
      default:
        return;
    }

    actionsEl.innerHTML = actionsHtml;
  }

  async _runPaymentStatusPoll(paymentId) {
    this._abortPaymentPoll();
    this._paymentPollController = new AbortController();

    this._openPaymentResultModal();
    this._setPaymentResultView({ kind: "loading" });

    const result = await pollPaymentStatus(paymentId, {
      signal: this._paymentPollController.signal,
    });

    if (result.kind === "aborted") {
      return;
    }

    if (result.kind === "unauthorized") {
      router.go("/sign-in");
      return;
    }

    if (result.kind === "success") {
      this._paymentResultToShow = result;
      await this.loadContext();
      return;
    }

    this._setPaymentResultView(result);
  }

  async _handlePaymentReturn() {
    if (this._paymentReturnHandled) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const onReturnPath = window.location.pathname.endsWith("/payments/return");
    const hasUrlPaymentId = Boolean(
      params.get("payment_id") || params.get("paymentId") || params.get("orderId"),
    );
    const paymentId = resolvePaymentId();

    if (!paymentId) {
      if (onReturnPath) {
        this._paymentReturnHandled = true;
        this._openPaymentResultModal();
        this._setPaymentResultView({
          kind: "error",
          message: "Не найден идентификатор платежа.",
        });
      }
      return;
    }

    if (!onReturnPath && !hasUrlPaymentId) {
      return;
    }

    this._paymentReturnHandled = true;
    await this._runPaymentStatusPoll(paymentId);
  }

  async _retryPaymentCheck() {
    const paymentId = resolvePaymentId();
    if (!paymentId) {
      this._setPaymentResultView({
        kind: "error",
        message: "Не найден идентификатор платежа.",
      });
      return;
    }

    await this._runPaymentStatusPoll(paymentId);
  }

  async _confirmPayment() {
    if (
      !this._selectedPlan?.productRefId ||
      this._selectedPlan.isLoadingStub
    ) {
      return;
    }

    const selectedPlan = this._selectedPlan;
    const paymentMethod = this._selectedPaymentMethod;

    const btn = this.el.querySelector("#confirmPaymentBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent =
        paymentMethod === PAYMENT_METHOD.VKINO_COINS
          ? "Списание coins…"
          : "Перенаправление…";
    }

    const result = await paymentService.createSubscriptionPayment(
      selectedPlan.productRefId,
      paymentMethod,
    );

    if (result.ok) {
      await this._handlePaymentCreateResult(result);
      if (btn) {
        this._resetConfirmPaymentButton();
      }
      return;
    }

    this.refresh({
      ...this.context,
      errorMessage: getApiErrorMessage(result, {
        fallback: "Не удалось начать оплату. Попробуйте позже.",
      }),
    });

    if (btn) {
      this._resetConfirmPaymentButton();
    }
  }

  async _handlePaymentCreateResult(result) {
    const paymentId = result.resp?.payment_id;
    const status = String(result.resp?.status ?? "").toLowerCase();
    const confirmationUrl = result.resp?.confirmation_url;

    if (confirmationUrl && paymentId) {
      sessionStorage.setItem(PENDING_PAYMENT_KEY, String(paymentId));
      window.location.href = confirmationUrl;
      return;
    }

    if (!paymentId) {
      this.refresh({
        ...this.context,
        errorMessage: getApiErrorMessage(result, {
          fallback: "Не удалось начать оплату. Попробуйте позже.",
        }),
      });
      return;
    }

    this._closeModal(this.el.querySelector("#paymentModal"));

    if (status === "succeeded") {
      await authStore.refreshAfterPayment();
      await this.loadContext();
      this._openPaymentResultModal();
      const subscription = authStore.getState().user?.subscription;
      this._setPaymentResultView({
        kind: "success",
        subscriptionLabel: subscription?.label ?? "",
        renewsAt: subscription?.renewsAt ?? "",
      });
      return;
    }

    sessionStorage.setItem(PENDING_PAYMENT_KEY, String(paymentId));
    await this._runPaymentStatusPoll(paymentId);
  }

  _resetPlanButtons() {
    this.context.plans.forEach((plan) => {
      const btn = this.el
        .querySelector(`[data-plan-id="${plan.id}"]`)
        ?.querySelector('[data-action="select-plan"]');
      if (!btn) return;

      if (plan.isCurrent) {
        btn.textContent = "Ваш план";
        btn.disabled = true;
        btn.classList.remove("btn_accent");
        btn.classList.add("btn_outline");
        return;
      }

      if (plan.isLowerTierThanUser) {
        btn.textContent = "Входит в план";
        btn.disabled = true;
        btn.classList.remove("btn_accent");
        btn.classList.add("btn_outline");
        return;
      }

      if (plan.isLoadingStub) {
        btn.textContent = "Загрузка…";
        btn.disabled = true;
        btn.classList.remove("btn_accent");
        btn.classList.add("btn_outline");
        return;
      }

      btn.disabled = false;
      if (plan.requiresPayment) {
        btn.textContent = this.context.currentUserSubscription
          ? "Улучшить"
          : "Подключить";
        btn.classList.add("btn_accent");
        btn.classList.remove("btn_outline");
      }
    });
  }

  beforeDestroy() {
    this._abortPaymentPoll();
  }

  removeEventListeners() {
    this._authUnsubscribe?.();
    this._authUnsubscribe = null;

    for (const [el, handler] of this._buttonHandlers) {
      el.removeEventListener("click", handler);
    }
    this._buttonHandlers.clear();

    for (const [el, handler] of this._modalHandlers) {
      el.removeEventListener("click", handler);
    }
    this._modalHandlers.clear();

    for (const [el, handler] of this._modalCloseHandlers) {
      el.removeEventListener("close", handler);
    }
    this._modalCloseHandlers.clear();

    this._restoreBodyScroll();
  }

  setupChildren() {
    const header = this.el.querySelector("#header");
    if (!header) throw new Error("SubscriptionPage: не найден header");

    this.addChild("header", new HeaderComponent({}, this, header));
  }
}
import BasePage from "../BasePage.js";
import "./Subscription.precompiled.js";
import "@/css/subscription.scss";

import HeaderComponent from "@/components/Header/Header.js";
import {
  paymentService,
  PENDING_PAYMENT_KEY,
} from "@/js/PaymentService.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import {
  getDefaultPlans,
  normalizeSubscriptionFromApi,
} from "@/utils/subscriptionDisplay.js";
import { SUBSCRIPTION_FAQ_ITEMS } from "./subscriptionFaq.js";

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
        ...context,
      },
      Handlebars.templates["Subscription.hbs"],
      parent,
      el,
      "SubscriptionPage",
    );

    this._selectedPlan = null;
    this._subscriptionHydrated = false;
    this._authUnsubscribe = null;
    this._buttonHandlers = new Map();
    this._modalHandlers = new Map();
    this._modalCloseHandlers = new Map();
    this._bodyLockSnapshot = null;
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
    if (plans.length === 0) {
      plans = getDefaultPlans();
    }

    const rawSubscription = subscriptionResult.ok
      ? subscriptionResult.resp?.subscription
      : null;
    const currentSubscription = normalizeSubscriptionFromApi(rawSubscription);

    this._applyPlanUiFlags(plans, currentSubscription);

    let errorMessage = "";
    if (!plansResult.ok) {
      errorMessage = getApiErrorMessage(plansResult, {
        fallback: "Не удалось загрузить тарифы. Показаны базовые планы.",
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
  }

  _applyPlanUiFlags(plans, currentSubscription) {
    const userTier = currentSubscription?.tier ?? 0;
    plans.forEach((plan) => {
      plan.isCurrent =
        Boolean(currentSubscription && plan.id === currentSubscription.planId) ||
        (!currentSubscription && plan.tier === 0);
      plan.isLowerTierThanUser = plan.tier < userTier;
      plan.canUpgrade = !currentSubscription || plan.tier > userTier;
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
    const modals = [paymentModal, downgradeModal];

    modals.forEach((modal) => {
      if (!modal) return;

      modal.querySelectorAll('[data-action="close-modal"]').forEach((closeBtn) => {
        const handler = () => this._closeModal(modal);
        closeBtn.addEventListener("click", handler);
        this._modalHandlers.set(closeBtn, handler);
      });

      const backdropHandler = (e) => {
        if (e.target === modal) this._closeModal(modal);
      };
      modal.addEventListener("click", backdropHandler);
      this._modalHandlers.set(modal, backdropHandler);

      const closeHandler = () => {
        this._selectedPlan = null;
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
    if (!plan) return;

    if (plan.isLowerTierThanUser) {
      this._openDowngradeModal(plan);
      return;
    }

    if (plan.requiresPayment) {
      this._openPaymentModal(plan);
    }
  }

  _openPaymentModal(plan) {
    const modal = this.el.querySelector("#paymentModal");
    if (!modal) return;

    this._selectedPlan = plan;

    modal.querySelector('[data-role="modal-plan-name"]').textContent = plan.name;
    modal.querySelector('[data-role="modal-plan-price"]').textContent =
      plan.priceCoins != null
        ? `${plan.price || ""} или ${plan.priceCoins} coins`
        : String(plan.price || "");

    if (typeof modal.showModal === "function") {
      modal.showModal();
    } else {
      modal.setAttribute("open", "open");
    }
    this._lockBodyScroll();
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
    if (typeof modal.close === "function") {
      modal.close();
    } else {
      modal.removeAttribute("open");
    }
    this._selectedPlan = null;
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
      this.el?.querySelector("#paymentModal[open], #downgradeModal[open]"),
    );
    if (!hasOpenModal) {
      this._restoreBodyScroll();
    }
  }

  async _confirmPayment() {
    if (!this._selectedPlan?.productRefId) return;
    const selectedPlan = this._selectedPlan;

    const btn = this.el.querySelector("#confirmPaymentBtn");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Перенаправление...";
    }

    const result = await paymentService.createSubscriptionPayment(
      selectedPlan.productRefId,
    );

    if (result.ok && result.resp?.confirmation_url) {
      sessionStorage.setItem(
        PENDING_PAYMENT_KEY,
        String(result.resp.payment_id),
      );
      window.location.href = result.resp.confirmation_url;
      return;
    }

    this.refresh({
      ...this.context,
      errorMessage: getApiErrorMessage(result, {
        fallback: "Не удалось начать оплату. Попробуйте позже.",
      }),
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = "Перейти к оплате";
    }
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
        btn.textContent = "Выбрать";
        btn.disabled = false;
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

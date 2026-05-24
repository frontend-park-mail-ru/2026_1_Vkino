import BasePage from "../BasePage.js";
import "./PaymentReturn.precompiled.js";
import "@/css/subscription.scss";

import HeaderComponent from "@/components/Header/Header.js";
import {
  paymentService,
  PENDING_PAYMENT_KEY,
} from "@/js/PaymentService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 30;
const PENDING_GIVE_UP_ATTEMPTS = 6;

export default class PaymentReturnPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("PaymentReturnPage: не передан корневой элемент");
    }

    super(
      {
        isLoading: true,
        isSuccess: false,
        isCanceled: false,
        isTimeout: false,
        isIncomplete: false,
        errorMessage: "",
        subscriptionLabel: "",
        renewsAt: "",
        ...context,
      },
      Handlebars.templates["PaymentReturn.hbs"],
      parent,
      el,
      "PaymentReturnPage",
    );

    this._pollAborted = false;
    this._buttonHandlers = new Map();
    this._mountedOnce = false;
  }

  init() {
    const state = authStore.getState();
    const shouldStartPolling = !this._mountedOnce;

    if (state.status === "loading") {
      const unsub = authStore.subscribe((nextState) => {
        if (nextState.status === "loading") return;
        unsub();
        if (!nextState.user) {
          router.go("/sign-in");
          return;
        }
        void this._startPolling();
      });
      super.init();
      this._mountedOnce = true;
      return this;
    }

    if (!state.user) {
      router.go("/sign-in");
      return this;
    }

    super.init();
    this._mountedOnce = true;
    if (shouldStartPolling) {
      void this._startPolling();
    }
    return this;
  }

  _updateContext(newContext) {
    this.removeEventListeners();
    this.destroyChildren();
    this.context = { ...newContext };
    this.render();
    this.setupChildren();
    this.initChildren();
    this.addEventListeners();
    return this;
  }

  _resolvePaymentId() {
    const fromStorage = sessionStorage.getItem(PENDING_PAYMENT_KEY);
    if (fromStorage) {
      return fromStorage.trim();
    }

    const params = new URLSearchParams(window.location.search);
    return (
      params.get("payment_id") ||
      params.get("paymentId") ||
      params.get("orderId") ||
      ""
    ).trim();
  }

  async _startPolling() {
    this._pollAborted = false;
    const paymentId = this._resolvePaymentId();

    if (!paymentId) {
      this._updateContext({
        ...this.context,
        isLoading: false,
        errorMessage: "Не найден идентификатор платежа. Вернитесь на страницу подписки.",
      });
      return;
    }

    this._updateContext({
      ...this.context,
      isLoading: true,
      isSuccess: false,
      isCanceled: false,
      isTimeout: false,
      isIncomplete: false,
      errorMessage: "",
    });

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      if (this._pollAborted) return;

      const result = await paymentService.getPaymentStatus(paymentId);

      if (!result.ok) {
        if (result.status === 401) {
          router.go("/sign-in");
          return;
        }

        this._updateContext({
          ...this.context,
          isLoading: false,
          errorMessage: getApiErrorMessage(result, {
            fallback: "Не удалось проверить статус платежа.",
          }),
        });
        return;
      }

      const status = String(result.resp?.status ?? "").toLowerCase();

      if (status === "succeeded") {
        sessionStorage.removeItem(PENDING_PAYMENT_KEY);
        await authStore.refreshSubscription();

        const subscription = authStore.getState().user?.subscription;

        this._updateContext({
          ...this.context,
          isLoading: false,
          isSuccess: true,
          subscriptionLabel: subscription?.label ?? "",
          renewsAt: subscription?.renewsAt ?? "",
        });
        return;
      }

      if (status === "canceled") {
        sessionStorage.removeItem(PENDING_PAYMENT_KEY);
        this._updateContext({
          ...this.context,
          isLoading: false,
          isCanceled: true,
        });
        return;
      }

      if (status === "pending" && attempt + 1 >= PENDING_GIVE_UP_ATTEMPTS) {
        sessionStorage.removeItem(PENDING_PAYMENT_KEY);
        this._updateContext({
          ...this.context,
          isLoading: false,
          isIncomplete: true,
        });
        return;
      }

      await this._sleep(POLL_INTERVAL_MS);
    }

    this._updateContext({
      ...this.context,
      isLoading: false,
      isTimeout: true,
    });
  }

  _sleep(ms) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  addEventListeners() {
    const retryBtn = this.el.querySelector('[data-action="retry-check"]');
    if (retryBtn) {
      const handler = () => void this._startPolling();
      retryBtn.addEventListener("click", handler);
      this._buttonHandlers.set(retryBtn, handler);
    }
  }

  removeEventListeners() {
    for (const [el, handler] of this._buttonHandlers) {
      el.removeEventListener("click", handler);
    }
    this._buttonHandlers.clear();
  }

  beforeDestroy() {
    this._pollAborted = true;
  }

  setupChildren() {
    const header = this.el.querySelector("#header");
    if (!header) throw new Error("PaymentReturnPage: не найден header");

    this.addChild("header", new HeaderComponent({}, this, header));
  }
}

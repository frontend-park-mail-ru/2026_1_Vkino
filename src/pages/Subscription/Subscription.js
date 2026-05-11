import BasePage from "../BasePage.js";
import "./Subscription.precompiled.js";
import "@/css/subscription.scss";

import HeaderComponent from "@/components/Header/Header.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";
import { normalizeSubscriptionFromApi } from "@/utils/subscriptionDisplay.js";
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
        currentUserCard: null,
        hasYooMoney: false,
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
    /** После первой успешной загрузки не дергаем loadContext из повторного init после refresh. */
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
    const [plansResult, subscriptionResult, paymentMethodsResult] = await Promise.all([
      userService.getSubscriptionPlans(),
      userService.getCurrentUserSubscription(),
      userService.getPaymentMethods(),
    ]);

    const normalizedPlans = plansResult.ok
      ? this._normalizePlans(plansResult.resp?.plans || [])
      : [];
    const plans =
      normalizedPlans.length > 0 ? normalizedPlans : this._getDefaultPlans();
    const rawSubscription = subscriptionResult.ok ? subscriptionResult.resp : null;
    const currentSubscription = normalizeSubscriptionFromApi(rawSubscription);
    const paymentMethods = paymentMethodsResult.ok ? paymentMethodsResult.resp : { cards: [], yoomoney: false };

    this._applyPlanUiFlags(plans, currentSubscription);
    const subscriptionTier = currentSubscription?.tier ?? 0;

    this._subscriptionHydrated = true;
    this.refresh({
      ...this.context,
      isLoading: false,
      plans,
      subscriptionFaq: SUBSCRIPTION_FAQ_ITEMS,
      currentUserSubscription: currentSubscription,
      subscriptionTier,
      currentUserCard: paymentMethods.cards?.[0] || null,
      hasYooMoney: paymentMethods.yoomoney || false,
    });
  }

  /**
   * Текущая карточка плана, уровень пользователя и флаги для кнопок «Выбрать» / «Улучшить».
   * @param {Array<Object>} plans
   * @param {ReturnType<typeof normalizeSubscriptionFromApi>|null} currentSubscription
   */
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

  _normalizePlans(rawPlans = []) {

    return rawPlans.map(plan => ({
      id: plan.id,
      name: plan.name,
      tier: plan.tier, // 0=free, 1=tier1, 2=tier2, 3=tier3
      price: plan.price ? `${plan.price} ₽` : null,
      dailyCoins:
        plan.dailyCoinsMultiplier != null
          ? String(Number(plan.dailyCoinsMultiplier) * 3)
          : plan.dailyCoins != null
            ? String(plan.dailyCoins)
            : "3",
      isPopular: plan.isPopular || false,
      requiresPayment: !!plan.price,
      features: (plan.features || []).map(f => ({
        text: f.text,
        included: f.included !== false,
        highlight: f.highlight || false,
      })),
    }));
  }

  _getDefaultPlans() {
    const k = 3;
    const c = {
      free: String(k),
      t1: String(2 * k),
      t2: String(4 * k),
      t3: String(10 * k),
    };
    return [
      {
        id: "free",
        name: "Нет подписки",
        tier: 0,
        price: "0₽",
        dailyCoins: c.free,
        isPopular: false,
        requiresPayment: false,
        features: [
          { text: "Просмотр бесплатного контента.", included: true },
          { text: "Просмотр ленты красочных нарезок.", included: true },
          { text: `Ежедневное число coins — ${c.free} штуки.`, included: true },
          {
            text: "Первую неделю пользователю доступны права подписки III уровня.",
            included: true,
            highlight: true,
          },
          {
            text: "Количество комнат совместного просмотра до 3 в месяц.",
            included: true,
          },
          { text: "Платный контент недоступен.", included: false },
          {
            text: "Премиум-функции (отключение рекламы, расширенные coins и комнаты) — только с подпиской.",
            included: false,
          },
        ],
      },
      {
        id: "tier1",
        name: "Подписка I уровня",
        tier: 1,
        price: "199₽",
        dailyCoins: c.t1,
        isPopular: false,
        requiresPayment: true,
        features: [
          { text: "Просмотр платного контента.", included: true, highlight: true },
          {
            text: "Количество комнат совместного просмотра до 6 в месяц.",
            included: true,
          },
          { text: "Умное продолжение просмотра.", included: true },
          {
            text: "Возможность пропускать рекламу В НАЧАЛЕ ролика.",
            included: true,
          },
          {
            text: `Ежедневное число coins — ${c.t1} штуки.`,
            included: true,
          },
          {
            text: "Количество пользователей, которое можно добавить в комнату, — 2.",
            included: true,
          },
          {
            text: "Персональные рекомендации и полное отключение рекламы — на старших уровнях.",
            included: false,
          },
          {
            text: "Максимальные coins и безлимитные комнаты просмотра — только на III уровне.",
            included: false,
          },
        ],
      },
      {
        id: "tier2",
        name: "Подписка II уровня",
        tier: 2,
        price: "399₽",
        dailyCoins: c.t2,
        isPopular: true,
        requiresPayment: true,
        features: [
          {
            text: "Персональный рекомендательный алгоритм.",
            included: true,
            highlight: true,
          },
          {
            text: "Рекомендательный алгоритм для комнаты просмотра.",
            included: true,
          },
          { text: "Возможность пропустить ВСЮ рекламу.", included: true },
          { text: "Украшения профиля пользователя.", included: true },
          {
            text: "Количество комнат совместного просмотра до 10 в месяц.",
            included: true,
          },
          {
            text: `Ежедневное число coins — ${c.t2} штуки.`,
            included: true,
          },
          {
            text: "Количество пользователей в комнате просмотра — 4.",
            included: true,
          },
          { text: "Просмотр платного контента.", included: true },
          {
            text: "Количество комнат совместного просмотра до 6 в месяц.",
            included: true,
          },
          { text: "Умное продолжение просмотра.", included: true },
          {
            text: "Возможность пропускать рекламу В НАЧАЛЕ ролика.",
            included: true,
          },
          {
            text: "Безлимитные комнаты просмотра и максимум coins — на III уровне.",
            included: false,
          },
        ],
      },
      {
        id: "tier3",
        name: "Подписка III уровня",
        tier: 3,
        price: "799₽",
        dailyCoins: c.t3,
        isPopular: false,
        requiresPayment: true,
        features: [
          {
            text: "Безграничное число комнат просмотра (8).",
            included: true,
            highlight: true,
          },
          { text: "Отключение рекламы.", included: true },
          {
            text: "Создание summary-пересказа серии/фильма/сезона.",
            included: true,
          },
          {
            text: `Ежедневное число coins — ${c.t3} штуки.`,
            included: true,
          },
          { text: "Просмотр платного контента.", included: true },
          {
            text: "Персональный рекомендательный алгоритм.",
            included: true,
          },
          {
            text: "Рекомендательный алгоритм для комнаты просмотра.",
            included: true,
          },
          { text: "Возможность пропустить ВСЮ рекламу.", included: true },
          { text: "Украшения профиля пользователя.", included: true },
          {
            text: "Количество комнат совместного просмотра до 10 в месяц.",
            included: true,
          },
          {
            text: "Количество пользователей в комнате просмотра — 4.",
            included: true,
          },
          { text: "Умное продолжение просмотра.", included: true },
          {
            text: "Возможность пропускать рекламу В НАЧАЛЕ ролика.",
            included: true,
          },
        ],
      },
    ];
  }

  addEventListeners() {
    // Кнопки выбора плана
    this.el.querySelectorAll('[data-action="select-plan"]').forEach(btn => {
      const handler = (e) => this._onSelectPlan(e);
      btn.addEventListener('click', handler);
      this._buttonHandlers.set(btn, handler);
    });

    // Закрытие баннеров
    this.el.querySelectorAll('[data-action="dismiss-error"], [data-action="dismiss-success"]').forEach(btn => {
      const handler = (e) => {
        const banner = e.currentTarget.closest('.subscription-banner');
        banner?.remove();
      };
      btn.addEventListener('click', handler);
      this._buttonHandlers.set(btn, handler);
    });

    // Модалки
    this._setupModalHandlers();

  }

  _setupModalHandlers() {
    const paymentModal = this.el.querySelector('#paymentModal');
    const cancelModal = this.el.querySelector('#cancelModal');

    // Закрытие по кнопке ×
    [paymentModal, cancelModal].forEach(modal => {
      if (!modal) return;
      const closeBtn = modal.querySelector('[data-action="close-modal"]');
      if (closeBtn) {
        const handler = () => this._closeModal(modal);
        closeBtn.addEventListener('click', handler);
        this._modalHandlers.set(closeBtn, handler);
      }
    });

    // Закрытие по клику вне контента
    [paymentModal, cancelModal].forEach(modal => {
      if (!modal) return;
      const handler = (e) => {
        if (e.target === modal) this._closeModal(modal);
      };
      modal.addEventListener('click', handler);
      this._modalHandlers.set(modal, handler);
    });

    // Закрытие через Escape/native dialog close
    [paymentModal, cancelModal].forEach(modal => {
      if (!modal) return;
      const handler = () => {
        this._selectedPlan = null;
        this._syncModalScrollLock();
      };
      modal.addEventListener('close', handler);
      this._modalCloseHandlers.set(modal, handler);
    });

    // Кнопки модалки оплаты
    const cancelPaymentBtn = paymentModal?.querySelector('[data-action="cancel-payment"]');
    if (cancelPaymentBtn) {
      const handler = () => this._closeModal(paymentModal);
      cancelPaymentBtn.addEventListener('click', handler);
      this._modalHandlers.set(cancelPaymentBtn, handler);
    }

    const confirmPaymentBtn = paymentModal?.querySelector('[data-action="confirm-payment"]');
    if (confirmPaymentBtn) {
      const handler = () => this._confirmPayment();
      confirmPaymentBtn.addEventListener('click', handler);
      this._modalHandlers.set(confirmPaymentBtn, handler);
    }

    // Кнопки модалки отмены
    const keepBtn = cancelModal?.querySelector('[data-action="keep-subscription"]');
    if (keepBtn) {
      const handler = () => this._closeModal(cancelModal);
      keepBtn.addEventListener('click', handler);
      this._modalHandlers.set(keepBtn, handler);
    }

    const confirmCancelBtn = cancelModal?.querySelector('[data-action="confirm-cancel"]');
    if (confirmCancelBtn) {
      const handler = () => this._confirmCancel();
      confirmCancelBtn.addEventListener('click', handler);
      this._modalHandlers.set(confirmCancelBtn, handler);
    }
  }

  _onSelectPlan(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;

    const planId = btn.dataset.planId;
    const plan = this.context.plans.find(p => p.id === planId);
    
    if (!plan || plan.isLowerTierThanUser) return;

    if (plan.requiresPayment) {
      this._openPaymentModal(plan);
    } else {
      this._applyFreePlan(plan);
    }
  }

  _openPaymentModal(plan) {
    const modal = this.el.querySelector('#paymentModal');
    if (!modal) return;

    this._selectedPlan = plan;

    // Заполняем модалку
    modal.querySelector('[data-role="modal-plan-name"]').textContent = plan.name;
    modal.querySelector('[data-role="modal-plan-price"]').textContent =
      typeof plan.price === 'number' ? `${plan.price} ₽ / мес` : String(plan.price || '');

    // Показываем модалку
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', 'open');
    }
    this._lockBodyScroll();
  }

  _openCancelModal() {
    const modal = this.el.querySelector('#cancelModal');
    const sub = this.context.currentUserSubscription;
    if (!modal || !sub) return;

    modal.querySelector('[data-role="cancel-plan-name"]').textContent = sub.label;
    modal.querySelector('[data-role="cancel-end-date"]').textContent = sub.renewsAt || 'конца периода';

    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', 'open');
    }
    this._lockBodyScroll();
  }

  _closeModal(modal) {
    if (!modal) return;
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
    this._selectedPlan = null;
    this._syncModalScrollLock();
  }

  _lockBodyScroll() {
    if (this._bodyLockSnapshot) return;

    this._bodyLockSnapshot = {
      overflow: document.body.style.overflow,
    };
    document.body.style.overflow = 'hidden';
  }

  _restoreBodyScroll() {
    if (!this._bodyLockSnapshot) return;

    document.body.style.overflow = this._bodyLockSnapshot.overflow;
    this._bodyLockSnapshot = null;
  }

  _syncModalScrollLock() {
    const hasOpenModal = Boolean(
      this.el?.querySelector('#paymentModal[open], #cancelModal[open]'),
    );

    if (!hasOpenModal) {
      this._restoreBodyScroll();
    }
  }

  async _confirmPayment() {
    if (!this._selectedPlan) return;
    const selectedPlan = this._selectedPlan;

    const btn = this.el.querySelector('#confirmPaymentBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Обработка...';
    }

    const paymentMethod = this.el.querySelector('input[name="paymentMethod"]:checked')?.value || 'card';

    const result = await userService.createSubscription({
      plan_id: selectedPlan.id,
      payment_method: paymentMethod,
      card_id: this.context.currentUserCard?.id,
    });

    if (result.ok) {
      this._closeModal(this.el.querySelector('#paymentModal'));
      
      // Если нужен редирект на платежную страницу
      if (result.resp?.payment_url) {
        window.location.href = result.resp.payment_url;
        return;
      }

      const newSubscription = normalizeSubscriptionFromApi(
        result.resp.subscription,
      );
      authStore.updateUserSubscription(newSubscription);

      this._applyPlanUiFlags(this.context.plans, newSubscription);
      this.refresh({
        ...this.context,
        currentUserSubscription: newSubscription,
        subscriptionTier: newSubscription?.tier ?? 0,
        successMessage: `Подписка «${selectedPlan.name}» успешно подключена.`,
        errorMessage: '',
      });

      // Сбрасываем кнопки
      this._resetPlanButtons();
    } else {
      this.refresh({
        ...this.context,
        errorMessage: getApiErrorMessage(result, {
          fallback: 'Не удалось оформить подписку. Попробуйте позже.',
        }),
      });
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Оплатить и подключить';
    }
  }

  async _confirmCancel() {
    const result = await userService.cancelSubscription();

    if (result.ok) {
      this._closeModal(this.el.querySelector('#cancelModal'));
      
      authStore.updateUserSubscription(null);

      this._applyPlanUiFlags(this.context.plans, null);
      this.refresh({
        ...this.context,
        currentUserSubscription: null,
        subscriptionTier: 0,
        successMessage: 'Подписка отменена. Доступ сохранится до конца оплаченного периода.',
      });

      this._resetPlanButtons();
    } else {
      this.refresh({
        ...this.context,
        errorMessage: getApiErrorMessage(result, {
          fallback: 'Не удалось отменить подписку.',
        }),
      });
    }
  }

  async _applyFreePlan(plan) {
    authStore.updateUserSubscription(null);

    this._applyPlanUiFlags(this.context.plans, null);
    this.refresh({
      ...this.context,
      currentUserSubscription: null,
      subscriptionTier: 0,
      successMessage: `Выбран план «${plan.name}».`,
    });

    this._resetPlanButtons();
  }

  _resetPlanButtons() {
    this.context.plans.forEach(plan => {
      const card = this.el.querySelector(`[data-plan-id="${plan.id}"]`);
      const btn = card?.querySelector('[data-action="select-plan"]');
      if (!btn) return;

      if (plan.isCurrent) {
        btn.textContent = 'Ваш план';
        btn.disabled = true;
        btn.classList.remove('btn_accent');
        btn.classList.add('btn_outline');
        return;
      }

      if (plan.isLowerTierThanUser) {
        btn.textContent = 'Выбрать';
        btn.disabled = true;
        btn.classList.remove('btn_accent');
        btn.classList.add('btn_outline');
        return;
      }

      btn.disabled = false;
      if (plan.requiresPayment) {
        btn.textContent = this.context.currentUserSubscription ? 'Улучшить' : 'Подключить';
        btn.classList.add('btn_accent');
        btn.classList.remove('btn_outline');
      } else {
        btn.textContent = 'Выбрать';
        btn.classList.remove('btn_accent');
        btn.classList.add('btn_outline');
      }
    });
  }

  removeEventListeners() {
    if (this._authUnsubscribe) {
      this._authUnsubscribe();
      this._authUnsubscribe = null;
    }

    for (const [el, handler] of this._buttonHandlers) {
      el.removeEventListener('click', handler);
    }
    this._buttonHandlers.clear();

    for (const [el, handler] of this._modalHandlers) {
      el.removeEventListener('click', handler);
    }
    this._modalHandlers.clear();

    for (const [el, handler] of this._modalCloseHandlers) {
      el.removeEventListener('close', handler);
    }
    this._modalCloseHandlers.clear();

    this._restoreBodyScroll();
  }

  setupChildren() {
    const header = this.el.querySelector('#header');
    if (!header) throw new Error('SubscriptionPage: не найден header');

    this.addChild(
      "header",
      new HeaderComponent({}, this, header),
    );
  }
}

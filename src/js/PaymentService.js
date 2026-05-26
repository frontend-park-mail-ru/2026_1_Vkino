import { apiService } from "./api.js";

export const PENDING_PAYMENT_KEY = "vkino_pending_payment_id";

export const PAYMENT_METHOD = Object.freeze({
  YOOKASSA: "yookassa",
  VKINO_COINS: "vkino_coins",
});

export class PaymentService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("/payments");
  }

  /**
   * Список тарифов, доступных для оплаты.
   * @returns {Promise<{ok: boolean, resp: {tariffs: Array}}>}
   */
  async getTariffs() {
    return this.api.get("/tariffs");
  }

  /**
   * Создаёт платёж за подписку.
   * @param {number} productRefId — id тарифа из GET /tariffs
   * @param {string} [paymentMethod="yookassa"] — yookassa | vkino_coins
   */
  async createSubscriptionPayment(
    productRefId,
    paymentMethod = PAYMENT_METHOD.YOOKASSA,
  ) {
    const id = Number(productRefId);
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        status: 0,
        resp: { Error: "Некорректный тариф" },
      };
    }

    const normalizedMethod = String(paymentMethod || PAYMENT_METHOD.YOOKASSA).trim();

    return this.api.post("", {
      product_type: "subscription",
      product_ref_id: id,
      payment_method: normalizedMethod,
    });
  }

  /**
   * Статус платежа (для polling на return-странице).
   * @param {number|string} paymentId
   */
  async getPaymentStatus(paymentId) {
    const id = String(paymentId ?? "").trim();
    if (!id) {
      return {
        ok: false,
        status: 0,
        resp: { Error: "Не указан id платежа" },
      };
    }

    return this.api.get(`/${encodeURIComponent(id)}`);
  }
}

export const paymentService = new PaymentService(apiService);

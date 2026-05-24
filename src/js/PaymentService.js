import { apiService } from "./api.js";

export const PENDING_PAYMENT_KEY = "vkino_pending_payment_id";

export class PaymentService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("/payments");
  }

  /**
   * Список тарифов, доступных для оплаты рублями.
   * @returns {Promise<{ok: boolean, resp: {tariffs: Array}}>}
   */
  async getTariffs() {
    return this.api.get("/tariffs");
  }

  /**
   * Создаёт платёж за подписку и возвращает URL для редиректа на ЮKassa.
   * @param {number} productRefId — id тарифа из GET /tariffs
   */
  async createSubscriptionPayment(productRefId) {
    const id = Number(productRefId);
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        status: 0,
        resp: { Error: "Некорректный тариф" },
      };
    }

    return this.api.post("", {
      product_type: "subscription",
      product_ref_id: id,
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

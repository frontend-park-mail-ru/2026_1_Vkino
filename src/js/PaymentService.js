import { apiService } from "./api.js";

export const PENDING_PAYMENT_KEY = "vkino_pending_payment_id";
export const PENDING_PAYMENT_CONTEXT_KEY = "vkino_pending_payment_context";
export const PAYMENT_CONTEXT_COINS = "coins";
export const PAYMENT_CONTEXT_SUBSCRIPTION = "subscription";

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
   * Список пакетов VKino coins для покупки за рубли.
   * @returns {Promise<{ok: boolean, resp: {packs: Array}}>}
   */
  async getCoinsPacks() {
    return this.api.get("/coins-packs");
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
   * Создаёт платёж за пакет VKino coins (только ЮKassa).
   * @param {number} packId — id пакета из GET /coins-packs
   */
  async createCoinsPayment(packId) {
    const id = Number(packId);
    if (!Number.isFinite(id) || id <= 0) {
      return {
        ok: false,
        status: 0,
        resp: { Error: "Некорректный пакет" },
      };
    }

    return this.api.post("", {
      product_type: "coins",
      product_ref_id: id,
      payment_method: PAYMENT_METHOD.YOOKASSA,
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

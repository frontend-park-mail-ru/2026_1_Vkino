import {
  paymentService,
  PENDING_PAYMENT_KEY,
} from "@/js/PaymentService.js";
import { authStore } from "@/store/authStore.js";
import { getApiErrorMessage } from "@/utils/apiError.js";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 30;
const PENDING_GIVE_UP_ATTEMPTS = 6;

function sleep(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function resolvePaymentId() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = (
    params.get("payment_id") ||
    params.get("paymentId") ||
    params.get("orderId") ||
    ""
  ).trim();

  if (fromUrl) {
    return fromUrl;
  }

  return (sessionStorage.getItem(PENDING_PAYMENT_KEY) || "").trim();
}

export async function pollPaymentStatus(paymentId, { signal } = {}) {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      return { kind: "aborted" };
    }

    const result = await paymentService.getPaymentStatus(paymentId);

    if (!result.ok) {
      if (result.status === 401) {
        return { kind: "unauthorized" };
      }

      return {
        kind: "error",
        message: getApiErrorMessage(result, {
          fallback: "Не удалось проверить статус платежа.",
        }),
      };
    }

    const status = String(result.resp?.status ?? "").toLowerCase();

    if (status === "succeeded") {
      sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      await authStore.refreshAfterPayment();

      const subscription = authStore.getState().user?.subscription;

      return {
        kind: "success",
        subscriptionLabel: subscription?.label ?? "",
        renewsAt: subscription?.renewsAt ?? "",
      };
    }

    if (status === "canceled") {
      sessionStorage.removeItem(PENDING_PAYMENT_KEY);
      return { kind: "canceled" };
    }

    if (status === "pending" && attempt + 1 >= PENDING_GIVE_UP_ATTEMPTS) {
      return { kind: "incomplete" };
    }

    await sleep(POLL_INTERVAL_MS);

    if (signal?.aborted) {
      return { kind: "aborted" };
    }
  }

  return { kind: "timeout" };
}

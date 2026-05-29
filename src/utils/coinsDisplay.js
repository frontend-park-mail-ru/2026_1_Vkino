import vkinoCoinSvg from "@/assets/icons/vkino-coin.svg?raw";

export const VKINO_COIN_ICON_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  vkinoCoinSvg.trim(),
)}`;

export const VKINO_COINS_INFO_TEXT =
  "VKino coins — внутренняя валюта платформы. Они начисляются ежедневно, количество начисляемых VKino coins зависит от уровня подписки. Можно тратить на ставки в комнатах и оплату подписки. VKino coins можно купить за рубли.";

const OPERATION_TYPE_META = Object.freeze({
  daily: { label: "Ежедневное начисление", isPositive: true },
  signup_bonus: { label: "Бонус за регистрацию", isPositive: true },
  bet_win: { label: "Победа в ставке", isPositive: true },
  bet_lose: { label: "Проигрыш в ставке", isPositive: false },
  bet_place: { label: "Ставка в комнате", isPositive: false },
  feed_monkey: { label: "Кормление обезьяны", isPositive: false },
  purchase: { label: "Покупка подписки", isPositive: false },
  coins_purchase: { label: "Покупка", isPositive: true },
});

export function extractCoinsBalanceFromProfile(profile = {}) {
  const raw =
    profile.vkino_coins_count ??
    profile.vkino_coins_balance ??
    profile.coins_balance ??
    profile.coinsBalance;

  if (raw === null || raw === undefined || raw === "") {
    return null;
  }

  const balance = Number(raw);
  return Number.isFinite(balance) ? balance : null;
}

export function getCoinsOperationMeta(operationType) {
  const normalizedType = String(operationType || "").trim();

  return (
    OPERATION_TYPE_META[normalizedType] ?? {
      label: normalizedType || "Операция",
      isPositive: true,
    }
  );
}

export function formatCoinsAmount(count, isPositive) {
  const value = Math.abs(Number(count) || 0);
  return `${isPositive ? "+" : "-"}${value}`;
}

export function formatCoinsHistoryDate(value) {
  if (!value) {
    return "";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}

export function normalizeCoinsHistoryItem(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const { label, isPositive } = getCoinsOperationMeta(raw.operation_type);
  const count = Number(raw.vkino_coins_count) || 0;
  const description = String(raw.description ?? "").trim();

  return {
    id: raw.id,
    date: formatCoinsHistoryDate(raw.created_at),
    operationLabel: label,
    directionLabel: isPositive ? "Начисление" : "Списание",
    directionTone: isPositive ? "positive" : "negative",
    description: description || null,
    amount: formatCoinsAmount(count, isPositive),
    isPositive,
  };
}

export function normalizeCoinsHistoryResponse(resp) {
  const sourceItems = Array.isArray(resp?.items)
    ? resp.items
    : Array.isArray(resp)
      ? resp
      : [];

  const items = sourceItems.map(normalizeCoinsHistoryItem).filter(Boolean);
  const total = Number(resp?.total_count ?? resp?.total);

  return {
    items,
    total: Number.isFinite(total) ? total : items.length,
  };
}

/**
 * Нормализует ответ API подписки для отображения в UI.
 * Для бесплатного тарифа (tier 0, plan free) возвращает null — в интерфейсе это «нет подписки».
 * @param {Object|null|undefined} raw
 * @returns {null|{
 *   planId: string,
 *   tier: number,
 *   label: string,
 *   renewsAt: string|null,
 *   isHighestTier: boolean,
 *   canCancel: boolean,
 *   status: string|undefined
 * }}
 */
export function normalizeSubscriptionFromApi(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  let planId = String(raw.plan_id ?? raw.planId ?? "").trim();

  let tier = Number(raw.tier);
  if (!Number.isFinite(tier)) {
    if (planId === "tier3") tier = 3;
    else if (planId === "tier2") tier = 2;
    else if (planId === "tier1") tier = 1;
    else if (planId === "free") tier = 0;
    else tier = NaN;
  }

  if (!planId && Number.isFinite(tier)) {
    planId =
      tier === 0 ? "free" : tier === 1 ? "tier1" : tier === 2 ? "tier2" : tier === 3 ? "tier3" : "";
  }

  if (!Number.isFinite(tier)) {
    return null;
  }

  /* Нет платной подписки — карточка «Нет подписки» в гриде, герой как без подписки */
  if (tier <= 0 || planId === "free") {
    return null;
  }

  return {
    planId: planId || `tier${tier}`,
    tier,
    label: raw.plan_name || raw.planName || "Подписка",
    renewsAt: raw.renews_at
      ? new Date(raw.renews_at).toLocaleDateString("ru-RU")
      : null,
    isHighestTier: tier >= 3,
    canCancel: raw.can_cancel !== false,
    status: raw.status,
  };
}

/**
 * @param {Array<{id: string, name: string, tier: number, dailyCoins?: string, priceSummary?: string}>} plans
 * @param {ReturnType<typeof normalizeSubscriptionFromApi>|null} current
 */
export function markPlansForPreview(plans, current) {
  return plans.map((plan) => ({
    ...plan,
    isCurrent:
      Boolean(current && plan.id === current.planId) ||
      (!current && plan.tier === 0 && plan.id === "free"),
  }));
}

/** Короткий список планов для превью в настройках при отсутствии ответа API. */
export function getDefaultSubscriptionPlansPreview() {
  return [
    { id: "free", name: "Нет подписки", tier: 0, priceSummary: "Бесплатно" },
    { id: "tier1", name: "Подписка I уровня", tier: 1, priceSummary: "199 ₽ / мес" },
    { id: "tier2", name: "Подписка II уровня", tier: 2, priceSummary: "399 ₽ / мес" },
    { id: "tier3", name: "Подписка III уровня", tier: 3, priceSummary: "799 ₽ / мес" },
  ];
}

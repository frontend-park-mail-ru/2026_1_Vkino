/**
 * Маппинг backend level (1=free, 2–4=paid) → UI tier (0–3).
 * @param {number} level
 */
export function backendLevelToUiTier(level) {
  const n = Number(level);
  if (!Number.isFinite(n) || n <= 1) return 0;
  return Math.min(n - 1, 3);
}

/**
 * UI tier → backend code.
 * @param {number} tier
 */
export function uiTierToBackendCode(tier) {
  const map = {
    0: "free",
    1: "level_2",
    2: "level_3",
    3: "level_4",
  };
  return map[tier] ?? "free";
}

const AD_POLICY_LABELS = {
  no_skip: "Реклама без пропуска",
  skip_preroll: "Пропуск рекламы в начале ролика",
  skip_all: "Пропуск всей рекламы",
  none: "Без рекламы",
};

/**
 * Статические фичи тарифов по seed из migrations/000011 (опции Олега).
 * @param {string} code — free | level_2 | level_3 | level_4
 */
export function getPlanFeaturesByCode(code) {
  const features = {
    free: [
      { text: "Просмотр бесплатного контента.", included: true },
      { text: "Ежедневно 3 VKino coins.", included: true },
      { text: "До 3 комнат совместного просмотра в месяц.", included: true },
      { text: "До 2 участников в комнате.", included: true },
      { text: "Платный контент недоступен.", included: false },
      { text: "Умное продолжение просмотра недоступно.", included: false },
      { text: AD_POLICY_LABELS.no_skip + ".", included: false },
    ],
    level_2: [
      { text: "Просмотр платного контента.", included: true, highlight: true },
      { text: "Умное продолжение просмотра.", included: true },
      { text: AD_POLICY_LABELS.skip_preroll + ".", included: true },
      { text: "Ежедневно 6 VKino coins.", included: true },
      { text: "До 6 комнат совместного просмотра в месяц.", included: true },
      { text: "До 2 участников в комнате.", included: true },
      { text: "Пропуск всей рекламы — на старших уровнях.", included: false },
    ],
    level_3: [
      { text: "Просмотр платного контента.", included: true },
      { text: "Умное продолжение просмотра.", included: true },
      { text: AD_POLICY_LABELS.skip_all + ".", included: true, highlight: true },
      { text: "Ежедневно 12 VKino coins.", included: true },
      { text: "До 10 комнат совместного просмотра в месяц.", included: true },
      { text: "До 4 участников в комнате.", included: true },
      { text: "Безлимитные комнаты — на III уровне.", included: false },
    ],
    level_4: [
      { text: "Просмотр платного контента.", included: true },
      { text: "Умное продолжение просмотра.", included: true },
      { text: AD_POLICY_LABELS.none + ".", included: true, highlight: true },
      { text: "Ежедневно 30 VKino coins.", included: true },
      { text: "Безлимитное число комнат совместного просмотра.", included: true, highlight: true },
      { text: "До 4 участников в комнате.", included: true },
    ],
  };

  return features[code] ?? features.free;
}

/** Отображаемое имя тарифа в UI. */
export function getPlanDisplayName(code, fallbackTitle = "") {
  const names = {
    free: "Нет подписки",
    level_2: "Подписка I уровня",
    level_3: "Подписка II уровня",
    level_4: "Подписка III уровня",
  };
  return names[code] || fallbackTitle || "Подписка";
}

/**
 * Преобразует тариф из GET /payments/tariffs в модель карточки плана.
 * @param {Object} tariff
 */
export function mapTariffToPlan(tariff) {
  const code = String(tariff.code ?? "").trim();
  const level = Number(tariff.level);
  const tier = backendLevelToUiTier(level);
  const priceMoney = Number(tariff.price_money);

  return {
    id: code,
    productRefId: tariff.id,
    name: getPlanDisplayName(code, tariff.title),
    tier,
    level,
    price: Number.isFinite(priceMoney) ? `${priceMoney}₽` : null,
    priceMoney: Number.isFinite(priceMoney) ? priceMoney : null,
    priceCoins: Number(tariff.price_vkino_coins) || null,
    durationDays: Number(tariff.duration_days) || 30,
    dailyCoins: getDailyCoinsLabel(code),
    isPopular: code === "level_3",
    requiresPayment: tier > 0,
    features: getPlanFeaturesByCode(code),
  };
}

function getDailyCoinsLabel(code) {
  const limits = { free: "3", level_2: "6", level_3: "12", level_4: "30" };
  return limits[code] ?? "3";
}

/** Статический free-план для грида (не приходит из GET /tariffs). */
export function getFreePlan() {
  return {
    id: "free",
    productRefId: null,
    name: "Нет подписки",
    tier: 0,
    level: 1,
    price: "0₽",
    priceMoney: 0,
    priceCoins: null,
    durationDays: 365,
    dailyCoins: "3",
    isPopular: false,
    requiresPayment: false,
    features: getPlanFeaturesByCode("free"),
  };
}

/**
 * Нормализует subscription из GET /user/subscription/capabilities.
 * Для free / отсутствия платной подписки возвращает null.
 */
export function normalizeSubscriptionFromApi(raw) {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const code = String(raw.code ?? raw.plan_id ?? raw.planId ?? "").trim();
  const level = Number(raw.level ?? raw.tier);
  let tier = Number.isFinite(level) ? backendLevelToUiTier(level) : NaN;

  if (!Number.isFinite(tier)) {
    if (code === "level_4") tier = 3;
    else if (code === "level_3") tier = 2;
    else if (code === "level_2") tier = 1;
    else if (code === "free") tier = 0;
    else tier = NaN;
  }

  if (!Number.isFinite(tier) || tier <= 0 || code === "free") {
    return null;
  }

  const activeUntil = raw.active_until ?? raw.renews_at ?? raw.renewsAt;

  return {
    planId: code || uiTierToBackendCode(tier),
    tier,
    level: Number.isFinite(level) ? level : tier + 1,
    label: raw.name || raw.plan_name || getPlanDisplayName(code),
    renewsAt: activeUntil
      ? new Date(activeUntil).toLocaleDateString("ru-RU")
      : null,
    activeUntil: activeUntil || null,
    isHighestTier: tier >= 3,
    canCancel: false,
    status: "active",
  };
}

/**
 * Нормализует capabilities + usage из GET /user/subscription/capabilities.
 */
export function normalizeCapabilitiesFromApi(raw) {
  if (!raw || typeof raw !== "object") {
    return {
      canWatchPaidContent: false,
      canUseSmartContinue: false,
      adPolicy: "no_skip",
      dailyCoinsLimit: 3,
      monthlyRoomLimit: 3,
      maxRoomMembers: 2,
      usage: null,
    };
  }

  const caps = raw.capabilities ?? raw;
  const usage = raw.usage ?? null;

  return {
    canWatchPaidContent: Boolean(caps.can_watch_paid_content),
    canUseSmartContinue: Boolean(caps.can_use_smart_continue),
    adPolicy: String(caps.ad_policy ?? "no_skip"),
    adPolicyLabel: AD_POLICY_LABELS[caps.ad_policy] ?? caps.ad_policy,
    dailyCoinsLimit: caps.daily_coins_limit ?? 3,
    monthlyRoomLimit: caps.monthly_room_limit,
    maxRoomMembers: caps.max_room_members ?? 2,
    usage: usage
      ? {
          coinsReceivedToday: usage.coins_received_today,
          coinsRemainingToday: usage.coins_remaining_today,
          roomsCreatedThisMonth: usage.rooms_created_this_month,
          roomsRemainingThisMonth: usage.rooms_remaining_this_month,
        }
      : null,
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

/** Короткий список планов для превью в настройках. */
export function getDefaultSubscriptionPlansPreview() {
  return [
    { id: "free", name: "Нет подписки", tier: 0, priceSummary: "Бесплатно" },
    { id: "level_2", name: "Подписка I уровня", tier: 1, priceSummary: "299 ₽ / мес" },
    { id: "level_3", name: "Подписка II уровня", tier: 2, priceSummary: "499 ₽ / мес" },
    { id: "level_4", name: "Подписка III уровня", tier: 3, priceSummary: "699 ₽ / мес" },
  ];
}

/**
 * Собирает полный список планов: free + тарифы из API.
 * @param {Array<Object>} tariffs
 */
export function buildPlansFromTariffs(tariffs = []) {
  const paidPlans = tariffs
    .map(mapTariffToPlan)
    .sort((a, b) => a.tier - b.tier);
  return [getFreePlan(), ...paidPlans];
}

/**
 * Fallback-планы при недоступности API (id могут отличаться от prod).
 */
export function getDefaultPlans() {
  return buildPlansFromTariffs([
    {
      id: 2,
      code: "level_2",
      title: "Level 2",
      price_money: 299,
      duration_days: 30,
      level: 2,
      price_vkino_coins: 399,
    },
    {
      id: 3,
      code: "level_3",
      title: "Level 3",
      price_money: 499,
      duration_days: 30,
      level: 3,
      price_vkino_coins: 699,
    },
    {
      id: 4,
      code: "level_4",
      title: "Level 4",
      price_money: 699,
      duration_days: 30,
      level: 4,
      price_vkino_coins: 999,
    },
  ]);
}

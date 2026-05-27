export const USE_COINS_DEV_MOCKS = false;

export const MOCK_COINS_BALANCE = 127;

export const MOCK_COINS_HISTORY = Object.freeze([
  {
    id: 12,
    vkino_coins_count: 3,
    operation_type: "daily",
    description: null,
    created_at: "2026-10-13T09:15:00Z",
  },
  {
    id: 11,
    vkino_coins_count: 5,
    operation_type: "bet_win",
    description: "Ставка «Кто умрёт в следующей серии?»",
    created_at: "2026-10-12T21:40:00Z",
  },
  {
    id: 10,
    vkino_coins_count: 5,
    operation_type: "bet_place",
    description: "Ставка «Кто умрёт в следующей серии?»",
    created_at: "2026-10-12T20:05:00Z",
  },
  {
    id: 9,
    vkino_coins_count: 399,
    operation_type: "purchase",
    description: "Подписка Level 2 на 30 дней",
    created_at: "2026-10-11T14:22:00Z",
  },
  {
    id: 8,
    vkino_coins_count: 6,
    operation_type: "daily",
    description: null,
    created_at: "2026-10-11T08:00:00Z",
  },
  {
    id: 7,
    vkino_coins_count: 2,
    operation_type: "bet_win",
    description: "Ставка «Будет ли твист в финале?»",
    created_at: "2026-10-10T23:18:00Z",
  },
  {
    id: 6,
    vkino_coins_count: 2,
    operation_type: "bet_lose",
    description: "Ставка «Будет ли твист в финале?»",
    created_at: "2026-10-10T22:50:00Z",
  },
  {
    id: 5,
    vkino_coins_count: 3,
    operation_type: "daily",
    description: null,
    created_at: "2026-10-10T07:45:00Z",
  },
  {
    id: 4,
    vkino_coins_count: 10,
    operation_type: "bet_win",
    description:
      "Ставка «Угадай, кто выживет в третьем акте — очень длинное описание для проверки обрезки текста в интерфейсе истории VKino coins»",
    created_at: "2026-10-09T19:30:00Z",
  },
  {
    id: 3,
    vkino_coins_count: 10,
    operation_type: "bet_lose",
    description: "Ставка «Угадай, кто выживет в третьем акте»",
    created_at: "2026-10-09T18:12:00Z",
  },
  {
    id: 2,
    vkino_coins_count: 699,
    operation_type: "purchase",
    description: "Подписка Level 3 на 30 дней",
    created_at: "2026-10-08T11:00:00Z",
  },
  {
    id: 1,
    vkino_coins_count: 3,
    operation_type: "daily",
    description: null,
    created_at: "2026-10-08T08:10:00Z",
  },
]);

export function buildMockCoinsHistoryResponse({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.max(0, Number(limit) || 0);
  const safeOffset = Math.max(0, Number(offset) || 0);
  const items = MOCK_COINS_HISTORY.slice(safeOffset, safeOffset + safeLimit);

  return {
    items,
    total_count: MOCK_COINS_HISTORY.length,
  };
}

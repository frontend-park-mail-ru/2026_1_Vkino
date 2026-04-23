import { apiService } from "./api.js";

const FALLBACK_OVERVIEW = Object.freeze({
  heroPosters: [
    {
      id: "hero-fallback-1",
      title: "Джокер",
      label: "Вечерний сеанс",
      imageUrl: "/img/joker.jpeg",
    },
    {
      id: "hero-fallback-2",
      title: "Тёмный рыцарь",
      label: "Экшен",
      imageUrl: "/img/dark_knight.jpg",
    },
  ],
  visibilityOptions: [
    { value: "friends", label: "Только по ссылке", selected: true },
    { value: "private", label: "Приватная", selected: false },
    { value: "public", label: "Открытая", selected: false },
  ],
  featuredRooms: [],
  myRooms: [],
});

export class WatchPartyService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("watch-party");
  }

  async getOverview() {
    return this.api.get("/overview");
  }

  async createRoom(payload) {
    return this.api.post("/rooms", payload);
  }

  async joinRoom(payload) {
    return this.api.post("/join", payload);
  }

  async deleteRoom(roomId) {
    const normalizedRoomId = String(roomId ?? "").trim();

    if (!normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан id комнаты",
      };
    }

    return this.api.delete(`/rooms/${encodeURIComponent(normalizedRoomId)}`);
  }
}

export function buildWatchPartyFallbackOverview() {
  return {
    heroPosters: FALLBACK_OVERVIEW.heroPosters.map((item) => ({ ...item })),
    visibilityOptions: FALLBACK_OVERVIEW.visibilityOptions.map((item) => ({
      ...item,
    })),
    featuredRooms: FALLBACK_OVERVIEW.featuredRooms.map((item) => ({
      ...item,
    })),
    myRooms: FALLBACK_OVERVIEW.myRooms.map((item) => ({ ...item })),
  };
}

export const watchPartyService = new WatchPartyService(apiService);

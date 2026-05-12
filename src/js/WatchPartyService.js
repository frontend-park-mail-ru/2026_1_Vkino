import { apiService } from "./api.js";

const FALLBACK_OVERVIEW = Object.freeze({
  heroPosters: [
    {
      id: "hero-fallback-1",
      title: "Интерстеллар",
      label: "Ставки в чате",
      imageUrl: "/img/cards/interstellar.webp",
    },
    {
      id: "hero-fallback-2",
      title: "Джокер",
      label: "Живые комнаты",
      imageUrl: "/img/joker.jpeg",
    },
    {
      id: "hero-fallback-3",
      title: "Тёмный рыцарь",
      label: "Синхронный просмотр",
      imageUrl: "/img/dark_knight.jpg",
    },
    {
      id: "hero-fallback-4",
      title: "Побег из Шоушенка",
      label: "Комнаты друзей",
      imageUrl: "/img/65.jpg",
    },
  ],
  visibilityOptions: [
    { value: "private", label: "Только по ссылке", selected: true },
    { value: "public", label: "Открытая", selected: false },
  ],
  featuredRooms: [
    {
      id: "31",
      title: "Ночной сеанс",
      hostName: "Алексей К.",
      movieTitle: "Интерстеллар",
      membersCount: 5,
      privacyLabel: "Только по ссылке",
      progressLabel: "45:12",
      isLive: true,
      roomHref: "/watch-party/id31",
    },
    {
      id: "12",
      title: "Киноклуб пятницы",
      hostName: "Мария В.",
      movieTitle: "Джокер",
      membersCount: 4,
      privacyLabel: "Открытая",
      progressLabel: "1:12:08",
      isLive: true,
      roomHref: "/watch-party/id12",
    },
  ],
});

export class WatchPartyService {
  constructor(apiServiceInstance) {
    this.api = apiServiceInstance.withNamespace("watch-party");
  }

  async getOverview() {
    return this.api.get("/overview");
  }

  async getRoom(roomId) {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан id комнаты",
      };
    }

    return this.api.get(`/rooms/${encodeURIComponent(normalizedRoomId)}`);
  }

  async createRoom(payload) {
    return this.api.post("/rooms", payload);
  }

  async joinRoom(payload) {
    return this.api.post("/join", payload);
  }

  async deleteRoom(roomId) {
    const normalizedRoomId = normalizeRoomId(roomId);

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

  async sendRoomAction(roomId, payload) {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан id комнаты",
      };
    }

    return this.api.post(
      `/rooms/${encodeURIComponent(normalizedRoomId)}/actions`,
      payload,
    );
  }

  async sendRoomMessage(roomId, payload) {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан id комнаты",
      };
    }

    return this.api.post(
      `/rooms/${encodeURIComponent(normalizedRoomId)}/messages`,
      payload,
    );
  }

  async createRoomPoll(roomId, payload) {
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан id комнаты",
      };
    }

    return this.api.post(
      `/rooms/${encodeURIComponent(normalizedRoomId)}/polls`,
      payload,
    );
  }

  async voteRoomPoll(roomId, pollId, payload) {
    const normalizedRoomId = normalizeRoomId(roomId);
    const normalizedPollId = normalizeText(pollId);

    if (!normalizedRoomId || !normalizedPollId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не переданы id комнаты или poll",
      };
    }

    return this.api.post(
      `/rooms/${encodeURIComponent(normalizedRoomId)}/polls/${encodeURIComponent(normalizedPollId)}/votes`,
      payload,
    );
  }
}

export function buildWatchPartyRoomPath(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId) || "1";
  return `/watch-party/id${encodeURIComponent(normalizedRoomId)}`;
}

export function buildWatchPartyFallbackOverview() {
  return {
    heroPosters: FALLBACK_OVERVIEW.heroPosters.map((item) => ({ ...item })),
    visibilityOptions: FALLBACK_OVERVIEW.visibilityOptions.map((item) => ({
      ...item,
    })),
    featuredRooms: [],
    myRooms: [],
  };
}

export function buildWatchPartyFallbackRoom(roomId = "") {
  const normalizedRoomId = normalizeRoomId(roomId);
  return {
    id: normalizedRoomId,
    roomName: "",
    participantsCount: 0,
    participantsLabel: "0 участников",
    progressLabel: "",
    liveLabel: "",
    privacyLabel: "",
    inviteLink: normalizedRoomId ? buildWatchPartyRoomPath(normalizedRoomId) : "",
    hostName: "",
    roomNote: "",
    movie: {
      title: "",
      year: "",
      subtitle: "",
      contentType: "",
      backdropUrl: "",
    },
    playerSource: {
      movieId: "",
      episodeId: "",
      playbackUrl: "",
      durationSeconds: 0,
      positionSeconds: 0,
      episodeTitle: "",
      description: "",
      posterUrl: "",
    },
    player: {
      isPlaying: false,
      progressPercent: 0,
      currentTimeLabel: "",
      totalTimeLabel: "",
      volumePercent: 100,
      qualityLabel: "",
      syncLabel: "",
    },
    viewer: {
      name: "Вы",
      initial: "В",
      avatarTint: pickAvatarTint("viewer"),
    },
    members: [],
    messages: [],
  };
}

export function listLocalWatchPartyRooms() {
  return [];
}

export function getLocalWatchPartyRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);

  if (!normalizedRoomId) {
    return null;
  }

  return null;
}

export function saveLocalWatchPartyRoom(room) {
  return room ? cloneValue(room) : null;
}

export function deleteLocalWatchPartyRoom(roomId) {
  return roomId;
}

export const watchPartyService = new WatchPartyService(apiService);

function sanitizeRoom(room) {
  if (!room || typeof room !== "object" || Array.isArray(room)) {
    return null;
  }

  const normalizedId = normalizeRoomId(room.id);

  if (!normalizedId) {
    return null;
  }

  return {
    ...cloneValue(room),
    id: normalizedId,
    inviteLink: normalizeText(room.inviteLink) || buildWatchPartyRoomPath(normalizedId),
  };
}

function normalizeRoomId(roomId) {
  return String(roomId ?? "")
    .trim()
    .replace(/^id/i, "")
    .replace(/^\/+|\/+$/g, "");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pluralizeParticipants(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "участник";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "участника";
  }

  return "участников";
}

function pickAvatarTint(seed) {
  const palette = [
    "rgba(255, 87, 31, 0.28)",
    "rgba(26, 111, 181, 0.28)",
    "rgba(43, 156, 90, 0.28)",
    "rgba(181, 124, 32, 0.28)",
    "rgba(120, 60, 180, 0.28)",
  ];

  const normalizedSeed = normalizeText(seed) || "vkino";
  const hash = Array.from(normalizedSeed).reduce((acc, char) => {
    return acc + char.charCodeAt(0);
  }, 0);

  return palette[hash % palette.length];
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

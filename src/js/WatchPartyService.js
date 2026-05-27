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

  async joinRoomByInviteCode(inviteCode) {
    const normalizedInviteCode = normalizeText(inviteCode);

    if (!normalizedInviteCode) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передан invite-код комнаты",
      };
    }

    return this.api.get(`/join/${encodeURIComponent(normalizedInviteCode)}`);
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

  async sendRoomReaction(roomId, reaction) {
    const normalizedReaction = normalizeText(reaction);

    if (!normalizedReaction) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не передана реакция",
      };
    }

    return this.sendRoomMessage(roomId, {
      content: normalizedReaction,
    });
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

  async resolveRoomPoll(roomId, pollId, payload) {
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
      `/rooms/${encodeURIComponent(normalizedRoomId)}/polls/${encodeURIComponent(normalizedPollId)}/resolve`,
      payload,
    );
  }

  async inviteFriendToRoom(friendId, roomId) {
    const normalizedFriendId = normalizeText(friendId);
    const normalizedRoomId = normalizeRoomId(roomId);

    if (!normalizedFriendId || !normalizedRoomId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "WatchPartyService: не переданы id друга или комнаты",
      };
    }

    return this.api.post(
      `/friends/${encodeURIComponent(normalizedFriendId)}/invite`,
      { room_id: Number(normalizedRoomId) || normalizedRoomId },
    );
  }
}

export function buildWatchPartyRoomPath(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId) || "1";
  return `/watch-party/id${encodeURIComponent(normalizedRoomId)}`;
}

export function buildWatchPartyJoinPath(inviteCode) {
  const normalizedInviteCode = normalizeText(inviteCode);
  return normalizedInviteCode
    ? `/watch-party/join/${encodeURIComponent(normalizedInviteCode)}`
    : "/watch-party";
}

export function buildWatchPartyFallbackOverview() {
  return {
    heroPosters: [],
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
    inviteLink: "",
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

function normalizeRoomId(roomId) {
  return String(roomId ?? "")
    .trim()
    .replace(/^id/i, "")
    .replace(/^\/+|\/+$/g, "");
}

function normalizeText(value) {
  return String(value || "").trim();
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

import { apiService } from "./api.js";

const STORAGE_KEY = "vkino_watch_party_rooms";

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
    { value: "friends", label: "Только по ссылке", selected: true },
    { value: "private", label: "Приватная", selected: false },
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
}

export function buildWatchPartyRoomPath(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId) || "1";
  return `/watch-party/id${encodeURIComponent(normalizedRoomId)}`;
}

export function buildWatchPartyFallbackOverview() {
  const localRooms = listLocalWatchPartyRooms();
  const featuredFromLocal = localRooms.slice(0, 3).map((room) => {
    return mapLocalRoomToFeaturedRoom(room);
  });

  return {
    heroPosters: FALLBACK_OVERVIEW.heroPosters.map((item) => ({ ...item })),
    visibilityOptions: FALLBACK_OVERVIEW.visibilityOptions.map((item) => ({
      ...item,
    })),
    featuredRooms: featuredFromLocal.length
      ? featuredFromLocal
      : FALLBACK_OVERVIEW.featuredRooms.map((item) => ({ ...item })),
    myRooms: localRooms.map((room) => mapLocalRoomToMyRoom(room)),
  };
}

export function buildWatchPartyFallbackRoom(roomId = "") {
  const normalizedRoomId = normalizeRoomId(roomId) || "31";
  const localRoom = getLocalWatchPartyRoom(normalizedRoomId);

  if (localRoom) {
    return localRoom;
  }

  const roomNumber = Number.parseInt(normalizedRoomId, 10);
  const suffix = Number.isFinite(roomNumber) ? roomNumber : 31;
  const hostName = suffix % 2 === 0 ? "Мария В." : "Алексей К.";
  const movieTitle = suffix % 2 === 0 ? "Джокер" : "Интерстеллар";
  const movieYear = suffix % 2 === 0 ? "2019" : "2014";
  const movieSubtitle =
    suffix % 2 === 0
      ? "Todd Phillips · Crime · 2h 2m"
      : "Christopher Nolan · Sci-Fi · 2h 49m";
  const backdropUrl =
    suffix % 2 === 0 ? "/img/joker.jpeg" : "/img/cards/interstellar.webp";
  const roomName = suffix % 2 === 0 ? "Киноклуб пятницы" : "Комната Алексея";

  return {
    id: normalizedRoomId,
    roomName,
    participantsCount: 5,
    participantsLabel: "5 участников",
    progressLabel: suffix % 2 === 0 ? "1:12:08" : "45:12",
    liveLabel: "LIVE",
    privacyLabel: suffix % 2 === 0 ? "Открытая" : "Только по ссылке",
    inviteLink: buildWatchPartyRoomPath(normalizedRoomId),
    hostName,
    roomNote:
      "Ставки теперь живут в чате. Нажмите на плюс возле поля ввода, чтобы создать новую.",
    movie: {
      title: movieTitle,
      year: movieYear,
      subtitle: movieSubtitle,
      backdropUrl,
    },
    playerSource: {
      movieId: "",
      episodeId: "",
      playbackUrl: "",
      durationSeconds: 0,
      positionSeconds: 0,
      episodeTitle: movieTitle,
      description: movieSubtitle,
      posterUrl: backdropUrl,
    },
    player: {
      isPlaying: false,
      progressPercent: suffix % 2 === 0 ? 58 : 27,
      currentTimeLabel: suffix % 2 === 0 ? "1:12:08" : "45:12",
      totalTimeLabel: suffix % 2 === 0 ? "2:02:00" : "2:49:00",
      volumePercent: 65,
      qualityLabel: "1080p",
      syncLabel: "Синхронизировать",
    },
    viewer: {
      name: "Вы",
      initial: "В",
      avatarTint: pickAvatarTint("viewer"),
    },
    members: [
      {
        id: "host",
        name: hostName,
        initial: hostName.charAt(0).toUpperCase(),
        avatarTint: pickAvatarTint(hostName),
        isHost: true,
        isYou: false,
        statusText: "",
        statusColor: "#2b9c5a",
      },
      {
        id: "viewer",
        name: "Вы",
        initial: "В",
        avatarTint: pickAvatarTint("viewer"),
        isHost: false,
        isYou: true,
        statusText: "",
        statusColor: "#2b9c5a",
      },
      {
        id: "guest-1",
        name: "Дмитрий",
        initial: "Д",
        avatarTint: pickAvatarTint("Дмитрий"),
        isHost: false,
        isYou: false,
        statusText: "",
        statusColor: "#2b9c5a",
      },
      {
        id: "guest-2",
        name: "Светлана",
        initial: "С",
        avatarTint: pickAvatarTint("Светлана"),
        isHost: false,
        isYou: false,
        statusText: "отошла",
        statusColor: "#888888",
      },
      {
        id: "guest-3",
        name: "Игорь Т.",
        initial: "И",
        avatarTint: pickAvatarTint("Игорь Т."),
        isHost: false,
        isYou: false,
        statusText: "",
        statusColor: "#2b9c5a",
      },
    ],
    messages: [
      {
        id: "message-1",
        isBet: false,
        authorName: hostName,
        authorInitial: hostName.charAt(0).toUpperCase(),
        authorTint: pickAvatarTint(hostName),
        timeLabel: "20:14",
        text: "Я открыл комнату. Если захотите ставку, создавайте через плюсик в чате.",
        reactionText: "🔥 4",
      },
      {
        id: "bet-1",
        isBet: true,
        authorName: hostName,
        authorInitial: hostName.charAt(0).toUpperCase(),
        authorTint: pickAvatarTint(hostName),
        timeLabel: "20:18",
        question: "Выживет ли Купер после прохождения через червоточину?",
        metaText: `Создал ${hostName} · 18 голосов`,
        voteCount: 18,
        selectionText: "Ваш выбор: Да, выживет",
        options: [
          { id: "bet-1-option-1", label: "Да, выживет и вернётся", votes: 11, isSelected: true },
          { id: "bet-1-option-2", label: "Нет, погибнет", votes: 5, isSelected: false },
          {
            id: "bet-1-option-3",
            label: "Застрянет в другом измерении",
            votes: 2,
            isSelected: false,
          },
        ],
      },
      {
        id: "message-2",
        isBet: false,
        authorName: "Дмитрий",
        authorInitial: "Д",
        authorTint: pickAvatarTint("Дмитрий"),
        timeLabel: "20:21",
        text: "Список участников и чат сейчас скрыты, но открываются кнопками в шапке.",
        reactionText: "",
      },
    ],
  };
}

export function listLocalWatchPartyRooms() {
  return readLocalRooms();
}

export function getLocalWatchPartyRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);

  if (!normalizedRoomId) {
    return null;
  }

  const room = readLocalRooms().find((item) => item.id === normalizedRoomId);
  return room ? cloneValue(room) : null;
}

export function saveLocalWatchPartyRoom(room) {
  const normalizedRoom = sanitizeRoom(room);

  if (!normalizedRoom) {
    return null;
  }

  const rooms = readLocalRooms().filter((item) => item.id !== normalizedRoom.id);
  rooms.unshift(normalizedRoom);
  writeLocalRooms(rooms.slice(0, 20));
  return cloneValue(normalizedRoom);
}

export function deleteLocalWatchPartyRoom(roomId) {
  const normalizedRoomId = normalizeRoomId(roomId);

  if (!normalizedRoomId) {
    return;
  }

  const nextRooms = readLocalRooms().filter((item) => item.id !== normalizedRoomId);
  writeLocalRooms(nextRooms);
}

export const watchPartyService = new WatchPartyService(apiService);

function mapLocalRoomToFeaturedRoom(room) {
  const participantsCount = normalizeCount(room.participantsCount);

  return {
    id: room.id,
    title: room.roomName || "Комната",
    hostName: room.hostName || "Хозяин комнаты",
    movieTitle: room.movie?.title || "Фильм",
    membersCount: participantsCount,
    privacyLabel: room.privacyLabel || "Только по ссылке",
    progressLabel: room.player?.currentTimeLabel || room.progressLabel || "0:00",
    isLive: Boolean(room.liveLabel),
    roomHref: buildWatchPartyRoomPath(room.id),
  };
}

function mapLocalRoomToMyRoom(room) {
  const participantsCount = normalizeCount(room.participantsCount);

  return {
    id: room.id,
    title: room.roomName || "Комната",
    statusLabel: room.liveLabel || "Ожидает",
    statusTone: room.liveLabel ? "live" : "waiting",
    meta: `${room.movie?.title || "Фильм"} · ${participantsCount} ${pluralizeParticipants(participantsCount)}`,
    roomLink: buildWatchPartyRoomPath(room.id),
    imageUrl: room.movie?.backdropUrl || "/img/65.jpg",
  };
}

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

function readLocalRooms() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => sanitizeRoom(item))
      .filter(Boolean)
      .map((item) => cloneValue(item));
  } catch {
    return [];
  }
}

function writeLocalRooms(rooms) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    return;
  }
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

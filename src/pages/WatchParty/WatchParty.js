import BasePage from "@/pages/BasePage.js";
import "@/pages/WatchParty/WatchParty.precompiled.js";
import "@/css/watch-party.scss";

import HeaderComponent from "@/components/Header/Header.js";
import {
  buildWatchPartyFallbackOverview,
  watchPartyService,
} from "@/js/WatchPartyService.js";
import {
  extractWatchPartyOverview,
  extractWatchPartyRoom,
} from "@/utils/apiResponse.js";

const HERO_COPY = {
  heroEyebrow: "Совместный просмотр",
  heroTitle: "Смотрите вместе с друзьями",
  heroSubtitle: "Одна комната, один таймлайн, одни эмоции.",
  heroDescription:
    "Создайте комнату, настройте доступ и делитесь ссылкой без лишних препятствий.",
};

export default class WatchPartyPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "WatchPartyPage: не передан корневой элемент для WatchPartyPage",
      );
    }

    const fallbackData = buildWatchPartyFallbackOverview();
    const initialUiState = {
      isLoading: true,
      errorMessage: "",
      statusMessage: "",
      statusTone: "info",
    };

    super(
      {
        ...buildPageContext(fallbackData, initialUiState),
        ...context,
      },
      Handlebars.templates["WatchParty.hbs"],
      parent,
      el,
      "WatchPartyPage",
    );

    this._contextLoaded = false;
    this._pageData = fallbackData;
    this._uiState = initialUiState;
    this._nextRoomIndex = 1;
  }

  init() {
    super.init();

    if (!this._contextLoaded && this._uiState.isLoading) {
      this.loadContext();
    }

    return this;
  }

  async loadContext({ showLoading = false } = {}) {
    if (showLoading) {
      this._refreshView({
        isLoading: true,
        errorMessage: "",
      });
    }

    const fallbackData = buildWatchPartyFallbackOverview();
    const { ok, status, resp, error } = await watchPartyService.getOverview();

    if (!ok) {
      console.error("WatchPartyPage: не удалось загрузить overview", {
        status,
        error,
        resp,
      });
    }

    this._pageData = mapOverviewToPageData(
      ok ? extractWatchPartyOverview(resp) : {},
      fallbackData,
    );
    this._contextLoaded = true;
    this._syncNextRoomIndex();

    this._refreshView({
      isLoading: false,
      errorMessage: ok
        ? ""
        : "Не удалось загрузить данные с сервера. Показаны заглушки.",
    });
  }

  addEventListeners() {
    this.el.addEventListener("click", this._onClick);
    this.el.addEventListener("submit", this._onSubmit);
  }

  removeEventListeners() {
    if (!this.el) {
      return;
    }

    this.el.removeEventListener("click", this._onClick);
    this.el.removeEventListener("submit", this._onSubmit);
  }

  setupChildren() {
    const header = this.el.querySelector("#header");

    if (!header) {
      throw new Error(
        "WatchPartyPage: не найден header в шаблоне WatchParty.hbs",
      );
    }

    this.addChild("header", new HeaderComponent({}, this, header));
  }

  _onClick = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    switch (actionTarget.dataset.action) {
      case "retry-overview":
        event.preventDefault();
        await this.loadContext({ showLoading: true });
        break;
      case "scroll-to-section":
        event.preventDefault();
        this._scrollToSection(actionTarget.dataset.target);
        break;
      case "copy-link":
        event.preventDefault();
        await this._copyRoomLink(actionTarget.dataset.link || "");
        break;
      case "delete-room":
        event.preventDefault();
        await this._deleteRoom(
          actionTarget.dataset.roomId || "",
          actionTarget.dataset.roomTitle || "Комната",
        );
        break;
      case "join-featured-room":
      case "open-my-room":
        event.preventDefault();
        this._setStatus(
          `Комната «${actionTarget.dataset.roomTitle || "Совместный просмотр"}» готова к запуску.`,
          "success",
        );
        break;
      default:
        break;
    }
  };

  _onSubmit = async (event) => {
    const actionTarget = event.target.closest("[data-action]");

    if (!actionTarget) {
      return;
    }

    switch (actionTarget.dataset.action) {
      case "create-room":
        event.preventDefault();
        await this._handleCreateRoom(actionTarget);
        break;
      case "join-room":
        event.preventDefault();
        await this._handleJoinRoom(actionTarget);
        break;
      default:
        break;
    }
  };

  async _handleCreateRoom(form) {
    const formData = new FormData(form);
    const roomName = normalizeText(formData.get("roomName"));
    const visibility = normalizeText(formData.get("visibility"));

    if (!roomName) {
      this._setStatus("Введите название комнаты, чтобы продолжить.", "error");
      return;
    }

    const visibilityLabel = resolveVisibilityLabel(
      visibility,
      this._pageData.visibilityOptions,
    );
    const fallbackRoom = buildLocalRoomDraft({
      roomId: `my-${this._nextRoomIndex}`,
      roomName,
      visibilityLabel,
    });

    const result = await watchPartyService.createRoom({
      name: roomName,
      visibility,
    });

    const nextRoom = result.ok
      ? mapMyRoomDto(extractWatchPartyRoom(result.resp), fallbackRoom)
      : fallbackRoom;

    this._pageData = {
      ...this._pageData,
      myRooms: [nextRoom, ...this._pageData.myRooms],
    };
    this._syncNextRoomIndex();
    this._refreshView({
      statusMessage: result.ok
        ? `Комната «${roomName}» создана.`
        : "Ручка создания комнаты пока недоступна. Добавлена локальная заглушка.",
      statusTone: result.ok ? "success" : "info",
    });
    form.reset();
  }

  async _handleJoinRoom(form) {
    const formData = new FormData(form);
    const inviteLink = normalizeText(formData.get("inviteLink"));

    if (!inviteLink) {
      this._setStatus("Добавьте ссылку-приглашение для входа в комнату.", "error");
      return;
    }

    const result = await watchPartyService.joinRoom({
      invite_link: inviteLink,
    });

    this._setStatus(
      result.ok
        ? "Ссылка принята. Комната готова к совместному просмотру."
        : "Проверка ссылки будет доступна после подключения backend-ручки.",
      result.ok ? "success" : "info",
    );
    form.reset();
  }

  async _copyRoomLink(link) {
    if (!link) {
      this._setStatus("Не удалось получить ссылку для копирования.", "error");
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        this._setStatus(`Скопируйте ссылку вручную: ${link}`, "info");
        return;
      }

      await navigator.clipboard.writeText(link);
      this._setStatus("Ссылка на комнату скопирована.", "success");
    } catch {
      this._setStatus(`Скопируйте ссылку вручную: ${link}`, "info");
    }
  }

  async _deleteRoom(roomId, roomTitle) {
    const normalizedRoomId = normalizeText(roomId);
    const nextRooms = this._pageData.myRooms.filter((room) => {
      return normalizeText(room?.id) !== normalizedRoomId;
    });

    if (nextRooms.length === this._pageData.myRooms.length) {
      this._setStatus("Комната уже удалена или недоступна.", "error");
      return;
    }

    const result = await watchPartyService.deleteRoom(normalizedRoomId);

    this._pageData = {
      ...this._pageData,
      myRooms: nextRooms,
    };
    this._syncNextRoomIndex();
    this._refreshView({
      statusMessage: result.ok
        ? `Комната «${roomTitle}» удалена.`
        : "Удаление выполнено локально. После подключения ручки действие уйдёт на backend.",
      statusTone: result.ok ? "success" : "info",
    });
  }

  _scrollToSection(targetId) {
    const section = this.el.querySelector(`#${targetId}`);

    section?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  _setStatus(message, tone) {
    this._refreshView({
      statusMessage: message,
      statusTone: tone,
    });
  }

  _refreshView(overrides = {}) {
    this._uiState = {
      ...this._uiState,
      ...overrides,
    };

    this.refresh(buildPageContext(this._pageData, this._uiState));
  }

  _syncNextRoomIndex() {
    this._nextRoomIndex = this._pageData.myRooms.length + 1;
  }
}

function buildPageContext(pageData, uiState) {
  return {
    ...HERO_COPY,
    isLoading: uiState.isLoading,
    errorMessage: uiState.errorMessage,
    statusMessage: uiState.statusMessage,
    statusTone: uiState.statusTone,
    featuredRoomsOnlineLabel: `${pageData.featuredRooms.length} ${pluralizeRooms(pageData.featuredRooms.length)} онлайн`,
    featuredRoomsUnavailableText:
      "Невозможно получить данные о комнатах прямо сейчас.",
    myRoomsCountLabel: `${pageData.myRooms.length} ${pluralizeRooms(pageData.myRooms.length)}`,
    heroPosters: pageData.heroPosters,
    visibilityOptions: pageData.visibilityOptions,
    featuredRooms: pageData.featuredRooms,
    myRooms: pageData.myRooms,
  };
}

function mapOverviewToPageData(overview, fallbackData) {
  const normalizedOverview =
    overview && typeof overview === "object" && !Array.isArray(overview)
      ? overview
      : {};

  const heroSource =
    readObject(normalizedOverview, ["hero", "hero_block"]) || normalizedOverview;

  return {
    heroPosters: mapHeroPosters(
      readArray(heroSource, ["posters", "heroPosters", "hero_posters"]) ||
        readArray(normalizedOverview, ["heroPosters", "hero_posters"]),
      fallbackData.heroPosters,
    ),
    visibilityOptions: mapVisibilityOptions(
      readArray(normalizedOverview, [
        "visibilityOptions",
        "visibility_options",
        "roomVisibilityOptions",
        "room_visibility_options",
      ]),
      fallbackData.visibilityOptions,
    ),
    featuredRooms: mapFeaturedRooms(
      readArray(normalizedOverview, [
        "featuredRooms",
        "featured_rooms",
        "onlineRooms",
        "online_rooms",
        "rooms",
      ]),
      fallbackData.featuredRooms,
    ),
    myRooms: mapMyRooms(
      readArray(normalizedOverview, [
        "myRooms",
        "my_rooms",
        "ownedRooms",
        "owned_rooms",
      ]),
    ),
  };
}

function mapHeroPosters(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  return items.slice(0, 4).map((item, index) => {
    const fallback = fallbackItems[index % fallbackItems.length];

    return {
      id: normalizeText(item?.id) || fallback.id,
      title: normalizeText(item?.title || item?.name) || fallback.title,
      label:
        normalizeText(item?.label || item?.badge || item?.genre) ||
        fallback.label,
      imageUrl: resolveImageUrl(item, fallback.imageUrl),
    };
  });
}

function mapVisibilityOptions(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return fallbackItems.map((item) => ({ ...item }));
  }

  const options = items.map((item, index) => ({
    value:
      normalizeText(item?.value || item?.id || item?.key) ||
      fallbackItems[index % fallbackItems.length].value,
    label:
      normalizeText(item?.label || item?.title || item?.name) ||
      fallbackItems[index % fallbackItems.length].label,
    selected: Boolean(item?.selected ?? item?.default ?? index === 0),
  }));

  if (!options.some((item) => item.selected) && options[0]) {
    options[0].selected = true;
  }

  return options;
}

function mapFeaturedRooms(items, fallbackItems) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.slice(0, 6).map((item, index) =>
    mapFeaturedRoomDto(item, fallbackItems[index % fallbackItems.length]),
  );
}

function mapFeaturedRoomDto(item, fallback) {
  const viewersCount = normalizeCount(
    item?.viewersCount ??
      item?.viewers_count ??
      item?.participantsCount ??
      item?.participants_count ??
      item?.viewers,
  );

  return {
    id: normalizeText(item?.id || item?.roomId || item?.room_id) || fallback.id,
    title: normalizeText(item?.title || item?.name) || fallback.title,
    hostName:
      normalizeText(
        item?.hostName ||
          item?.host_name ||
          item?.ownerName ||
          item?.owner_name ||
          item?.host?.name,
      ) || fallback.hostName,
    viewersLabel: `${viewersCount} ${pluralizeViewers(viewersCount)}`,
    progress: clampProgress(
      item?.progress ??
        item?.watchProgress ??
        item?.watch_progress ??
        fallback.progress,
    ),
    isLive: resolveLiveFlag(item, fallback.isLive),
    roomLink:
      normalizeText(
        item?.roomLink || item?.room_link || item?.inviteLink || item?.invite_link,
      ) || fallback.roomLink,
    imageUrl: resolveImageUrl(item, fallback.imageUrl),
  };
}

function mapMyRooms(items) {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.map((item, index) =>
    mapMyRoomDto(item, buildLocalRoomDraft({ roomId: `remote-${index + 1}` })),
  );
}

function mapMyRoomDto(item, fallback) {
  const participantsCount = normalizeCount(
    item?.participantsCount ?? item?.participants_count ?? item?.membersCount,
  );
  const createdAt = normalizeText(
    item?.createdAt || item?.created_at || item?.date,
  );
  const normalizedStatus = normalizeStatus(item?.status);

  return {
    id: normalizeText(item?.id || item?.roomId || item?.room_id) || fallback.id,
    title: normalizeText(item?.title || item?.name) || fallback.title,
    statusLabel: normalizedStatus.label || fallback.statusLabel,
    statusTone: normalizedStatus.tone || fallback.statusTone,
    meta:
      normalizeText(item?.meta) ||
      buildRoomMeta(createdAt, participantsCount) ||
      fallback.meta,
    roomLink:
      normalizeText(
        item?.roomLink || item?.room_link || item?.inviteLink || item?.invite_link,
      ) || fallback.roomLink,
    imageUrl: resolveImageUrl(item, fallback.imageUrl),
  };
}

function buildLocalRoomDraft({
  roomId = "",
  roomName = "Новая комната",
  visibilityLabel = "Только по ссылке",
} = {}) {
  return {
    id: roomId || `local-${Date.now()}`,
    title: roomName,
    statusLabel: "Ожидает",
    statusTone: "waiting",
    meta: `Новая комната · ${visibilityLabel}`,
    roomLink: `https://vkino.ru/watch-party/${slugify(roomName) || "room"}`,
    imageUrl: "/img/65.jpg",
  };
}

function buildRoomMeta(createdAt, participantsCount) {
  const parts = [];

  if (createdAt) {
    parts.push(createdAt);
  }

  if (participantsCount > 0) {
    parts.push(`${participantsCount} ${pluralizeParticipants(participantsCount)}`);
  }

  return parts.join(" · ");
}

function resolveVisibilityLabel(value, options) {
  const matched = options.find((option) => option.value === value);
  return matched?.label || "Только по ссылке";
}

function resolveImageUrl(item, fallback) {
  return (
    normalizeText(
      item?.imageUrl ||
        item?.image_url ||
        item?.posterUrl ||
        item?.poster_url ||
        item?.coverUrl ||
        item?.cover_url,
    ) || fallback
  );
}

function resolveLiveFlag(item, fallback) {
  if (typeof item?.isLive === "boolean") {
    return item.isLive;
  }

  if (typeof item?.live === "boolean") {
    return item.live;
  }

  const normalizedStatus = normalizeText(item?.status).toLowerCase();

  if (normalizedStatus === "live" || normalizedStatus === "active") {
    return true;
  }

  if (normalizedStatus === "waiting" || normalizedStatus === "pending") {
    return false;
  }

  return fallback;
}

function normalizeStatus(value) {
  const normalizedValue = normalizeText(value).toLowerCase();

  switch (normalizedValue) {
    case "live":
    case "active":
      return { label: "LIVE", tone: "live" };
    case "waiting":
    case "pending":
      return { label: "Ожидает", tone: "waiting" };
    default:
      return { label: "", tone: "" };
  }
}

function normalizeCount(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function clampProgress(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(Math.max(parsed, 0), 100);
}

function readArray(source, keys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    const candidate = source[key];

    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function readObject(source, keys) {
  if (!source || typeof source !== "object") {
    return null;
  }

  for (const key of keys) {
    const candidate = source[key];

    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function pluralizeRooms(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "комната";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "комнаты";
  }

  return "комнат";
}

function pluralizeViewers(count) {
  if (count % 10 === 1 && count % 100 !== 11) {
    return "зритель";
  }

  if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
    return "зрителя";
  }

  return "зрителей";
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

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

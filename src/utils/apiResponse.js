export function unwrapPayload(payload) {
  if (payload == null) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object") {
    return payload;
  }

  const directCandidates = [
    payload.data,
    payload.result,
    payload.response,
    payload.payload,
  ];

  for (const candidate of directCandidates) {
    if (candidate !== undefined) {
      return unwrapPayload(candidate);
    }
  }

  return payload;
}

export function extractSelections(payload) {
  const unwrapped = unwrapPayload(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped;
  }

  if (!unwrapped || typeof unwrapped !== "object") {
    return [];
  }

  const candidates = [
    unwrapped.selections,
    unwrapped.Selections,
    unwrapped.items,
    unwrapped.Items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

export function extractActor(payload) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object") {
    return null;
  }

  const candidates = [
    unwrapped.actor,
    unwrapped.Actor,
    unwrapped.item,
    unwrapped.Item,
    unwrapped,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function extractMovie(payload) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object") {
    return null;
  }

  const candidates = [
    unwrapped.movie,
    unwrapped.Movie,
    unwrapped.item,
    unwrapped.Item,
    unwrapped,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function extractProfile(payload) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object") {
    return {};
  }

  const candidates = [
    unwrapped.user,
    unwrapped.User,
    unwrapped.profile,
    unwrapped.Profile,
    unwrapped.me,
    unwrapped.Me,
    unwrapped,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return {};
}

export function extractWatchPartyOverview(payload) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object" || Array.isArray(unwrapped)) {
    return {};
  }

  const candidates = [
    unwrapped.overview,
    unwrapped.Overview,
    unwrapped.watchParty,
    unwrapped.watch_party,
    unwrapped.page,
    unwrapped.Page,
    unwrapped,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return {};
}

export function extractWatchPartyRoom(payload) {
  const unwrapped = unwrapPayload(payload);

  if (!unwrapped || typeof unwrapped !== "object" || Array.isArray(unwrapped)) {
    return null;
  }

  const candidates = [
    unwrapped.room,
    unwrapped.Room,
    unwrapped.createdRoom,
    unwrapped.created_room,
    unwrapped.item,
    unwrapped.Item,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return null;
}

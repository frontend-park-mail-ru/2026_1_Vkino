import { isRecord } from "@/types/shared.ts";
import type { MovieSelectionDto, ActorDto, MovieDto } from "@/types/movie.ts";
import type { UserProfileDto } from "@/types/user.ts";
import type {
  WatchPartyOverviewDto,
  WatchPartyRoomDto,
} from "@/types/watchParty.ts";

export function unwrapPayload(payload: unknown): unknown {
  if (payload == null) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isRecord(payload)) {
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

export function extractSelections(payload: unknown): MovieSelectionDto[] {
  const unwrapped = unwrapPayload(payload);

  if (Array.isArray(unwrapped)) {
    return unwrapped as MovieSelectionDto[];
  }

  if (!isRecord(unwrapped)) {
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
      return candidate as MovieSelectionDto[];
    }
  }

  return [];
}

export function extractActor(payload: unknown): ActorDto | null {
  const unwrapped = unwrapPayload(payload);
  return pickRecordCandidate<ActorDto>(unwrapped, [
    "actor",
    "Actor",
    "item",
    "Item",
  ]);
}

export function extractMovie(payload: unknown): MovieDto | null {
  const unwrapped = unwrapPayload(payload);
  return pickRecordCandidate<MovieDto>(unwrapped, [
    "movie",
    "Movie",
    "item",
    "Item",
  ]);
}

export function extractProfile(payload: unknown): UserProfileDto {
  const unwrapped = unwrapPayload(payload);

  if (!isRecord(unwrapped)) {
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
    if (isRecord(candidate)) {
      return candidate as UserProfileDto;
    }
  }

  return {};
}

export function extractWatchPartyOverview(
  payload: unknown,
): WatchPartyOverviewDto {
  const unwrapped = unwrapPayload(payload);

  if (!isRecord(unwrapped)) {
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
    if (isRecord(candidate)) {
      return candidate as WatchPartyOverviewDto;
    }
  }

  return {};
}

export function extractWatchPartyRoom(
  payload: unknown,
): WatchPartyRoomDto | null {
  const unwrapped = unwrapPayload(payload);
  return pickRecordCandidate<WatchPartyRoomDto>(unwrapped, [
    "room",
    "Room",
    "createdRoom",
    "created_room",
    "item",
    "Item",
  ]);
}

function pickRecordCandidate<T extends object>(
  unwrapped: unknown,
  keys: string[],
): T | null {
  if (!isRecord(unwrapped)) {
    return null;
  }

  const candidates: unknown[] = [...keys.map((key) => unwrapped[key]), unwrapped];

  for (const candidate of candidates) {
    if (isRecord(candidate)) {
      return candidate as T;
    }
  }

  return null;
}

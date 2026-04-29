import type { AnyRecord, EntityId } from "@/types/shared.ts";

export interface WatchPartyOverviewDto extends AnyRecord {
  heroPosters?: AnyRecord[];
  visibilityOptions?: AnyRecord[];
  featuredRooms?: AnyRecord[];
  myRooms?: AnyRecord[];
}

export interface WatchPartyRoomDto extends AnyRecord {
  id?: EntityId;
  roomName?: string;
  roomNote?: string;
  playerSource?: AnyRecord;
  movie?: AnyRecord;
  viewer?: AnyRecord;
  members?: AnyRecord[];
  messages?: AnyRecord[];
}

export interface CreateWatchPartyRoomPayload extends AnyRecord {
  room_name?: string;
  visibility?: string;
  movie_id?: EntityId;
  invite_link?: string;
}

export interface JoinWatchPartyRoomPayload extends AnyRecord {
  room_id?: EntityId;
  invite_link?: string;
}

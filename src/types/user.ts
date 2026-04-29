import type { AnyRecord, EntityId } from "@/types/shared.ts";

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials extends AuthCredentials {
  name?: string;
}

export interface UserProfileDto extends AnyRecord {
  id?: EntityId;
  user_id?: EntityId;
  email?: string;
  role?: string;
  name?: string;
  birthdate?: string;
  birth_date?: string;
  avatar_url?: string;
  avatarUrl?: string;
  avatar_file_key?: string;
  avatarFileKey?: string;
  created_at?: string;
}

export interface AuthTokenPayload extends AnyRecord {
  access_token?: string;
  Error?: string;
  message?: string;
}

export interface ToggleFavoriteResponse extends AnyRecord {
  is_favorite?: boolean;
  isFavorite?: boolean;
}

export interface UserCollectionResponse<TItem extends AnyRecord = AnyRecord>
  extends AnyRecord {
  items?: TItem[];
  users?: TItem[];
  friends?: TItem[];
  requests?: TItem[];
}

export interface FriendRequestDto extends UserProfileDto {
  to_user_id?: EntityId;
  from_user_id?: EntityId;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface FriendRequestQuery {
  direction?: "incoming" | "outgoing" | string;
  limit?: number;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface SearchUsersQuery {
  limit?: number;
}

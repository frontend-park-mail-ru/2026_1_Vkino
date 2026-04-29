import { ApiService, apiService, createApiErrorResult } from "./api.ts";
import type { ApiResult } from "./api.ts";
import type { EntityId } from "@/types/shared.ts";
import type {
  AuthCredentials,
  AuthTokenPayload,
  ChangePasswordPayload,
  FriendRequestDto,
  FriendRequestQuery,
  PaginationQuery,
  SearchUsersQuery,
  SignUpCredentials,
  ToggleFavoriteResponse,
  UserCollectionResponse,
  UserProfileDto,
} from "@/types/user.ts";

/**
 * Сервис авторизации. Надстройка над ApiService.
 * Управляет ручками, связанными с авторизацией, профилем и друзьями.
 */
export class UserService {
  private apiRoot: ApiService;
  private api: ApiService;

  constructor(apiServiceInstance: ApiService) {
    this.apiRoot = apiServiceInstance;
    this.api = apiServiceInstance.withNamespace("/user");
  }

  private _saveAccessToken(result: ApiResult<AuthTokenPayload>): void {
    const accessToken = result?.resp?.access_token;

    if (result.ok && accessToken) {
      this.apiRoot.setAccessToken(accessToken);
    }
  }

  private _clearSessionLocal(): void {
    this.apiRoot.clearAccessToken();
  }

  getAccessToken(): string | null {
    return this.apiRoot.getAccessToken();
  }

  clearAccessToken(): void {
    this._clearSessionLocal();
  }

  async signIn(
    authUserData: AuthCredentials,
  ): Promise<ApiResult<AuthTokenPayload>> {
    const result = await this.api.post<AuthTokenPayload>("/sign-in", authUserData);
    this._saveAccessToken(result);
    return result;
  }

  async signUp(
    authUserData: SignUpCredentials,
  ): Promise<ApiResult<AuthTokenPayload>> {
    const result = await this.api.post<AuthTokenPayload>("/sign-up", authUserData);
    this._saveAccessToken(result);
    return result;
  }

  async refresh(): Promise<ApiResult<AuthTokenPayload>> {
    const result = await this.api.post<AuthTokenPayload>("/refresh");
    this._saveAccessToken(result);

    if (!result.ok && shouldClearSessionAfterRefreshFailure(result.status)) {
      this._clearSessionLocal();
    }

    return result;
  }

  async me(): Promise<ApiResult<UserProfileDto>> {
    return this.api.get<UserProfileDto>("/me");
  }

  async logout(): Promise<ApiResult<AuthTokenPayload>> {
    const result = await this.api.post<AuthTokenPayload>("/logout");
    this._clearSessionLocal();
    return result;
  }

  async updateProfile(
    birthdate: string | null,
    avatarFile: File | null = null,
  ): Promise<ApiResult<UserProfileDto>> {
    const formData = new FormData();

    if (birthdate !== null && birthdate !== undefined) {
      formData.append("birthdate", String(birthdate));
    }

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    return this.api.put<UserProfileDto>("/profile", formData);
  }

  async changePassword(
    payload: ChangePasswordPayload,
  ): Promise<ApiResult<AuthTokenPayload>> {
    return this.api.post<AuthTokenPayload>("/change-password", payload);
  }

  async toggleFavorite(
    movieId: EntityId,
  ): Promise<ApiResult<ToggleFavoriteResponse>> {
    return this.api.put<ToggleFavoriteResponse>(`/favorites/${movieId}`);
  }

  async getFavorites(
    { limit = 10, offset = 0 }: PaginationQuery = {},
  ): Promise<ApiResult<UserCollectionResponse>> {
    return this.api.get<UserCollectionResponse>("/favorites", {
      query: { limit, offset },
    });
  }

  async getContinueWatching(
    { limit = 5 }: Pick<PaginationQuery, "limit"> = {},
  ): Promise<ApiResult<UserCollectionResponse>> {
    return this.api.get<UserCollectionResponse>("/watch/continue", {
      query: { limit },
    });
  }

  async getWatchHistory(
    { limit = 10 }: Pick<PaginationQuery, "limit"> = {},
  ): Promise<ApiResult<UserCollectionResponse>> {
    return this.api.get<UserCollectionResponse>("/watch/history", {
      query: { limit },
    });
  }

  async getWatchRecent(
    { limit = 10 }: Pick<PaginationQuery, "limit"> = {},
  ): Promise<ApiResult<UserCollectionResponse>> {
    return this.api.get<UserCollectionResponse>("/watch/recent", {
      query: { limit },
    });
  }

  async searchUsers(
    query: string,
    { limit = 10 }: SearchUsersQuery = {},
  ): Promise<ApiResult<UserCollectionResponse<UserProfileDto>>> {
    return this.api.get<UserCollectionResponse<UserProfileDto>>("/search", {
      query: { query, limit },
    });
  }

  async sendFriendRequest(
    toUserId: EntityId,
  ): Promise<ApiResult<AuthTokenPayload>> {
    return this.api.post<AuthTokenPayload>(`/friends/${toUserId}`);
  }

  async respondToFriendRequest(
    requestId: EntityId,
    action: "accept" | "decline" | "cancel" | string,
  ): Promise<ApiResult<AuthTokenPayload>> {
    return this.api.post<AuthTokenPayload>(
      `/friends/requests/${requestId}/respond`,
      { action },
    );
  }

  async cancelFriendRequest(
    requestId: EntityId,
  ): Promise<ApiResult<AuthTokenPayload>> {
    return this.api.delete<AuthTokenPayload>(`/friends/requests/${requestId}`);
  }

  async getFriendRequests(
    { direction = "incoming", limit = 50 }: FriendRequestQuery = {},
  ): Promise<ApiResult<UserCollectionResponse<FriendRequestDto>>> {
    return this.api.get<UserCollectionResponse<FriendRequestDto>>(
      "/friends/requests",
      { query: { direction, limit } },
    );
  }

  async getFriendsList(
    { limit = 50, offset = 0 }: PaginationQuery = {},
  ): Promise<ApiResult<UserCollectionResponse<UserProfileDto>>> {
    return this.api.get<UserCollectionResponse<UserProfileDto>>("/friends", {
      query: { limit, offset },
    });
  }

  async deleteFriend(userId: EntityId): Promise<ApiResult<AuthTokenPayload>> {
    const normalizedUserId = String(userId ?? "").trim();

    if (!normalizedUserId) {
      return createApiErrorResult<AuthTokenPayload>({
        error: "UserService: не передан id друга",
      });
    }

    return this.api.delete<AuthTokenPayload>(`/friends/${normalizedUserId}`);
  }
}

export const userService = new UserService(apiService);

function shouldClearSessionAfterRefreshFailure(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

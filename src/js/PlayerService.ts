import { ApiService, apiService, createApiErrorResult } from "./api.ts";
import type { ApiResult } from "./api.ts";
import type { EntityId } from "@/types/shared.ts";
import type { PlaybackDto, ProgressDto } from "@/types/movie.ts";

/**
 * Сервис для playback и прогресса просмотра.
 */
export class PlayerService {
  private api: ApiService;

  constructor(api: ApiService) {
    this.api = api;
  }

  async getEpisodePlayback(
    episodeId: EntityId,
  ): Promise<ApiResult<PlaybackDto>> {
    const normalizedEpisodeId = String(episodeId ?? "").trim();

    if (!normalizedEpisodeId) {
      return createApiErrorResult<PlaybackDto>({
        error: "PlayerService: не передан id эпизода",
      });
    }

    return this.api.get<PlaybackDto>(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/playback`,
    );
  }

  async getEpisodeProgress(
    episodeId: EntityId,
  ): Promise<ApiResult<ProgressDto>> {
    const normalizedEpisodeId = String(episodeId ?? "").trim();

    if (!normalizedEpisodeId) {
      return createApiErrorResult<ProgressDto>({
        error: "PlayerService: не передан id эпизода",
      });
    }

    return this.api.get<ProgressDto>(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/progress`,
    );
  }

  async saveEpisodeProgress(
    episodeId: EntityId,
    positionSeconds: number,
  ): Promise<ApiResult<ProgressDto>> {
    const normalizedEpisodeId = String(episodeId ?? "").trim();
    const normalizedPosition = Math.max(
      0,
      Math.floor(Number(positionSeconds) || 0),
    );

    if (!normalizedEpisodeId) {
      return createApiErrorResult<ProgressDto>({
        error: "PlayerService: не передан id эпизода",
      });
    }

    return this.api.put<ProgressDto>(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/progress`,
      {
        position_seconds: normalizedPosition,
      },
    );
  }
}

export const playerService = new PlayerService(apiService);

import { ApiService, apiService } from "./api.ts";

/**
 * Сервис для playback и прогресса просмотра.
 */
export class PlayerService {
  [key: string]: any;

  constructor(api: ApiService) {
    this.api = api;
  }

  async getEpisodePlayback(episodeId) {
    const normalizedEpisodeId = String(episodeId ?? "").trim();

    if (!normalizedEpisodeId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "PlayerService: не передан id эпизода",
      };
    }

    return this.api.get(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/playback`,
    );
  }

  async getEpisodeProgress(episodeId) {
    const normalizedEpisodeId = String(episodeId ?? "").trim();

    if (!normalizedEpisodeId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "PlayerService: не передан id эпизода",
      };
    }

    return this.api.get(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/progress`,
    );
  }

  async saveEpisodeProgress(episodeId, positionSeconds) {
    const normalizedEpisodeId = String(episodeId ?? "").trim();
    const normalizedPosition = Math.max(
      0,
      Math.floor(Number(positionSeconds) || 0),
    );

    if (!normalizedEpisodeId) {
      return {
        ok: false,
        status: 0,
        resp: null,
        error: "PlayerService: не передан id эпизода",
      };
    }

    const payload = {
      position_seconds: normalizedPosition,
    };
    return this.api.put(
      `/episode/${encodeURIComponent(normalizedEpisodeId)}/progress`,
      payload,
    );
  }
}

export const playerService = new PlayerService(apiService);

import { ApiService, apiService, createApiErrorResult } from "./api.ts";
import type { ApiResult } from "./api.ts";
import type { AnyRecord, EntityId } from "@/types/shared.ts";
import type { ActorDto, MovieDto, MovieSelectionDto } from "@/types/movie.ts";

/**
 * Сервис для работы с фильмами и подборками.
 */
export class MovieService {
  private api: ApiService;
  private rootApi: ApiService;

  constructor(apiServiceInstance: ApiService) {
    this.api = apiServiceInstance.withNamespace("movie");
    this.rootApi = apiServiceInstance;
  }

  async getAllSelections(): Promise<ApiResult<MovieSelectionDto[]>> {
    return this.api.get<MovieSelectionDto[]>(`/selection/all`);
  }

  async getSelectionByTitle(
    title: string,
  ): Promise<ApiResult<MovieSelectionDto>> {
    const normalizedTitle = String(title ?? "").trim();

    if (!normalizedTitle) {
      return createApiErrorResult<MovieSelectionDto>({
        error: "MovieService: не передано название подборки",
      });
    }

    return this.api.get<MovieSelectionDto>(
      `/selection/${encodeURIComponent(normalizedTitle)}`,
    );
  }

  async getSelectionsByTitles(
    titles: unknown[] = [],
  ): Promise<ApiResult<MovieSelectionDto[]>> {
    const normalizedTitles = normalizeSelectionTitles(titles);

    if (!normalizedTitles.length) {
      return this.getAllSelections();
    }

    const results = await Promise.all(
      normalizedTitles.map((title) => this.getSelectionByTitle(title)),
    );
    const selections = results.flatMap((result, index) =>
      normalizeSelectionResponse(result.resp, normalizedTitles[index]),
    );

    if (selections.length) {
      return {
        ok: true,
        status: 200,
        resp: selections,
        error: "",
        aborted: false,
        meta: {
          source: "aggregated",
          servedFromCache: results.some((result) => result.meta.servedFromCache),
        },
      };
    }

    const firstFailedResult = results.find((result) => !result.ok);

    return createApiErrorResult<MovieSelectionDto[]>({
      status: firstFailedResult?.status || 0,
      error: firstFailedResult?.error || "Не удалось загрузить подборки",
      source: firstFailedResult?.meta.source || "aggregation-error",
    });
  }

  async getMovieById(id: EntityId): Promise<ApiResult<MovieDto>> {
    const normalizedId = String(id ?? "").trim();

    if (!normalizedId) {
      return createApiErrorResult<MovieDto>({
        error: "MovieService: не передан id фильма",
      });
    }

    return this.api.get<MovieDto>(`/${encodeURIComponent(normalizedId)}`);
  }

  async getActorById(actorId: EntityId): Promise<ApiResult<ActorDto>> {
    const normalizedActorId = String(actorId ?? "").trim();

    if (!normalizedActorId) {
      return createApiErrorResult<ActorDto>({
        error: "MovieService: не передан id актера",
      });
    }

    return this.api.get<ActorDto>(`/actor/${encodeURIComponent(normalizedActorId)}`);
  }
}

export const movieService = new MovieService(apiService);

function normalizeSelectionTitles(titles: unknown[] = []): string[] {
  if (!Array.isArray(titles)) {
    return [];
  }

  return Array.from(
    new Set(
      titles.map((title) => String(title ?? "").trim()).filter(Boolean),
    ),
  );
}

function normalizeSelectionResponse(
  resp: unknown,
  requestedTitle = "",
): MovieSelectionDto[] {
  if (Array.isArray(resp)) {
    return resp
      .map((selection) => normalizeSelection(selection, requestedTitle))
      .filter((selection): selection is MovieSelectionDto => Boolean(selection));
  }

  const normalizedSelection = normalizeSelection(resp, requestedTitle);

  return normalizedSelection ? [normalizedSelection] : [];
}

function normalizeSelection(
  selection: unknown,
  requestedTitle = "",
): MovieSelectionDto | null {
  if (!selection || typeof selection !== "object") {
    return null;
  }

  const normalizedSelection = selection as AnyRecord;

  return {
    ...normalizedSelection,
    title:
      String(normalizedSelection.title || "").trim() ||
      String(normalizedSelection.name || "").trim() ||
      String(requestedTitle || "").trim(),
  };
}

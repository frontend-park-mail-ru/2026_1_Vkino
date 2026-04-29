import type { AnyRecord, EntityId } from "@/types/shared.ts";

export interface EpisodeDto extends AnyRecord {
  id?: EntityId;
  movie_id?: EntityId;
  season_number?: number | string;
  episode_number?: number | string;
  title?: string;
  description?: string;
  duration_seconds?: number | string;
  position_seconds?: number | string;
  img_url?: string;
  playback_url?: string;
}

export interface ActorDto extends AnyRecord {
  id?: EntityId;
  actor_id?: EntityId;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  country_id?: EntityId;
  country_name?: string;
  picture_file_key?: string;
  picture_src?: string;
  img_url?: string;
  photo_url?: string;
  biography?: string;
  birth_date?: string;
}

export interface MovieDto extends AnyRecord {
  id?: EntityId;
  title?: string;
  name?: string;
  description?: string;
  summary?: string;
  short_description?: string;
  director?: string;
  content_type?: string;
  contentType?: string;
  release_year?: number | string;
  duration_seconds?: number | string;
  age_limit?: number | string;
  age_rating?: string;
  ageRating?: string;
  original_language_id?: EntityId;
  country_id?: EntityId;
  genres?: string[] | AnyRecord[];
  genre?: string[] | string;
  img_url?: string;
  poster_url?: string;
  posterUrl?: string;
  backdrop_url?: string;
  backdropUrl?: string;
  imdb_rating?: number | string;
  kp_rating?: number | string;
  imdbRating?: number | string;
  kpRating?: number | string;
  episodes?: EpisodeDto[];
  actors?: ActorDto[];
  cast?: ActorDto[];
  is_favorite?: boolean;
  isFavorite?: boolean;
}

export interface MovieSelectionDto extends AnyRecord {
  title?: string;
  name?: string;
  movies?: MovieDto[];
  Movies?: MovieDto[];
  titles?: MovieDto[];
}

export interface PlaybackDto extends AnyRecord {
  episode_id?: EntityId;
  title?: string;
  playback_url?: string;
  duration_seconds?: number | string;
  position_seconds?: number | string;
}

export interface ProgressDto extends AnyRecord {
  position_seconds?: number | string;
}

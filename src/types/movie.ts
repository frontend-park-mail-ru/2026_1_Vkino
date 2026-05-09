export type ExternalRating = {
  source: string;
  rating: number;
};

export type MovieReview = {
  id: number;
  author_user_id: number;
  author: string;
  rating: number | null;
  comment: string | null;
  likes_count: number;
  dislikes_count: number;
  viewer_reaction: "like" | "dislike" | null;
  created_at: string;
  updated_at: string;
};

export type SetMovieReviewPayload = {
  rating?: number;
  message?: string;
};

export type SetReviewReactionPayload = {
  reaction: "like" | "dislike";
};

import { apiService } from "./api.js";

export class MovieService {
  constructor(apiService) {
    this.api = apiService.withNamespace("movie");
  }

  async getAllSelections() {
    return this.api.get(`/selection/all`);
  }

  async getSelectionByTitle(title) {
    return this.api.get(`/selection/${title}`);
  }
}

export const movieService = new MovieService(apiService);

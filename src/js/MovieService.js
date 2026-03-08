import { apiService } from "./api.js"

export class MovieService {
    constructor (apiService) {
        this.api = apiService
    }

    async getSelectionByTitle(title) {
        return this.api.get(`lists/movies/${title}`)
    }
}

export const movieService = new MovieService(apiService)
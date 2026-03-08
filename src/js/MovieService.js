export class MovieService {
    constructor (apiService) {
        this.api = apiService
    }

    async GetSelectionByTitle(title) {
        return this.api.get(`lists/movies/${title}`)
    }
}


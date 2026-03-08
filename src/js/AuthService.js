export class AuthService {
    constructor (apiService) {
        this.api = apiService
    }

    async logIn(userData) {
        return this.api.post("sign-in", userData)
    }

    async signUp(userData) {
        return this.api.post("sign-up", userData)
    }

    async refresh(userData) {
        return this.api.post("refresh", userData)
    }
}
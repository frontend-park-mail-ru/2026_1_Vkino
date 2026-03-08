import { apiService } from "./api.js"

export class AuthService {
    constructor (apiService) {
        this.api = apiService.withNamespace('auth')
    }

    async signIn(authUserData) {
        return this.api.post("/sign-in", authUserData)
    }

    async signUp(authUserData) {
        return this.api.post("/sign-up", authUserData)
    }

    async refresh(authUserData) {
        return this.api.post("/refresh", authUserData)
    }
}

export const authService = new AuthService(apiService)
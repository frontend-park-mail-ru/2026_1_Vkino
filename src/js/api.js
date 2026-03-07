const BACK_URL = "http://localhost:8080/"

class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl
    }

    async asyncFetch(endpoint, method, data = null) {
        const url = `${this.baseUrl}${endpoint}`

        const fetchParams = {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: "include"
        }

        if (data) {
            fetchParams.body = JSON.stringify(data)
        }

        const resp = await fetch(url, fetchParams)

        const parsedBody = await resp.json();

        return {
            ok: resp.ok,
            status: resp.status,
            resp: parsedBody
        }
    }
    
    get(endpoint) {
        return this.asyncFetch(endpoint, "GET")
    }

    post(endpoint, data) {
        return this.asyncFetch(endpoint, "POST", data);
    }

    put(endpoint, data) {
        return this.asyncFetch(endpoint, "PUT", data);
    }

    delete(endpoint) {
        return this.asyncFetch(endpoint, "DELETE");
    }
}

const apiService = new ApiService(BACK_URL) 

export const signupUser = async (userData) => {
    try {
        const {ok, status, resp} = await apiService.post("sign-up", userData)
        if (ok) {
            //localStorage.setItem("access_token", resp.access_token)
            console.log("Регистрация успешно завершилась")
        } else {
            console.log("Ошибка регистрации:", status, resp)
        }
    } catch (error) {
        console.log("Ошибка fetch или resp.json() ", error)
    }
}

export const signinUser = async (userData) => {
    try {
        const {ok, status, resp} = await apiService.post("sign-in", userData)
        if (ok) {
            //localStorage.setItem("access_token", resp.access_token)
            console.log("Вход успешно завершился")
        } else {
            console.log("Ошибка входа", status, resp)
        }
    } catch (error) {
        console.log("Ошибка fetch или resp.json() ", error)
    }
}

export const refreshUser = async () => {
    try {
        const {ok, status, resp} = await apiService.post("refresh", {})
        if (ok) {
            //localStorage.setItem("access_token", resp.access_token)
            console.log("Access токен обновили")
        } else {
            console.log("Ошибка при refresh", status, resp)
        }
    } catch (error) {
        console.log("Ошибка fetch или resp.json() ", error)
    }
}


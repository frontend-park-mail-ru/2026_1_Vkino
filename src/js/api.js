const BACK_URL = "http://localhost:8080/"

export class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl
    }

    async asyncFetch(endpoint, method, data = null) {
        const url = `${this.baseUrl}${endpoint}`

        const fetchParams = {
            method: method,
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
             },
            credentials: "include"
        }

        if (data) {
            fetchParams.body = JSON.stringify(data)
        }

        let resp

        try {
            resp = await fetch(url, fetchParams)
        } catch (error) {
            return {
                ok: false,
                status: 0,
                resp: {Error: error.message}
            }
        }

        let parsedBody 

        try {
            parsedBody = await resp.json();            
        } catch (error) {
            return {
                ok: false,
                status: resp.status,
                resp: {Error: error.message}
            }
        }

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

export const apiService = new ApiService("http://localhost:8080/")
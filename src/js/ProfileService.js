import { apiService } from "./api.js";

/**
 * Сервис профиля пользователя.
 */
export class ProfileService {
  /**
   * @param {import("./api.js").ApiService} api
   */
  constructor(api) {
    this.api = api.withNamespace("auth");
  }

  /**
   * Обновляет профиль пользователя.
   * Передаёт дату рождения и аватарку одним multipart запросом.
   * @param {string|null} birthdate
   * @param {File|null} avatarFile
   */
  async updateProfile(birthdate, avatarFile = null) {
    const formData = new FormData();

    if (birthdate !== null && birthdate !== undefined) {
      formData.append("birthdate", String(birthdate));
    }

    if (avatarFile) {
      formData.append("avatar", avatarFile);
    }

    return this.api.put("/profile", formData);
  }

  /**
   * Меняет пароль пользователя.
   * @param {{old_password: string, new_password: string}} payload
   */
  async changePassword(payload) {
    return this.api.post("/change-password", payload);
  }
}

export const profileService = new ProfileService(apiService);

import BasePage from "../BasePage.js";
import "./Settings.precompiled.js";

import { attachPageStyles } from "../../utils/pageStyles.js";
import { initPasswordToggle } from "../../js/password/eye-btn.js";
import { setError, validatePassword } from "../../js/password/validation.js";
import { profileService } from "../../js/ProfileService.js";
import { authStore } from "../../store/authStore.js";
import HeaderComponent from "../../components/Header/Header.js";

export default class SettingsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("SettingsPage: не передан корневой элемент для SettingsPage");
    }

    // 🎯 Моки — только в JS
    const mockUserData = {
      email: "saucesamba@example.com",
      birthDate: "2006-01-01", // ISO string
      avatarUrl: "",
    };

    const mockCoinHistory = [
      { date: "13-10-2026", action: "Начисление", amount: "+3", isPositive: true },
      { date: "14-10-2026", action: "Списание", amount: "-3", isPositive: false },
      { date: "13-10-2026", action: "Начисление", amount: "+3", isPositive: true },
      { date: "13-10-2026", action: "Начисление", amount: "+3", isPositive: true },
      { date: "14-10-2026", action: "Списание", amount: "-3", isPositive: false },
      { date: "13-10-2026", action: "Начисление", amount: "+3", isPositive: true },
      { date: "14-10-2026", action: "Списание", amount: "-3", isPositive: false },
      { date: "13-10-2026", action: "Начисление", amount: "+3", isPositive: true },
      { date: "14-10-2026", action: "Списание", amount: "-3", isPositive: false },
      { date: "14-10-2026", action: "Списание", amount: "-3", isPositive: false },
    ];

    const finalContext = {
      userData: mockUserData,
      coinHistory: mockCoinHistory,
      ...context,
    };

    super(
      finalContext,
      Handlebars.templates["Settings.hbs"],
      parent,
      el,
      "SettingsPage",
    );

    this._detachStyles = null;
    this._destroyPasswordToggle = null;
    this._originalValues = {};
    this._editableInputHandlers = new Map();
    this._passwordInputHandlers = new Map();
    this._buttonHandlers = new Map();
    this._avatarInputHandler = null;
    this._pendingAvatarFile = null;
  }

  init() {
    this._detachStyles = attachPageStyles(
      ["/css/main.css", "/css/settings.css"],
      "settings",
    );

    return super.init();
  }

  addEventListeners() {
    this._destroyPasswordToggle = initPasswordToggle(this.el);
    this._setupEditableFields();
    this._setupAvatarUpload();
    this._setupPasswordValidation();
    this._setupButtonHandlers();
    this._checkForChanges();
  }

  _setupEditableFields() {
    const editableInputs = this.el.querySelectorAll(".settings__input_editable");
    editableInputs.forEach((input) => {
      const field = input.dataset.field;
      this._originalValues[field] = input.value;

      const onInput = () => {
        this._checkForChanges();
      };

      input.addEventListener("input", onInput);
      this._editableInputHandlers.set(input, onInput);
    });
  }

  _setupAvatarUpload() {
    const avatarInput = this.el.querySelector("#avatarInput");
    if (!avatarInput) return;

    const onChange = () => {
      const file = avatarInput.files?.[0] || null;
      if (!file) {
        this._pendingAvatarFile = null;
        this._setAvatarError("");
        this._checkForChanges();
        return;
      }

      const validationError = this._validateAvatarFile(file);
      if (validationError) {
        this._pendingAvatarFile = null;
        avatarInput.value = "";
        this._setAvatarError(validationError);
        this._checkForChanges();
        return;
      }

      this._pendingAvatarFile = file;
      this._setAvatarError("");
      this._previewAvatar(file);
      this._checkForChanges();
    };

    avatarInput.addEventListener("change", onChange);
    this._avatarInputHandler = onChange;
  }

  _validateAvatarFile(file) {
    const maxBytes = 5 * 1024 * 1024;
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);

    if (!allowedTypes.has(file.type)) {
      return "Поддерживаются только PNG, JPG и WEBP";
    }
    if (file.size > maxBytes) {
      return "Размер файла должен быть не больше 5MB";
    }
    return "";
  }

  _previewAvatar(file) {
    const avatarPreview = this.el.querySelector('[data-role="avatar-preview"]');
    if (!avatarPreview) return;
    const objectUrl = URL.createObjectURL(file);
    avatarPreview.src = objectUrl;
    avatarPreview.onload = () => URL.revokeObjectURL(objectUrl);
  }

  _setAvatarError(message) {
    const errorEl = this.el.querySelector("#avatar-error");
    if (errorEl) errorEl.textContent = message;
  }

  _setupPasswordValidation() {
    const passwordFields = this._getPasswordFields();

    passwordFields.forEach(({ input }) => {
      if (!input) return;
      const onInputOrBlur = () => {
        this._validatePasswordField(input.id);
        this._updatePasswordButtonState();
      };
      input.addEventListener("input", onInputOrBlur);
      input.addEventListener("blur", onInputOrBlur);
      this._passwordInputHandlers.set(input, onInputOrBlur);
    });

    this._updatePasswordButtonState();
  }

  _getPasswordFields() {
    return [
      { id: "oldPassword", input: this.el.querySelector("#oldPassword"), errorEl: this.el.querySelector("#old-password-error") },
      { id: "newPassword", input: this.el.querySelector("#newPassword"), errorEl: this.el.querySelector("#new-password-error") },
      { id: "confirmPassword", input: this.el.querySelector("#confirmPassword"), errorEl: this.el.querySelector("#confirm-password-error") },
    ];
  }

  _validatePasswordField(fieldId) {
    const old = this.el.querySelector("#oldPassword")?.value || "";
    const newP = this.el.querySelector("#newPassword")?.value || "";
    const conf = this.el.querySelector("#confirmPassword")?.value || "";

    const hasAny = !!old || !!newP || !!conf;

    if (fieldId === "oldPassword") {
      const msg = hasAny && !old ? "Введите текущий пароль" : "";
      setError(this.el.querySelector("#oldPassword"), this.el.querySelector("#old-password-error"), msg);
      return msg;
    }

    if (fieldId === "newPassword") {
      const msg = newP ? validatePassword(newP) : (hasAny ? "Введите новый пароль" : "");
      setError(this.el.querySelector("#newPassword"), this.el.querySelector("#new-password-error"), msg);

      if (conf && conf !== newP) {
        setError(this.el.querySelector("#confirmPassword"), this.el.querySelector("#confirm-password-error"), "Пароли не совпадают");
      } else if (!conf && newP) {
        setError(this.el.querySelector("#confirmPassword"), this.el.querySelector("#confirm-password-error"), "Повторите новый пароль");
      } else {
        setError(this.el.querySelector("#confirmPassword"), this.el.querySelector("#confirm-password-error"), "");
      }

      return msg;
    }

    if (fieldId === "confirmPassword") {
      const msg = conf && conf !== newP ? "Пароли не совпадают" : (hasAny && !conf ? "Повторите новый пароль" : "");
      setError(this.el.querySelector("#confirmPassword"), this.el.querySelector("#confirm-password-error"), msg);
      return msg;
    }

    return "";
  }

  _updatePasswordButtonState() {
    const old = this.el.querySelector("#oldPassword")?.value || "";
    const newP = this.el.querySelector("#newPassword")?.value || "";
    const conf = this.el.querySelector("#confirmPassword")?.value || "";

    const hasAny = !!old || !!newP || !!conf;
    const isComplete = !!old && !!newP && !!conf;
    const isValidPass = !validatePassword(newP);
    const passwordsMatch = newP === conf;

    const btn = this.el.querySelector('[data-action="change-password"]');
    if (!btn) return;

    const isActive = isComplete && isValidPass && passwordsMatch;

    if (isActive) {
      btn.classList.add("btn_accent");
      btn.classList.remove("btn_outline");
    } else {
      btn.classList.remove("btn_accent");
      btn.classList.add("btn_outline");
    }

    btn.disabled = !hasAny || !isActive;
  }

  _checkForChanges() {
    const editableInputs = this.el.querySelectorAll(".settings__input_editable");
    let hasChanges = false;

    for (const input of editableInputs) {
      const field = input.dataset.field;
      if (input.value !== this._originalValues[field]) {
        hasChanges = true;
        break;
      }
    }

    hasChanges = hasChanges || !!this._pendingAvatarFile;

    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    if (!saveBtn) return;

    if (hasChanges) {
      saveBtn.classList.add("btn_accent");
      saveBtn.classList.remove("btn_outline");
      saveBtn.disabled = false;
    } else {
      saveBtn.classList.remove("btn_accent");
      saveBtn.classList.add("btn_outline");
      saveBtn.disabled = true;
    }
  }

  _setupButtonHandlers() {
    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    const changePwdBtn = this.el.querySelector('[data-action="change-password"]');

    if (saveBtn) {
      const onSaveClick = async (e) => {
        e.preventDefault();
        if (saveBtn.disabled) return;

        console.log("Сохранение профиля:", this._getUpdatedData());
        await this._saveProfile();
      };

      saveBtn.addEventListener("click", onSaveClick);
      this._buttonHandlers.set(saveBtn, onSaveClick);
    }

    if (changePwdBtn) {
      const onChangePasswordClick = async (e) => {
        e.preventDefault();
        if (!this._validateAllPasswordFields()) {
          this._updatePasswordButtonState();
          return;
        }
        console.log("Изменение пароля");
        await this._changePassword();
      };

      changePwdBtn.addEventListener("click", onChangePasswordClick);
      this._buttonHandlers.set(changePwdBtn, onChangePasswordClick);
    }
  }

  _getUpdatedData() {
    const birthdateInput = this.el.querySelector("#birthDate");
    const birthdate = String(birthdateInput?.value || "").trim();

    return {
      birthdate: birthdate || null,
    };
  }

  async _saveProfile() {
    const updated = this._getUpdatedData();
    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    if (saveBtn) saveBtn.disabled = true;

    const profileResult = await profileService.updateProfile(
      updated.birthdate,
      this._pendingAvatarFile,
    );
    if (!profileResult.ok) {
      console.warn("Ошибка сохранения профиля:", profileResult.error);
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    if (profileResult.resp?.avatar_url) {
      const avatarPreview = this.el.querySelector('[data-role="avatar-preview"]');
      if (avatarPreview) {
        avatarPreview.src = profileResult.resp.avatar_url;
      }
    }

    this._pendingAvatarFile = null;
    const avatarInput = this.el.querySelector("#avatarInput");
    if (avatarInput) avatarInput.value = "";
    this._setAvatarError("");

    authStore.updateUserProfile(profileResult.resp || {});

    console.log("Сохранено:", updated);

    // Обновляем оригинальные значения
    Object.entries(updated).forEach(([field, value]) => {
      this._originalValues[field] = value;
    });

    if (saveBtn) {
      saveBtn.classList.remove("btn_accent");
      saveBtn.classList.add("btn_outline");
      saveBtn.disabled = true;
    }

    this._checkForChanges();
  }

  async _changePassword() {
    const old = this.el.querySelector("#oldPassword")?.value;
    const newP = this.el.querySelector("#newPassword")?.value;
    const conf = this.el.querySelector("#confirmPassword")?.value;

    if (newP !== conf) {
      console.error("Пароли не совпадают");
      return;
    }

    const changeResult = await profileService.changePassword({
      old_password: old,
      new_password: newP,
    });

    if (!changeResult.ok) {
      setError(
        this.el.querySelector("#oldPassword"),
        this.el.querySelector("#old-password-error"),
        changeResult.error || "Не удалось сменить пароль",
      );
      return;
    }

    console.log("Смена пароля:", { old, newP });

    const inputs = this.el.querySelectorAll(".settings__input_password_field");
    inputs.forEach((input) => (input.value = ""));

    const fields = this._getPasswordFields();
    fields.forEach(({ input, errorEl }) => setError(input, errorEl, ""));

    const btn = this.el.querySelector('[data-action="change-password"]');
    if (btn) {
      btn.classList.remove("btn_accent");
      btn.classList.add("btn_outline");
      btn.disabled = true;
    }
  }

  _validateAllPasswordFields() {
    return this._getPasswordFields().every(({ id }) => !this._validatePasswordField(id));
  }

  removeEventListeners() {
    for (const [input, handler] of this._editableInputHandlers) {
      input.removeEventListener("input", handler);
    }
    this._editableInputHandlers.clear();

    for (const [input, handler] of this._passwordInputHandlers) {
      input.removeEventListener("input", handler);
      input.removeEventListener("blur", handler);
    }
    this._passwordInputHandlers.clear();

    if (this._avatarInputHandler) {
      const avatarInput = this.el.querySelector("#avatarInput");
      if (avatarInput) avatarInput.removeEventListener("change", this._avatarInputHandler);
      this._avatarInputHandler = null;
    }

    if (this._destroyPasswordToggle) {
      this._destroyPasswordToggle();
      this._destroyPasswordToggle = null;
    }

    const saveBtn = this.el.querySelector('[data-action="save-profile"]');
    const changePwdBtn = this.el.querySelector('[data-action="change-password"]');

    if (saveBtn) saveBtn.removeEventListener("click", this._buttonHandlers.get(saveBtn));
    if (changePwdBtn) changePwdBtn.removeEventListener("click", this._buttonHandlers.get(changePwdBtn));
  }

  beforeDestroy() {
    if (this._detachStyles) {
      this._detachStyles();
      this._detachStyles = null;
    }
  }

  setupChildren() {
    const header = this.el.querySelector("#header");
    if (!header) {
      throw new Error("Settings: не найден header в шаблоне Settings.hbs");
    }

    this.addChild(
      "header",
      new HeaderComponent(
        {
          isAuthorized: true,
          userName: this.context.userData.email,
        },
        this,
        header,
      ),
    );
  }
}
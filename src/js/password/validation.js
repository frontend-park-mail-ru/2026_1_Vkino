/**
 * @fileoverview Валидация формы авторизации/регистрации и отображение ошибок.
 */

/**
 * @typedef {Object} AuthUserData
 * @property {string} email
 * @property {string} password
 */

/**
 * @typedef {Object} AuthValidationOptions
 * @property {(authUserData: AuthUserData, form: HTMLFormElement) => (void|Promise<void>)} [onSubmit]
 * Пользовательский submit-обработчик при успешной валидации.
 */

/**
 * Устанавливает текст ошибки и визуальное состояние поля.
 *
 * @param {HTMLElement|null} el Поле ввода.
 * @param {HTMLElement|null} errorEl Элемент с текстом ошибки.
 * @param {string} message Текст ошибки.
 * @returns {void}
 */
export const setError = (el, errorEl, message) => {
  if (el) el.classList.toggle("is-error", !!message);
  if (errorEl) errorEl.textContent = message || "";
};

/**
 * Валидирует email.
 *
 * @param {string} [email=""] Значение поля email.
 * @returns {string} Пустая строка, если email валиден, иначе текст ошибки.
 */
export const validateEmail = (email = "") => {
  const trimmed = email.trim();
  if (!trimmed) return "Введите email";
  if (trimmed.length > 254) return "Email не должен быть длиннее 254 символов";
  if (trimmed.includes(".."))
    return "Email не должен содержать несколько точек подряд";

  const [localPart = "", domainPart = ""] = trimmed.split("@");

  if (localPart.length > 64) {
    return "Часть email до @ не должна быть длиннее 64 символов";
  }

  if (domainPart.length > 253) {
    return "Доменная часть email слишком длинная";
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? ""
    : "Укажите корректный email";
};

/**
 * Валидирует пароль.
 *
 * @param {string} [password=""] Значение поля пароля.
 * @returns {string} Пустая строка, если пароль валиден, иначе текст ошибки.
 */
export const validatePassword = (password = "") => {
  const issues = [];

  if (password.length < 6) issues.push("минимум 6 символов");
  if (password.length > 72) issues.push("максимум 72 символов");
  if (/\s/.test(password)) issues.push("без пробелов");

  if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
    issues.push("нужны буквы и цифры");
  }

  return issues.length ? "Пароль: " + issues.join(", ") : "";
};

/**
 * Подключает клиентскую валидацию для формы авторизации/регистрации.
 *
 * @param {HTMLFormElement|null} form Форма, которую нужно валидировать.
 * @param {AuthValidationOptions} [options={}] Дополнительные обработчики.
 * @returns {() => void} Функция очистки: снимает обработчики и флаг инициализации.
 */
export const initAuthValidation = (form, options = {}) => {
  if (!form || form.dataset.validationReady === "true") {
    return () => {};
  }

  form.dataset.validationReady = "true";

  const email = form.querySelector('input[type="email"]');
  const pass = form.querySelector("#password");
  const passRepeat = form.querySelector("#password-repeat");

  const emailError = form.querySelector("#email-error");
  const passError = form.querySelector("#password-error");
  const passRepeatError = form.querySelector("#password-repeat-error");

  const fieldErrorPairs = [
    [email, emailError],
    [pass, passError],
    [passRepeat, passRepeatError],
  ];

  /**
   * Валидирует конкретное поле формы.
   *
   * @param {HTMLElement|null} field
   * @returns {string} Текст ошибки или пустая строка.
   */
  const validateField = (field) => {
    if (!field) return "";

    if (field === email) {
      const message = validateEmail(email.value || "");
      setError(email, emailError, message);
      return message;
    }

    if (field === pass) {
      const message = validatePassword(pass.value || "");
      setError(pass, passError, message);

      // если есть повтор пароля — сразу перепроверяем и его
      if (passRepeat) {
        const repeatMessage =
          pass.value !== (passRepeat.value || "") ? "Пароли не совпадают" : "";
        setError(passRepeat, passRepeatError, repeatMessage);
      }

      return message;
    }

    if (field === passRepeat) {
      const message =
        (pass?.value || "") !== (passRepeat.value || "")
          ? "Пароли не совпадают"
          : "";
      setError(passRepeat, passRepeatError, message);
      return message;
    }

    return "";
  };

  /**
   * Реактивная валидация на ввод и blur.
   *
   * @param {Event} event
   * @returns {void}
   */
  const handleInput = (event) => {
    validateField(event.target);
  };

  /**
   * Полная валидация формы перед отправкой.
   *
   * @param {SubmitEvent} e
   * @returns {Promise<void>}
   */
  const handleSubmit = async (e) => {
    let hasErrors = false;
    form.noValidate = true;

    fieldErrorPairs.forEach(([field, errorEl]) => {
      if (!field) return;
      setError(field, errorEl, "");
    });

    const emailMessage = email ? validateField(email) : "";
    const passMessage = pass ? validateField(pass) : "";
    const passRepeatMessage = passRepeat ? validateField(passRepeat) : "";

    if (emailMessage || passMessage || passRepeatMessage) {
      hasErrors = true;
    }

    if (hasErrors) {
      e.preventDefault();
      return;
    }

    if (typeof options.onSubmit === "function") {
      e.preventDefault();

      const formData = new FormData(form);
      await options.onSubmit(
        {
          email: String(formData.get("email") || "").trim(),
          password: String(formData.get("password") || ""),
        },
        form,
      );
    }
  };

  fieldErrorPairs.forEach(([field]) => {
    if (!field) return;
    field.addEventListener("input", handleInput);
    field.addEventListener("blur", handleInput);
  });

  form.addEventListener("submit", handleSubmit);

  return () => {
    fieldErrorPairs.forEach(([field]) => {
      if (!field) return;
      field.removeEventListener("input", handleInput);
      field.removeEventListener("blur", handleInput);
    });

    form.removeEventListener("submit", handleSubmit);
    delete form.dataset.validationReady;
  };
};

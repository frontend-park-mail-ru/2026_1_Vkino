export const setError = (el, errorEl, message) => {
    if (el) el.classList.toggle('is-error', !!message);
    if (errorEl) errorEl.textContent = message || '';
};

export const validateEmail = (email = '') => {
    const trimmed = email.trim();
    if (!trimmed) return 'Введите email';
    if (trimmed.length > 63) return 'Слишком длинный email';
    if (trimmed.includes('..')) return 'Email не должен содержать несколько точек подряд';

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        ? ''
        : 'Укажите корректный email';
};

export const validatePassword = (password = '') => {
    const issues = [];

    if (password.length < 6) issues.push('минимум 6 символов');
    if (password.length > 255) issues.push('максимум 255 символов');
    if (/\s/.test(password)) issues.push('без пробелов');

    if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
        issues.push('нужны буквы и цифры');
    }

    return issues.length ? 'Пароль: ' + issues.join(', ') : '';
};

export const initAuthValidation = (form, options = {}) => {
    if (!form || form.dataset.validationReady === 'true') {
        return () => {};
    }

    form.dataset.validationReady = 'true';

    const email = form.querySelector('input[type="email"]');
    const pass = form.querySelector('#password');
    const passRepeat = form.querySelector('#password-repeat');

    const emailError = form.querySelector('#email-error');
    const passError = form.querySelector('#password-error');
    const passRepeatError = form.querySelector('#password-repeat-error');

    const fieldErrorPairs = [
        [email, emailError],
        [pass, passError],
        [passRepeat, passRepeatError],
    ];

    const validateField = (field) => {
        if (!field) return '';

        if (field === email) {
            const message = validateEmail(email.value || '');
            setError(email, emailError, message);
            return message;
        }

        if (field === pass) {
            const message = validatePassword(pass.value || '');
            setError(pass, passError, message);

            // если есть повтор пароля — сразу перепроверяем и его
            if (passRepeat) {
                const repeatMessage =
                    pass.value !== (passRepeat.value || '')
                        ? 'Пароли не совпадают'
                        : '';
                setError(passRepeat, passRepeatError, repeatMessage);
            }

            return message;
        }

        if (field === passRepeat) {
            const message =
                (pass?.value || '') !== (passRepeat.value || '')
                    ? 'Пароли не совпадают'
                    : '';
            setError(passRepeat, passRepeatError, message);
            return message;
        }

        return '';
    };

    const handleInput = (event) => {
        validateField(event.target);
    };

    const handleSubmit = async (e) => {
        let hasErrors = false;
        form.noValidate = true;

        fieldErrorPairs.forEach(([field, errorEl]) => {
            if (!field) return;
            setError(field, errorEl, '');
        });

        const emailMessage = email ? validateField(email) : '';
        const passMessage = pass ? validateField(pass) : '';
        const passRepeatMessage = passRepeat ? validateField(passRepeat) : '';

        if (emailMessage || passMessage || passRepeatMessage) {
            hasErrors = true;
        }

        if (hasErrors) {
            e.preventDefault();
            return;
        }

        if (typeof options.onSubmit === 'function') {
            e.preventDefault();

            const formData = new FormData(form);
            await options.onSubmit(
                {
                    email: String(formData.get('email') || '').trim(),
                    password: String(formData.get('password') || ''),
                },
                form
            );
        }
    };

    fieldErrorPairs.forEach(([field]) => {
        if (!field) return;
        field.addEventListener('input', handleInput);
        field.addEventListener('blur', handleInput);
    });

    form.addEventListener('submit', handleSubmit);

    return () => {
        fieldErrorPairs.forEach(([field]) => {
            if (!field) return;
            field.removeEventListener('input', handleInput);
            field.removeEventListener('blur', handleInput);
        });

        form.removeEventListener('submit', handleSubmit);
        delete form.dataset.validationReady;
    };
};

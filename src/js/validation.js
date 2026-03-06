const setError = (el, errorEl, message) => {
    if (el) el.classList.toggle('is-error', !!message);
    if (errorEl) errorEl.textContent = message || '';
};

const validateEmail = (email = '') => {
    const trimmed = email.trim();
    if (!trimmed) return 'Введите email';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
        ? ''
        : 'Укажите корректный email';
};

const validatePassword = (password = '') => {
    const issues = [];
    if (password.length < 6) issues.push('минимум 6 символов');
    if (/\s/.test(password)) issues.push('без пробелов');
    if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) {
        issues.push('нужны буквы и цифры');
    }
    return issues.length ? 'Пароль: ' + issues.join(', ') : '';
};

const initAuthValidation = (form) => {
    if (!form || form.dataset.validationReady === 'true') return;
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
        [passRepeat, passRepeatError]
    ];

    fieldErrorPairs.forEach(([field, errorEl]) => {
        if (!field) return;
        field.addEventListener('input', () => {
            setError(field, errorEl, '');
        });
    });

    form.addEventListener('submit', (e) => {
        let hasErrors = false;
        form.noValidate = true;

        fieldErrorPairs.forEach(([field, errorEl]) => {
            if (!field) return;
            setError(field, errorEl, '');
        });

        if (email) {
            const mailMessage = validateEmail(email.value || '');
            if (mailMessage) {
                setError(email, emailError, mailMessage);
                hasErrors = true;
            }
        }

        const passValue = pass?.value || '';
        if (pass) {
            const passMessage = validatePassword(passValue);
            if (passMessage) {
                setError(pass, passError, passMessage);
                hasErrors = true;
            }
        }

        if (pass && passRepeat) {
            const passRepeatValue = passRepeat.value || '';
            if (passValue !== passRepeatValue) {
                setError(passRepeat, passRepeatError, 'Пароли не совпадают');
                hasErrors = true;
            }
        }

        if (hasErrors) {
            e.preventDefault();
        }
    });
};

document.querySelectorAll('form[data-auth-form]').forEach((form) => {
    initAuthValidation(form);
});

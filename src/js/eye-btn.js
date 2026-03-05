document.querySelectorAll('.eye-btn').forEach((btn) => {
btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    btn.classList.toggle('revealed', visible);
});
});
export function initPasswordToggle(root) {
  if (!root) {
    return () => {};
  }

  const syncButtonState = (button, input) => {
    const isVisible = input.type === "text";

    button.classList.toggle("is-active", isVisible);
    button.setAttribute(
      "aria-label",
      isVisible ? "Скрыть пароль" : "Показать пароль",
    );
    button.setAttribute("aria-pressed", String(isVisible));
  };

  root.querySelectorAll(".eye-btn[data-target]").forEach((button) => {
    const input = root.querySelector(`#${button.dataset.target}`);

    if (input) {
      syncButtonState(button, input);
    }
  });

  const handleClick = (event) => {
    const button = event.target.closest(".eye-btn");

    if (!button || !root.contains(button)) {
      return;
    }

    const targetId = button.dataset.target;
    if (!targetId) {
      return;
    }

    const input = root.querySelector(`#${targetId}`);
    if (!input) {
      return;
    }

    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    syncButtonState(button, input);
  };

  root.addEventListener("click", handleClick);

  return () => {
    root.removeEventListener("click", handleClick);
  };
}

export function initPasswordToggle(root) {
  if (!root) {
    return () => {};
  }

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
    button.classList.toggle("is-active", isPassword);
  };

  root.addEventListener("click", handleClick);

  return () => {
    root.removeEventListener("click", handleClick);
  };
}

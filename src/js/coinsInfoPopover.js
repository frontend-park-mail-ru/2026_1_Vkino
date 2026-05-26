/**
 * Toggle info popover for VKino coins (? button).
 * @param {Element} root
 * @returns {() => void} cleanup
 */
export function initCoinsInfoPopover(root) {
  if (!root) {
    return () => {};
  }

  const toggleButtons = root.querySelectorAll('[data-action="toggle-coins-info"]');
  const popovers = root.querySelectorAll(".vk-coins-info-popover");

  if (!toggleButtons.length || !popovers.length) {
    return () => {};
  }

  const onToggleClick = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    const container = button.closest(".settings__coins-history") || root;
    const popover = container?.querySelector(".vk-coins-info-popover");

    if (!popover) {
      return;
    }

    const willOpen = popover.hidden;
    closeAllPopovers(root);
    popover.hidden = !willOpen;
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
  };

  const onDocumentClick = (event) => {
    if (
      event.target.closest('[data-action="toggle-coins-info"]') ||
      event.target.closest(".vk-coins-info-popover")
    ) {
      return;
    }

    closeAllPopovers(root);
  };

  const onDocumentKeydown = (event) => {
    if (event.key === "Escape") {
      closeAllPopovers(root);
    }
  };

  toggleButtons.forEach((button) => {
    button.addEventListener("click", onToggleClick);
  });
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onDocumentKeydown);

  return () => {
    toggleButtons.forEach((button) => {
      button.removeEventListener("click", onToggleClick);
    });
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onDocumentKeydown);
  };
}

function closeAllPopovers(root) {
  root.querySelectorAll(".vk-coins-info-popover").forEach((popover) => {
    popover.hidden = true;
  });
  root.querySelectorAll('[data-action="toggle-coins-info"]').forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

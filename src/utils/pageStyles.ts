/**
 * Подключает список CSS-файлов страницы в `<head>` и возвращает функцию очистки.
 *
 * @param {string[]} [styleHrefs=[]] пути к CSS-файлам
 * @param {string} [ownerKey="page"] ключ владельца для маркировки подключенных стилей
 * @returns {Function} функция, удаляющая ранее подключенные стили
 */
export function attachPageStyles(
  styleHrefs: string[] = [],
  ownerKey = "page",
) {
  const attachedLinks: HTMLLinkElement[] = [];

  styleHrefs.forEach((href) => {
    const normalizedHref = href.startsWith("/") ? href : `/${href}`;
    const selector = `link[data-page-style="${ownerKey}:${normalizedHref}"]`;

    let link = document.head.querySelector<HTMLLinkElement>(selector);

    if (!link) {
      link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = normalizedHref;
      link.dataset.pageStyle = `${ownerKey}:${normalizedHref}`;
      document.head.appendChild(link);
    }

    attachedLinks.push(link);
  });

  return () => {
    attachedLinks.forEach((link) => {
      link.remove();
    });
  };
}

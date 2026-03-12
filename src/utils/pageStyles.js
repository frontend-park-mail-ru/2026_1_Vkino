export function attachPageStyles(styleHrefs = [], ownerKey = "page") {
  const attachedLinks = [];

  styleHrefs.forEach((href) => {
    const normalizedHref = href.startsWith("/") ? href : `/${href}`;
    const selector = `link[data-page-style="${ownerKey}:${normalizedHref}"]`;

    let link = document.head.querySelector(selector);

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

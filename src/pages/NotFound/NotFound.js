import BasePage from "../BasePage.js";
import "./NotFound.precompiled.js";
import "@/css/not-found.scss";

export default class NotFoundPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("NotFound: не передан корневой элемент для NotFoundPage");
    }

    super(
      context,
      Handlebars.templates["NotFound.hbs"],
      parent,
      el,
      "NotFoundPage",
    );
  }

  init() {
    document.title = "404 — VKino";
    return super.init();
  }
}

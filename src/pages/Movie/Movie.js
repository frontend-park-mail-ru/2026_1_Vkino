import BasePage from "../BasePage.js";
import "./Movie.precompiled.js";

export default class MoviePage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("Movie: не передан корневой элемент для Movie");
    }
    super(context, Handlebars.templates["Movie.hbs"], parent, el, "MoviePage");
  }
}

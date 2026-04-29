// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import { BaseComponent } from "@/components/BaseComponent.ts";
import "./SupportTicketsHero.precompiled.js";

export default class SupportTicketsHeroComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error(
        "SupportTicketsHeroComponent: не передан корневой элемент компонента",
      );
    }

    super(context, Handlebars.templates["SupportTicketsHero.hbs"], parent, el);
  }

  addEventListeners() {}

  removeEventListeners() {}
}

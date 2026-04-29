import { BaseComponent } from "@/components/BaseComponent.ts";
import "./SupportTicketsHero.precompiled.js";

export default class SupportTicketsHeroComponent extends BaseComponent {
  constructor(
    context: AnyRecord = {},
    parent: BaseComponent | null = null,
    el: Element | null = null,
  ) {
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

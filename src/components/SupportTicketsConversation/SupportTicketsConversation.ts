import { BaseComponent } from "@/components/BaseComponent.ts";
import "./SupportTicketsConversation.precompiled.js";

export default class SupportTicketsConversationComponent extends BaseComponent {
  constructor(
    context: AnyRecord = {},
    parent: BaseComponent | null = null,
    el: Element | null = null,
  ) {
    if (!el) {
      throw new Error(
        "SupportTicketsConversationComponent: не передан корневой элемент компонента",
      );
    }

    super(
      context,
      Handlebars.templates["SupportTicketsConversation.hbs"],
      parent,
      el,
    );
  }

  addEventListeners() {}

  removeEventListeners() {}
}

import { BaseComponent } from "@/components/BaseComponent.js";
import "./SupportTicketsConversation.precompiled.js";

export default class SupportTicketsConversationComponent extends BaseComponent {
  constructor(context = {}, parent = null, el = null) {
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

import { BaseComponent } from "../components/BaseComponent.js";

export default class BasePage extends BaseComponent {
  constructor(context = {}, template, parent = null, el = null, title = null) {
    super(context, template, parent, el);
    this.title = title;
  }

  onShow() {}
  onHide() {}
  onRefresh() {}

  show() {
    this.onShow();
    return this;
  }

  hide() {
    this.onHide();
    return this;
  }

  refresh(newContext = {}) {
    super.refresh(newContext);
    this.onRefresh();
    return this;
  }
}

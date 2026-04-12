import { Router } from "./Router.js";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("router/index.js: Не найден #root");
}

export const router = new Router(rootEl);

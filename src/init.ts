import Handlebars from "handlebars/runtime";
import { registerServiceWorker } from "./js/serviceWorker.ts";

window.Handlebars = Handlebars;

registerServiceWorker();

await import("./main.ts");

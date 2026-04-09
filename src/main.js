import { Router } from "./router/Router.js";
import MainPage from "./pages/Main/Main.js";
import MoviePage from "./pages/Movie/Movie.js";
import SignInPage from "./pages/SignIn/SignIn.js";
import SignUpPage from "./pages/SignUp/SignUp.js";
import SettingsPage from './pages/Settings/Settings.js';

import "./css/index.css";

import { authStore } from "./store/authStore.js";

const rootEl = document.getElementById("root");

if (!rootEl) {
  throw new Error("main.js: Не найден #root");
}

const router = new Router(rootEl);

async function start() {
  await authStore.init();

  router
    .registerRoute("/", (root) => new MainPage({}, null, root))
    .registerRoute(
      "/sign-in",
      (root) =>
        new SignInPage(
          {
            onSuccess: () => router.go("/"),
          },
          null,
          root,
        ),
    )
    .registerRoute(
      "/sign-up",
      (root) =>
        new SignUpPage(
          {
            onSuccess: () => router.go("/"),
          },
          null,
          root,
        ),
    )
    .registerRoute("/movie", (root) => new MoviePage({}, null, root))
    .registerRoute("/settings", (root) => new SettingsPage({}, null, root)); 

    router.init()
}

start();

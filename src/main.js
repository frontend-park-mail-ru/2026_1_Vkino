import { router } from "./router/index.js";
import MainPage from "./pages/Main/Main.js";
import MoviePage from "./pages/Movie/Movie.js";
import SignInPage from "./pages/SignIn/SignIn.js";
import SignUpPage from "./pages/SignUp/SignUp.js";
import ProfilePage from "./pages/Profile/Profile.js";
import SettingsPage from "./pages/Settings/Settings.js";
import ActorPage from "./pages/Actor/Actor.js";

import "./css/index.css";

import { authStore } from "./store/authStore.js";

/**
 * Инициализирует приложение, поднимает сессию пользователя и регистрирует роуты.
 *
 * @returns {Promise<void>}
 */
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
    .registerRoute("/profile", (root) => new ProfilePage({}, null, root))
    .registerRoute("/settings", (root) => new SettingsPage({}, null, root))
    .registerRoute("/movie/:id", (root) => new MoviePage({}, null, root))
    .registerRoute("/actor/:id", (root) => new ActorPage({}, null, root));

  router.init();
}

start();

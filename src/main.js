import { router } from "./router/index.js";
import MainPage from "./pages/Main/Main.js";
import MoviePage from "./pages/Movie/Movie.js";
import SignInPage from "./pages/SignIn/SignIn.js";
import SignUpPage from "./pages/SignUp/SignUp.js";
import ProfilePage from "./pages/Profile/Profile.js";
import SettingsPage from "./pages/Settings/Settings.js";
import ActorPage from "./pages/Actor/Actor.js";
import CatalogPage from "./pages/Catalog/Catalog.js";
import WatchPartyPage from "./pages/WatchParty/WatchParty.js";
import SupportCreatePage from "./pages/SupportCreate/SupportCreate.js";
import SupportTicketsPage from "./pages/SupportTickets/SupportTickets.js";

import "./css/index.scss";

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
    .registerRoute(
      "/genres",
      (root) => new CatalogPage({ catalogKey: "genres" }, null, root),
    )
    .registerRoute(
      "/movies",
      (root) =>
        new CatalogPage(
          {
            catalogKey: "movies",
          },
          null,
          root,
        ),
    )
    .registerRoute(
      "/serials",
      (root) =>
        new CatalogPage(
          {
            catalogKey: "serials",
          },
          null,
          root,
        ),
    )
    .registerRoute(
      "/cartoons",
      (root) =>
        new CatalogPage(
          {
            catalogKey: "cartoons",
          },
          null,
          root,
        ),
    )
    .registerRoute(
      "/selection/:title",
      (root) => new CatalogPage({ catalogKey: "selection" }, null, root),
    )
    .registerRoute("/watch-party", (root) => new WatchPartyPage({}, null, root))
    .registerRoute("/support", (root) => new SupportTicketsPage({}, null, root))
    .registerRoute(
      "/admin/support",
      (root) => new SupportTicketsPage({}, null, root),
    )
    .registerRoute(
      "/support/new",
      (root) => new SupportCreatePage({}, null, root),
    )
    .registerRoute("/movie/:id", (root) => new MoviePage({}, null, root))
    .registerRoute("/actor/:id", (root) => new ActorPage({}, null, root));

  router.init();
}

start();

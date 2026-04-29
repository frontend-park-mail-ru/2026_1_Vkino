// @ts-nocheck
// TODO(ts): Legacy dynamic UI module. Remove ts-nocheck after incremental typing.
import { router } from "./router/index.ts";
import MainPage from "./pages/Main/Main.ts";
import MoviePage from "./pages/Movie/Movie.ts";
import SignInPage from "./pages/SignIn/SignIn.ts";
import SignUpPage from "./pages/SignUp/SignUp.ts";
import ProfilePage from "./pages/Profile/Profile.ts";
import SettingsPage from "./pages/Settings/Settings.ts";
import ActorPage from "./pages/Actor/Actor.ts";
import CatalogPage from "./pages/Catalog/Catalog.ts";
import WatchPartyPage from "./pages/WatchParty/WatchParty.ts";
import SupportCreatePage from "./pages/SupportCreate/SupportCreate.ts";
import SupportTicketsPage from "./pages/SupportTickets/SupportTickets.ts";
import FriendsPage from "./pages/Friends/Friends.ts";


import "./css/index.scss";

import { authStore } from "./store/authStore.ts";

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
      "/favorites",
      (root) =>
        new CatalogPage(
          {
            catalogKey: "favorites",
            basePath: "/favorites",
          },
          null,
          root,
        ),
    )
    .registerRoute(
      "/profile/history",
      (root) =>
        new CatalogPage(
          {
            catalogKey: "history",
            basePath: "/profile/history",
          },
          null,
          root,
        ),
    )
    .registerRoute("/friends", (root) => new FriendsPage({}, null, root))
    .registerRoute(
      "/selection/:title",
      (root) => new CatalogPage({ catalogKey: "selection" }, null, root),
    )
    .registerRoute("/watch-party", (root) => new WatchPartyPage({}, null, root))
    .registerRoute(
      "/watch-party/:roomId",
      (root) => new WatchPartyPage({}, null, root),
    )
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

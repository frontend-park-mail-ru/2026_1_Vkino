import BasePage from "@/pages/BasePage.js";
import "./Friends.precompiled.js";
import "@/css/friends.scss";
import HeaderComponent from "@/components/Header/Header.js";
import { userService } from "@/js/UserService.js";
import { router } from "@/router/index.js";
import { authStore } from "@/store/authStore.js";
import { getDisplayNameFromEmail, formatDate } from "@/utils/user.js";
import { resolveAvatarUrl } from "@/utils/avatar.js";
import { createDebouncedSearch } from "@/utils/SearchHelper.js";

export default class FriendsPage extends BasePage {
  constructor(context = {}, parent = null, el = null) {
    if (!el) {
      throw new Error("FriendsPage: не передан корневой элемент");
    }
    super(
      {
        isLoading: true,
        errorMessage: "",
        searchResults: [],
        incomingRequests: [],
        outgoingRequests: [],
        friends: [],
        searchQuery: "",
        ...context,
      },
      Handlebars.templates["Friends.hbs"],
      parent,
      el,
      "FriendsPage",
    );

    this._searchRequestToken = 0;
    this._debouncedSearch = createDebouncedSearch(this._performSearch, 300);
    this._toastTimeoutId = 0;
  }

  init() {
    if (!authStore.getState().user) {
      router.go("/sign-in");
      return this;
    }
    super.init();
    if (this.context.isLoading) {
      this.loadContext();
    }
    return this;
  }

  async loadContext() {
    const [incoming, outgoing, friends] = await Promise.all([
      userService.getFriendRequests({ direction: "incoming", limit: 50 }),
      userService.getFriendRequests({ direction: "outgoing", limit: 50 }),
      userService.getFriendsList({ limit: 50, offset: 0 }),
    ]);
    this.refresh({
      ...this.context,
      isLoading: false,
      incomingRequests: incoming.ok
        ? normalizeRequests(incoming.resp?.requests || [])
        : [],
      outgoingRequests: outgoing.ok
        ? normalizeRequests(outgoing.resp?.requests || [])
        : [],
      friends: friends.ok ? normalizeFriends(friends.resp?.friends || []) : [],
      errorMessage:
        incoming.ok && outgoing.ok && friends.ok
          ? ""
          : "Не удалось загрузить друзей",
    });
  }

  setupChildren() {
    const header = this.el.querySelector("#header");
    if (header) {
      this.addChild("header", new HeaderComponent({}, this, header));
    }
  }

  addEventListeners() {
    this.el.addEventListener("input", this._onInput);
    this.el.addEventListener("click", this._onClick);
  }

  removeEventListeners() {
    this.el?.removeEventListener("input", this._onInput);
    this.el?.removeEventListener("click", this._onClick);
    window.clearTimeout(this._toastTimeoutId);
  }

  _onInput = (event) => {
    const input = event.target.closest("#friend-search-input");
    if (!input) {
      return;
    }

    const query = String(input.value || "").trim();
    this.context.searchQuery = query;

    this._debouncedSearch(query);
  };

  _performSearch = async (query) => {
    const normalizedQuery = String(query || "").trim();
    const requestToken = ++this._searchRequestToken;

    if (!normalizedQuery) {
      this.refresh({
        ...this.context,
        searchResults: [],
        searchQuery: "",
      });
      this._restoreSearchInput("", 0, 0);
      return;
    }

    const inputEl = this.el?.querySelector("#friend-search-input");
    const valueSnapshot = inputEl ? inputEl.value : normalizedQuery;
    const hadFocus = document.activeElement === inputEl;
    const selStart = hadFocus
      ? (inputEl.selectionStart ?? valueSnapshot.length)
      : valueSnapshot.length;
    const selEnd = hadFocus
      ? (inputEl.selectionEnd ?? valueSnapshot.length)
      : valueSnapshot.length;

    const result = await userService.searchUsers(normalizedQuery, { limit: 10 });
    if (requestToken !== this._searchRequestToken) {
      return;
    }

    const raw = result.ok ? result.resp?.users || [] : [];
    this.refresh({
      ...this.context,
      searchQuery: valueSnapshot.trim(),
      searchResults: enrichSearchResults(raw, {
        friends: this.context.friends,
        outgoingRequests: this.context.outgoingRequests,
      }),
    });
    this._restoreSearchInput(valueSnapshot, selStart, selEnd);
  };

  /**
   * После полного refresh DOM поля ввода пересоздаётся — восстанавливаем значение и курсор.
   */
  _restoreSearchInput(value, selStart, selEnd) {
    const inp = this.el?.querySelector("#friend-search-input");
    if (!inp) {
      return;
    }

    inp.value = value;
    inp.focus();
    const max = value.length;
    const a = Math.max(0, Math.min(selStart, max));
    const b = Math.max(0, Math.min(selEnd, max));
    try {
      inp.setSelectionRange(a, b);
    } catch {
      /* type=search может не поддерживать выделение в части браузеров */
    }
  }

  _onClick = async (event) => {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;

    if (action === "send-request") {
      if (actionBtn.disabled) {
        return;
      }
      const toUserId = actionBtn.dataset.userId;
      if (toUserId) {
        const sendResult = await userService.sendFriendRequest(toUserId);
        if (!sendResult.ok) {
          this._showFriendsToast(
            sendResult.error || "Не удалось отправить заявку",
            true,
          );
          return;
        }
        await this.loadContext();
        if (String(this.context.searchQuery || "").trim()) {
          await this._performSearch(this.context.searchQuery);
        }
      }
      return;
    }

    if (action === "accept-request" || action === "decline-request") {
      const requestId = actionBtn.closest(".request-item")?.dataset.requestId;
      if (!requestId) return;
      const realAction = action === "accept-request" ? "accept" : "decline";
      await userService.respondToFriendRequest(requestId, realAction);
      await this.loadContext();
      return;
    }

    if (action === "cancel-request") {
      const requestId = actionBtn.closest(".request-item")?.dataset.requestId;
      if (!requestId) return;
      await userService.cancelFriendRequest(requestId);
      await this.loadContext();
      return;
    }

    if (action === "remove-friend") {
      const friendId = actionBtn.dataset.userId;
      if (!friendId) return;
      const confirmed = window.confirm(
        "Вы уверены, что хотите удалить этого друга?",
      );
      if (!confirmed) {
        return;
      }

      const card = actionBtn.closest(".friend-card");
      const result = await userService.deleteFriend(friendId);

      if (!result.ok) {
        this._showFriendsToast(
          result.error || "Не удалось удалить из друзей",
          true,
        );
        return;
      }

      if (card) {
        card.classList.add("is-removing");
        await waitForTransitionEnd(card);
      }

      const nextFriends = this.context.friends.filter(
        (f) => String(f.id) !== String(friendId),
      );
      this.refresh({
        ...this.context,
        friends: nextFriends,
      });
    }
  };

  _showFriendsToast(message, isError = false) {
    const el = this.el?.querySelector('[data-role="friends-toast"]');
    if (!el) return;
    window.clearTimeout(this._toastTimeoutId);
    el.textContent = message;
    el.hidden = false;
    el.classList.toggle("friends-page__toast--error", Boolean(isError));
    this._toastTimeoutId = window.setTimeout(() => {
      el.textContent = "";
      el.hidden = true;
      el.classList.remove("friends-page__toast--error");
    }, 4200);
  }
}

function waitForTransitionEnd(element) {
  return new Promise((resolve) => {
    const done = (event) => {
      if (event.target !== element) {
        return;
      }
      element.removeEventListener("transitionend", done);
      resolve();
    };
    element.addEventListener("transitionend", done);
    window.setTimeout(() => {
      element.removeEventListener("transitionend", done);
      resolve();
    }, 400);
  });
}

function normalizeRequests(items = []) {
  return items.map((request) => ({
    ...request,
    sinceLabel: formatDate(request.created_at),
  }));
}

function normalizeFriends(items = []) {
  return items.map((friend) => {
    const displayName = getDisplayNameFromEmail(friend.email) || "Пользователь";
    const avatarSource =
      friend.avatar_url ||
      friend.avatarUrl ||
      friend.avatar_file_key ||
      friend.avatarFileKey ||
      "";
    return {
      ...friend,
      displayName,
      avatarUrl: resolveAvatarUrl(avatarSource),
      initials: displayName.charAt(0).toUpperCase(),
      sinceLabel: formatDate(friend.created_at),
    };
  });
}

/**
 * @param {object[]} users
 * @param {{ friends?: object[]; outgoingRequests?: object[] }} rel
 */
function enrichSearchResults(users = [], rel = {}) {
  const friendIds = new Set(
    (rel.friends || []).map((f) => String(f.id)),
  );
  const pendingTo = new Set(
    (rel.outgoingRequests || []).map((r) =>
      String(r.user_id ?? r.to_user_id ?? ""),
    ),
  );
  return users.map((u) => {
    const displayName = getDisplayNameFromEmail(u.email) || "Пользователь";
    // вообще avatar_url, но на всякий пока оставлю 
    const avatarSource =
      u.avatar_url ||
      u.avatarUrl ||
      u.avatar_file_key ||
      u.avatarFileKey ||
      "";
    return {
      ...u,
      displayName,
      avatarUrl: resolveAvatarUrl(avatarSource),
      initials: displayName.charAt(0).toUpperCase(),
      isFriend: friendIds.has(String(u.id)),
      hasPendingRequest: pendingTo.has(String(u.id)),
    };
  });
}

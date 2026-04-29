import BasePage from "@/pages/BasePage.ts";
import "./Friends.precompiled.js";
import "@/css/friends.scss";
import HeaderComponent from "@/components/Header/Header.ts";
import { userService } from "@/js/UserService.ts";
import { router } from "@/router/index.ts";
import { authStore } from "@/store/authStore.ts";
import type { Cleanup } from "@/types/shared.ts";
import type { FriendRequestDto, UserProfileDto } from "@/types/user.ts";
import { getDisplayNameFromEmail, formatDate } from "@/utils/user.ts";
import { resolveAvatarUrl, resolveMediaUrl } from "@/utils/media.ts";
import { createDebouncedSearch } from "@/utils/SearchHelper.ts";

interface FriendRequestViewModel extends FriendRequestDto {
  sinceLabel: string;
}

interface FriendViewModel extends UserProfileDto {
  displayName: string;
  avatarUrl: string;
  initials: string;
  sinceLabel: string;
}

interface SearchResultViewModel extends UserProfileDto {
  displayName: string;
  avatarUrl: string;
  initials: string;
  isFriend: boolean;
  hasPendingRequest: boolean;
}

interface FriendsPageContext extends AnyRecord {
  isLoading: boolean;
  errorMessage: string;
  searchResults: SearchResultViewModel[];
  incomingRequests: FriendRequestViewModel[];
  outgoingRequests: FriendRequestViewModel[];
  friends: FriendViewModel[];
  searchQuery: string;
}

export default class FriendsPage extends BasePage<FriendsPageContext> {
  private _searchRequestToken: number;
  private _debouncedSearch: (query: string) => void;
  private _toastTimeoutId: number;

  constructor(
    context: Partial<FriendsPageContext> = {},
    parent: BasePage<any> | null = null,
    el: Element | null = null,
  ) {
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

  async loadContext(
    options: { searchQuery?: string } = {},
  ): Promise<void> {
    const { searchQuery } = options;
    const [incoming, outgoing, friends] = await Promise.all([
      userService.getFriendRequests({ direction: "incoming", limit: 50 }),
      userService.getFriendRequests({ direction: "outgoing", limit: 50 }),
      userService.getFriendsList({ limit: 50, offset: 0 }),
    ]);
    const nextFriends = friends.ok
      ? normalizeFriends(friends.resp?.friends || [])
      : [];
    const nextOutgoing = outgoing.ok
      ? normalizeRequests(outgoing.resp?.requests || [])
      : [];
    const nextSearchQuery = String(searchQuery || "").trim();
    let nextSearchResults: SearchResultViewModel[] = [];

    if (nextSearchQuery) {
      const result = await userService.searchUsers(nextSearchQuery, { limit: 10 });
      const raw = result.ok ? result.resp?.users || [] : [];
      nextSearchResults = enrichSearchResults(raw, {
        friends: nextFriends,
        outgoingRequests: nextOutgoing,
      });
    }

    this.refresh({
      ...this.context,
      isLoading: false,
      incomingRequests: incoming.ok
        ? normalizeRequests(incoming.resp?.requests || [])
        : [],
      outgoingRequests: nextOutgoing,
      friends: nextFriends,
      searchQuery: nextSearchQuery,
      searchResults: nextSearchResults,
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

  _onInput = (event: Event) => {
    const input = (event.target as Element | null)?.closest("#friend-search-input");
    if (!input) {
      return;
    }

    const query = String(input.value || "").trim();
    this.context.searchQuery = query;

    this._debouncedSearch(query);
  };

  _performSearch = async (query: string): Promise<void> => {
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

    const inputEl = this.el?.querySelector<HTMLInputElement>("#friend-search-input");
    const valueSnapshot = inputEl ? String(inputEl.value || "") : normalizedQuery;
    const hadFocus = document.activeElement === inputEl;
    const selStart = hadFocus && inputEl
      ? (inputEl.selectionStart ?? valueSnapshot.length)
      : valueSnapshot.length;
    const selEnd = hadFocus && inputEl
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
  _restoreSearchInput(value: string, selStart: number, selEnd: number) {
    const inp = this.el?.querySelector<HTMLInputElement>("#friend-search-input");
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

  _onClick = async (event: Event) => {
    const actionBtn = (event.target as Element | null)?.closest("[data-action]");
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
        await this.loadContext({ searchQuery: this.context.searchQuery });
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

      const card = actionBtn.closest(".friend-card") as HTMLElement | null;
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

  _showFriendsToast(message: string, isError = false) {
    const el = this.el?.querySelector<HTMLElement>('[data-role="friends-toast"]');
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

function waitForTransitionEnd(element: HTMLElement): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (event: Event) => {
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

function normalizeRequests(
  items: FriendRequestDto[] = [],
): FriendRequestViewModel[] {
  return items.map((request) => ({
    ...request,
    sinceLabel: formatDate(request.created_at),
  }));
}

function normalizeFriends(items: UserProfileDto[] = []): FriendViewModel[] {
  return items.map((friend) => {
    const displayName = getDisplayNameFromEmail(friend.email) || "Пользователь";
    const avatarUrl = resolveAvatarUrl(friend, { resolveMediaUrl });
    return {
      ...friend,
      displayName,
      avatarUrl,
      initials: displayName.charAt(0).toUpperCase(),
      sinceLabel: formatDate(friend.created_at),
    };
  });
}

/**
 * @param {object[]} users
 * @param {{ friends?: object[]; outgoingRequests?: object[] }} rel
 */
function enrichSearchResults(
  users: UserProfileDto[] = [],
  rel: {
    friends?: UserProfileDto[];
    outgoingRequests?: FriendRequestDto[];
  } = {},
): SearchResultViewModel[] {
  const friendIds = new Set(
    (rel.friends || []).map((friend) => String(friend.id)),
  );
  const pendingTo = new Set(
    (rel.outgoingRequests || []).map((request) =>
      String(request.user_id ?? request.to_user_id ?? ""),
    ),
  );
  return users.map((user) => {
    const displayName = getDisplayNameFromEmail(user.email) || "Пользователь";
    const avatarUrl = resolveAvatarUrl(user, { resolveMediaUrl });
    return {
      ...user,
      displayName,
      avatarUrl,
      initials: displayName.charAt(0).toUpperCase(),
      isFriend: friendIds.has(String(user.id)),
      hasPendingRequest: pendingTo.has(String(user.id)),
    };
  });
}

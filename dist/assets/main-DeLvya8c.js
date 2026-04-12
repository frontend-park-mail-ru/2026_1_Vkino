var e=class{constructor(e){if(!e)throw Error(`Router: не передан корневой DOM-элемент`);this.root=e,this.routeTable=new Map,this.activePage=null,this._syncRoute=this._syncRoute.bind(this),this._processLinkClick=this._processLinkClick.bind(this),document.addEventListener(`click`,this._processLinkClick),window.addEventListener(`popstate`,this._syncRoute)}registerRoute(e,t){if(!e)throw Error(`Router: не указан path`);if(typeof t!=`function`)throw Error(`Router: pageBuilder для пути "${e}" должен быть функцией`);return this.routeTable.set(this._formatPath(e),t),this}go(e){let t=this._formatPath(e);window.location.pathname!==t&&(window.history.pushState({},``,t),this._syncRoute())}init(){console.log(`Router initialized`),this._syncRoute()}destroy(){document.removeEventListener(`click`,this._processLinkClick),window.removeEventListener(`popstate`,this._syncRoute),this.activePage?.destroy&&this.activePage.destroy(),this.activePage=null}_processLinkClick(e){let t=e.target.closest(`[router-link]`);if(!t||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;let n=t.getAttribute(`href`);console.log(`Router href =`,n),n&&(e.preventDefault(),this.go(n))}_syncRoute(){let e=this._formatPath(window.location.pathname);console.log(`route path =`,e);let t=this.routeTable.get(e)||this.routeTable.get(`/404`);if(console.log(`pageBuilder =`,t),!t)throw Error(`Router: маршрут "${e}" не найден и маршрут "/404" не зарегистрирован`);this.activePage?.destroy&&this.activePage.destroy(),this.root.innerHTML=``;let n=t(this.root);if(!n||typeof n.init!=`function`)throw Error(`Router: builder для пути "${e}" должен возвращать страницу с методом init()`);this.activePage=n,n.init()}_formatPath(e){return!e||e===`/`?`/`:e.endsWith(`/`)?e.slice(0,-1):e}_matchRoute(e){let t=this.routeTable.get(e);if(t)return t;let n=e.split(`/`).filter(Boolean);for(let[e,t]of this.routeTable.entries()){let r=e.split(`/`).filter(Boolean);if(r.length===n.length&&r.every((e,t)=>e.startsWith(`:`)||e===n[t]))return t}}},t=document.getElementById(`root`);if(!t)throw Error(`router/index.js: Не найден #root`);var n=new e(t),r=class{constructor(e={},t,n=null,r=null){if(!t)throw Error(`Не задан шаблон компонента`);if(!r)throw Error(`Не передан корневой DOM-элемент компонента`);this._id=crypto.randomUUID?.()??String(Date.now()),this.el=r,this.template=t,this.context=e,this.parent=n,this.children=new Map}render(){let e=this.template({...this.context});return this.el.innerHTML=e,this}addEventListeners(){}removeEventListeners(){}beforeDestroy(){}init(){return this.render(),this.setupChildren(),this.initChildren(),this.addEventListeners(),this}destroy(){this.removeEventListeners(),this.destroyChildren(),this.beforeDestroy(),this.el&&(this.el.innerHTML=``),this.el=null,this.context=null,this.template=null,this.parent=null}refresh(e){return this.removeEventListeners(),this.destroyChildren(),this.context={...e},this.init(),this}setupChildren(){}initChildren(){for(let[,e]of this.children)e.init()}refreshChildren(e={}){for(let[,t]of this.children)t.refresh(e)}destroyChildren(){for(let[,e]of this.children)e.destroy();this.children.clear()}addChild(e,t){if(!e)throw Error(`Не указано имя дочернего компонента`);if(!t)throw Error(`Не передан дочерний компонент "${e}"`);return this.children.has(e)&&this.children.get(e).destroy(),this.children.set(e,t),t}getChild(e){return this.children.get(e)??null}removeChild(e){let t=this.children.get(e);t&&(t.destroy(),this.children.delete(e))}},i=class extends r{constructor(e={},t,n=null,r=null,i=null){super(e,t,n,r),this.title=i}onShow(){}onHide(){}onRefresh(){}show(){return this.onShow(),this}hide(){return this.onHide(),this}refresh(e={}){return super.refresh(e),this.onRefresh(),this}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Main.hbs`]=e({0:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`        <section class="selection-carousel-slot">
          <div
            class="selection-carousel-slot__content"
            data-selection-slot="`+e.escapeExpression(e.lambda(t==null?t:a(t,`slotKey`),t))+`"
          ></div>
        </section>
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<header id="header"></header>

<div class="main">
  <div class="main-content" id="main-content">
    <section class="main-hero-slot" id="hero-carousel"></section>

    <div class="selection-carousels">
`+(a(n,`each`).call(t??(e.nullContext||{}),t==null?t:a(t,`selectionEntries`),{name:`each`,hash:{},fn:e.program(0,i,0),inverse:e.noop,data:i,loc:{start:{line:8,column:6},end:{line:15,column:15}}})??``)+`    </div>
  </div>
</div>
`},useData:!0})})();var a=class e{constructor(e,t=``,n=`vkino_access_token`){this.baseUrl=e.replace(/\/+$/,``),this.namespace=t,this.accessTokenKey=n}withNamespace(t){return new e(this.baseUrl,t,this.accessTokenKey)}getAccessToken(){return localStorage.getItem(this.accessTokenKey)}setAccessToken(e){if(!e){this.clearAccessToken();return}localStorage.setItem(this.accessTokenKey,e)}clearAccessToken(){localStorage.removeItem(this.accessTokenKey)}buildUrl(e=``){let t=this.namespace?`/${String(this.namespace).replace(/^\/+|\/+$/g,``)}`:``,n=e?`/${String(e).replace(/^\/+/,``)}`:``;return`${this.baseUrl}${t}${n}`}async request(e,{method:t=`GET`,data:n=null,headers:r={}}={}){let i=this.buildUrl(e),a=this.getAccessToken(),s={method:t,credentials:`include`,headers:{Accept:`application/json`,...r}};n!==null&&(s.headers[`Content-Type`]=`application/json`,s.body=JSON.stringify(n)),a&&(s.headers.Authorization=`Bearer ${a}`);let c;try{c=await fetch(i,s)}catch(e){return{ok:!1,status:0,resp:null,error:e.message||`Network error`}}let l=await c.text(),u=null;if(l)try{u=JSON.parse(l)}catch{u={raw:l}}return{ok:c.ok,status:c.status,resp:u,error:o(u)}}get(e){return this.request(e,{method:`GET`})}post(e,t=null){return this.request(e,{method:`POST`,data:t})}put(e,t=null){return this.request(e,{method:`PUT`,data:t})}delete(e){return this.request(e,{method:`DELETE`})}};function o(e){return!e||typeof e!=`object`?``:e.Error||e.error||e.message||``}var s=new a(`http://localhost:8080`),c=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,l=new class{constructor(e){this.api=e.withNamespace(`movie`)}async getAllSelections(){return this.api.get(`/selection/all`)}async getSelectionByTitle(e){return this.api.get(`/selection/${e}`)}async getMovieById(e){let t=String(e??``).trim();return t?c.test(t)?this.api.get(`/${encodeURIComponent(t)}`):{ok:!1,status:0,resp:null,error:`MovieService: id фильма должен быть UUID`}:{ok:!1,status:0,resp:null,error:`MovieService: не передан id фильма`}}async getActorById(e){return this.api.get(`/actor/${e}`)}}(s);(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Header.hbs`]=e({0:function(e,t,n,r,i){return`      <form class="vk-header__search-form" data-menu="search">
        <input
          class="vk-header__search-input"
          type="search"
          name="search"
          placeholder="Введите название"
          autocomplete="off"
        />
        <button
          class="vk-header__search-submit"
          type="button"
          data-action="toggle-search"
          aria-label="Скрыть поиск"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="5.5"></circle>
            <path d="M15.5 15.5L20 20"></path>
          </svg>
        </button>
      </form>
`},1:function(e,t,n,r,i){return`      <nav class="vk-header__nav" aria-label="Основная навигация">
        <a href="/">Совместный просмотр</a>
        <a href="/">Избранное</a>
        <button
          class="vk-header__search"
          type="button"
          data-action="toggle-search"
          aria-label="Поиск"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="5.5"></circle>
            <path d="M15.5 15.5L20 20"></path>
          </svg>
        </button>
      </nav>
`},2:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`        <button
          class="vk-header__avatar-button"
          type="button"
          data-action="toggle-profile-menu"
          aria-label="Открыть меню профиля"
          aria-expanded="`+e.escapeExpression((a=(a=o(n,`isProfileMenuOpen`)||(t==null?t:o(t,`isProfileMenuOpen`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`isProfileMenuOpen`,hash:{},data:i,loc:{start:{line:68,column:25},end:{line:68,column:46}}}):a))+`"
        >
          <img
            class="vk-header__avatar"
            src="img/user-avatar.png"
            alt="Аватар пользователя"
          />
        </button>
`},3:function(e,t,n,r,i){return`        <a class="vk-header__auth-link" href="/sign-in" router-link>Вход</a>
        <a class="vk-header__auth-link" href="/sign-up" router-link>Регистрация</a>
`},4:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`    <div
      class="vk-header__profile-menu`+(a(n,`if`).call(t??(e.nullContext||{}),t==null?t:a(t,`isProfileMenuOpen`),{name:`if`,hash:{},fn:e.program(5,i,0),inverse:e.noop,data:i,loc:{start:{line:85,column:36},end:{line:85,column:76}}})??``)+`"
      data-menu="profile"
    >
      <a href="/">Мой профиль</a>
      <a href="/">Настройки</a>
      <a href="/">История VKino coins</a>
      <button type="button" data-action="logout">Выход</button>
    </div>
`},5:function(e,t,n,r,i){return` is-open`},6:function(e,t,n,r,i){return` is-visible`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<div class="vk-header">
  <div class="vk-header__bar">
    <div class="vk-header__start">
      <button
        class="vk-header__burger"
        type="button"
        data-action="toggle-burger-menu"
        aria-label="Открыть меню"
        aria-expanded="`+e.escapeExpression((a=(a=s(n,`isBurgerMenuOpen`)||(t==null?t:s(t,`isBurgerMenuOpen`)))??e.hooks.helperMissing,typeof a==`function`?a.call(o,{name:`isBurgerMenuOpen`,hash:{},data:i,loc:{start:{line:9,column:23},end:{line:9,column:43}}}):a))+`"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      <a class="vk-header__brand" href="/" router-link aria-label="VKino">
        <img class="vk-header__brand-logo" src="img/logo.png" alt="VKino" />
        <span class="vk-header__brand-text">VKino</span>
      </a>
    </div>

`+(s(n,`if`).call(o,t==null?t:s(t,`isSearchOpen`),{name:`if`,hash:{},fn:e.program(0,i,0),inverse:e.program(1,i,0),data:i,loc:{start:{line:22,column:4},end:{line:59,column:11}}})??``)+`
    <div class="vk-header__end">
`+(s(n,`if`).call(o,t==null?t:s(t,`isAuthorized`),{name:`if`,hash:{},fn:e.program(2,i,0),inverse:e.program(3,i,0),data:i,loc:{start:{line:62,column:6},end:{line:79,column:13}}})??``)+`    </div>
  </div>

`+(s(n,`if`).call(o,t==null?t:s(t,`isAuthorized`),{name:`if`,hash:{},fn:e.program(4,i,0),inverse:e.noop,data:i,loc:{start:{line:83,column:2},end:{line:93,column:9}}})??``)+`</div>

<div
  class="vk-header__overlay`+(s(n,`if`).call(o,t==null?t:s(t,`isAnyMenuOpen`),{name:`if`,hash:{},fn:e.program(6,i,0),inverse:e.noop,data:i,loc:{start:{line:97,column:27},end:{line:97,column:66}}})??``)+`"
  data-action="close-all-menus"
></div>

<aside
  class="vk-header__drawer`+(s(n,`if`).call(o,t==null?t:s(t,`isBurgerMenuOpen`),{name:`if`,hash:{},fn:e.program(5,i,0),inverse:e.noop,data:i,loc:{start:{line:102,column:26},end:{line:102,column:65}}})??``)+`"
  data-menu="burger"
>
  <nav class="vk-header__drawer-nav" aria-label="Категории">
    <a href="/" data-action="close-all-menus">Новинки</a>
    <a href="/" data-action="close-all-menus">Фильмы</a>
    <a href="/" data-action="close-all-menus">Мультфильмы</a>
    <a href="/" data-action="close-all-menus">Сериалы</a>
    <a href="/" data-action="close-all-menus">Короткометражки</a>
    <a href="/" data-action="close-all-menus">Семейное</a>
  </nav>
</aside>
`},useData:!0})})();function u(e){let t=structuredClone(e),n=new Set;return{getState(){return t},setState(e){t={...t,...e},[...n].forEach(e=>e(t))},subscribe(e){return n.add(e),()=>{n.delete(e)}},reset(e){t=structuredClone(e),[...n].forEach(e=>e(t))}}}var d=new class{constructor(e){this.apiRoot=e,this.api=e.withNamespace(`/auth`)}_saveAccessToken(e){let t=e?.resp?.access_token;e?.ok&&t&&this.apiRoot.setAccessToken(t)}_clearSessionLocal(){this.apiRoot.clearAccessToken()}getAccessToken(){return this.apiRoot.getAccessToken()}clearAccessToken(){this._clearSessionLocal()}async signIn(e){let t=await this.api.post(`/sign-in`,e);return this._saveAccessToken(t),t}async signUp(e){let t=await this.api.post(`/sign-up`,e);return this._saveAccessToken(t),t}async refresh(){let e=await this.api.post(`/refresh`);return this._saveAccessToken(e),e.ok||this._clearSessionLocal(),e}async me(){return this.api.get(`/me`)}async logout(){let e=await this.api.post(`/logout`);return this._clearSessionLocal(),e}}(s),f={status:`idle`,user:null,error:null},p=new class{constructor(){this.store=u(f)}getState(){return this.store.getState()}subscribe(e){return this.store.subscribe(e)}_setState(e){this.store.setState(e)}_setGuest(e=null){this._setState({status:`guest`,user:null,error:e})}_setAuthenticated(e){this._setState({status:`authenticated`,user:e,error:null})}async init(){if(this._setState({status:`loading`,error:null}),!d.getAccessToken()){this._setGuest();return}let e=await d.me();if(e.ok){this._setAuthenticated(e.resp);return}if(e.status===401&&(await d.refresh()).ok&&(e=await d.me(),e.ok)){this._setAuthenticated(e.resp);return}d.clearAccessToken(),this._setGuest(`Не удалось восстановить сессию`)}async signIn(e){this._setState({status:`loading`,error:null});let t=await d.signIn(e);if(!t.ok)return this._setGuest(t.resp?.Error||`Не удалось выполнить вход`),t;let n=await d.me();return n.ok?(this._setAuthenticated(n.resp),t):(this._setGuest(`Вход выполнен, но не удалось получить данные пользователя`),{ok:!1,status:n.status,resp:{Error:`Не удалось получить данные пользователя`}})}async signUp(e){this._setState({status:`loading`,error:null});let t=await d.signUp(e);if(!t.ok)return this._setGuest(t.resp?.Error||`Не удалось выполнить регистрацию`),t;let n=await d.me();return n.ok?(this._setAuthenticated(n.resp),t):(this._setGuest(`Регистрация выполнена, но не удалось получить данные пользователя`),{ok:!1,status:n.status,resp:{Error:`Не удалось получить данные пользователя`}})}async logout(){await d.logout(),this._setGuest()}},m=class extends r{constructor(e={},t=null,n=null){if(!t)throw Error(`Header: не передан parent для HeaderComponent`);if(!n)throw Error(`Header: не передан el для HeaderComponent`);super(e,Handlebars.templates[`Header.hbs`],t,n),this._unsubscribe=null,this._onDocumentClickBound=this._onDocumentClick.bind(this)}init(){return this.context=this._buildContext(p.getState(),this.context),super.init()}addEventListeners(){this._subscribeToAuth(),this._bindToggleButton(`[data-action="toggle-burger-menu"]`,this._onBurgerToggleClick),this._bindToggleButton(`[data-action="toggle-profile-menu"]`,this._onProfileToggleClick),this._bindToggleButton(`[data-action="toggle-search"]`,this._onSearchToggleClick),this._bindToggleButton(`[data-action="logout"]`,this._onLogoutClick),this._bindNodeList(`[data-action="close-all-menus"]`,this._onCloseAllMenusClick),this._bindSubmitForm(`[data-menu="search"]`,this._onSearchSubmit),document.addEventListener(`click`,this._onDocumentClickBound)}removeEventListeners(){this._unsubscribe&&=(this._unsubscribe(),null),this._unbindToggleButton(`[data-action="toggle-burger-menu"]`,this._onBurgerToggleClick),this._unbindToggleButton(`[data-action="toggle-profile-menu"]`,this._onProfileToggleClick),this._unbindToggleButton(`[data-action="toggle-search"]`,this._onSearchToggleClick),this._unbindToggleButton(`[data-action="logout"]`,this._onLogoutClick),this._unbindNodeList(`[data-action="close-all-menus"]`,this._onCloseAllMenusClick),this._unbindSubmitForm(`[data-menu="search"]`,this._onSearchSubmit),document.removeEventListener(`click`,this._onDocumentClickBound)}_onBurgerToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleBurgerMenu()};_onProfileToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleProfileMenu()};_onSearchToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleSearch()};_onCloseAllMenusClick=()=>{this.closeAllMenus()};_onSearchSubmit=e=>{e.preventDefault()};_onLogoutClick=async e=>{e.preventDefault(),e.stopPropagation(),this.closeAllMenus();let t=await p.logout();console.log(t)};_onDocumentClick(e){this.context.isAnyMenuOpen&&(this._isClickInsideMenu(e.target)||this.closeAllMenus())}toggleBurgerMenu(){this._applyMenuState({isBurgerMenuOpen:!this.context.isBurgerMenuOpen,isProfileMenuOpen:!1,isSearchOpen:!1})}closeBurgerMenu(){this.context.isBurgerMenuOpen&&this._applyMenuState({isBurgerMenuOpen:!1})}toggleProfileMenu(){this.context.isAuthorized&&this._applyMenuState({isBurgerMenuOpen:!1,isProfileMenuOpen:!this.context.isProfileMenuOpen,isSearchOpen:!1})}toggleSearch(){this._applyMenuState({isBurgerMenuOpen:!1,isProfileMenuOpen:!1,isSearchOpen:!this.context.isSearchOpen})}closeAllMenus(){!this.context.isAnyMenuOpen&&!this.context.isSearchOpen||this._applyMenuState({isBurgerMenuOpen:!1,isProfileMenuOpen:!1,isSearchOpen:!1})}_subscribeToAuth(){this._unsubscribe=p.subscribe(e=>{this.refresh(this._buildContext(e,this.context))})}_buildContext(e,t={}){let n=e.status===`authenticated`,r={...t,isAuthorized:n,userName:h(e.user?.email),isBurgerMenuOpen:t.isBurgerMenuOpen??!1,isSearchOpen:t.isSearchOpen??!1,isProfileMenuOpen:n?t.isProfileMenuOpen??!1:!1};return{...r,isAnyMenuOpen:r.isBurgerMenuOpen||r.isProfileMenuOpen}}_applyMenuState(e){let t={...this.context,...e};t.isAnyMenuOpen=t.isBurgerMenuOpen||t.isProfileMenuOpen,this.refresh(t)}_isClickInsideMenu(e){let t=this.el.querySelector(`[data-action="toggle-burger-menu"]`),n=this.el.querySelector(`[data-action="toggle-profile-menu"]`),r=this.el.querySelector(`[data-action="toggle-search"]`),i=this.el.querySelector(`[data-menu="burger"]`),a=this.el.querySelector(`[data-menu="profile"]`),o=this.el.querySelector(`[data-menu="search"]`);return t?.contains(e)||n?.contains(e)||r?.contains(e)||i?.contains(e)||a?.contains(e)||o?.contains(e)}_bindToggleButton(e,t){let n=this.el.querySelector(e);n&&n.addEventListener(`click`,t)}_unbindToggleButton(e,t){let n=this.el.querySelector(e);n&&n.removeEventListener(`click`,t)}_bindNodeList(e,t){this.el.querySelectorAll(e).forEach(e=>{e.addEventListener(`click`,t)})}_unbindNodeList(e,t){this.el.querySelectorAll(e).forEach(e=>{e.removeEventListener(`click`,t)})}_bindSubmitForm(e,t){let n=this.el.querySelector(e);n&&n.addEventListener(`submit`,t)}_unbindSubmitForm(e,t){let n=this.el.querySelector(e);n&&n.removeEventListener(`submit`,t)}};function h(e=``){let t=String(e).trim();if(!t)return``;let n=t.indexOf(`@`);return n===-1?t:t.slice(0,n)}(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`MoviePoster.hbs`]=e({0:function(e,t,n,r,i){return` movie-poster-card__image--contained`},1:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`        <div class="movie-poster-card__content movie-poster-card__content--always">
          <h3 class="movie-poster-card__title">`+e.escapeExpression((a=(a=s(n,`title`)||(t==null?t:s(t,`title`)))??e.hooks.helperMissing,typeof a==`function`?a.call(o,{name:`title`,hash:{},data:i,loc:{start:{line:17,column:47},end:{line:17,column:56}}}):a))+`</h3>
`+(s(n,`if`).call(o,t==null?t:s(t,`isHero`),{name:`if`,hash:{},fn:e.program(2,i,0),inverse:e.program(5,i,0),data:i,loc:{start:{line:18,column:10},end:{line:30,column:17}}})??``)+(s(n,`if`).call(o,t==null?t:s(t,`showDescription`),{name:`if`,hash:{},fn:e.program(7,i,0),inverse:e.noop,data:i,loc:{start:{line:31,column:10},end:{line:33,column:17}}})??``)+`          <div class="movie-poster-card__footer">
`+(s(n,`if`).call(o,t==null?t:s(t,`showButton`),{name:`if`,hash:{},fn:e.program(8,i,0),inverse:e.noop,data:i,loc:{start:{line:35,column:12},end:{line:37,column:19}}})??``)+(s(n,`if`).call(o,t==null?t:s(t,`hasRatings`),{name:`if`,hash:{},fn:e.program(9,i,0),inverse:e.noop,data:i,loc:{start:{line:38,column:12},end:{line:47,column:19}}})??``)+`          </div>
        </div>
`},2:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return(a=o(n,`if`).call(t??(e.nullContext||{}),(a=t==null?t:o(t,`heroFacts`))==null?a:o(a,`length`),{name:`if`,hash:{},fn:e.program(3,i,0),inverse:e.noop,data:i,loc:{start:{line:19,column:12},end:{line:25,column:19}}}))??``},3:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <div class="movie-poster-card__meta movie-poster-card__meta--hero">
`+(a(n,`each`).call(t??(e.nullContext||{}),t==null?t:a(t,`heroFacts`),{name:`each`,hash:{},fn:e.program(4,i,0),inverse:e.noop,data:i,loc:{start:{line:21,column:16},end:{line:23,column:25}}})??``)+`              </div>
`},4:function(e,t,n,r,i){return`                  <span class="movie-poster-card__meta-pill">`+e.escapeExpression(e.lambda(t,t))+`</span>
`},5:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return a(n,`if`).call(t??(e.nullContext||{}),t==null?t:a(t,`genreText`),{name:`if`,hash:{},fn:e.program(6,i,0),inverse:e.noop,data:i,loc:{start:{line:27,column:12},end:{line:29,column:19}}})??``},6:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <div class="movie-poster-card__genres">`+e.escapeExpression((a=(a=o(n,`genreText`)||(t==null?t:o(t,`genreText`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`genreText`,hash:{},data:i,loc:{start:{line:28,column:53},end:{line:28,column:66}}}):a))+`</div>
`},7:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`            <p class="movie-poster-card__description">`+e.escapeExpression((a=(a=o(n,`description`)||(t==null?t:o(t,`description`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`description`,hash:{},data:i,loc:{start:{line:32,column:54},end:{line:32,column:69}}}):a))+`</p>
`},8:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <span class="movie-poster-card__button">`+e.escapeExpression((a=(a=o(n,`actionText`)||(t==null?t:o(t,`actionText`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`actionText`,hash:{},data:i,loc:{start:{line:36,column:54},end:{line:36,column:68}}}):a))+`</span>
`},9:function(e,t,n,r,i){var a=t??(e.nullContext||{}),o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <div class="movie-poster-card__ratings">
`+(o(n,`if`).call(a,t==null?t:o(t,`imdbRating`),{name:`if`,hash:{},fn:e.program(10,i,0),inverse:e.noop,data:i,loc:{start:{line:40,column:16},end:{line:42,column:23}}})??``)+(o(n,`if`).call(a,t==null?t:o(t,`kpRating`),{name:`if`,hash:{},fn:e.program(11,i,0),inverse:e.noop,data:i,loc:{start:{line:43,column:16},end:{line:45,column:23}}})??``)+`              </div>
`},10:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                  <span class="movie-poster-card__rating">IMDb `+e.escapeExpression((a=(a=o(n,`imdbRating`)||(t==null?t:o(t,`imdbRating`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`imdbRating`,hash:{},data:i,loc:{start:{line:41,column:63},end:{line:41,column:77}}}):a))+`</span>
`},11:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                  <span class="movie-poster-card__rating">KP `+e.escapeExpression((a=(a=o(n,`kpRating`)||(t==null?t:o(t,`kpRating`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`kpRating`,hash:{},data:i,loc:{start:{line:44,column:61},end:{line:44,column:73}}}):a))+`</span>
`},12:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`        <div class="movie-poster-card__overlay">
          <div class="movie-poster-card__overlay-inner">
            <h3 class="movie-poster-card__title">`+e.escapeExpression((a=(a=s(n,`title`)||(t==null?t:s(t,`title`)))??e.hooks.helperMissing,typeof a==`function`?a.call(o,{name:`title`,hash:{},data:i,loc:{start:{line:55,column:49},end:{line:55,column:58}}}):a))+`</h3>
`+(s(n,`if`).call(o,t==null?t:s(t,`genreText`),{name:`if`,hash:{},fn:e.program(6,i,0),inverse:e.noop,data:i,loc:{start:{line:56,column:12},end:{line:58,column:19}}})??``)+(s(n,`if`).call(o,t==null?t:s(t,`showDescription`),{name:`if`,hash:{},fn:e.program(13,i,0),inverse:e.noop,data:i,loc:{start:{line:59,column:12},end:{line:61,column:19}}})??``)+`            <div class="movie-poster-card__footer">
`+(s(n,`if`).call(o,t==null?t:s(t,`showButton`),{name:`if`,hash:{},fn:e.program(14,i,0),inverse:e.noop,data:i,loc:{start:{line:63,column:14},end:{line:65,column:21}}})??``)+(s(n,`if`).call(o,t==null?t:s(t,`hasRatings`),{name:`if`,hash:{},fn:e.program(15,i,0),inverse:e.noop,data:i,loc:{start:{line:66,column:14},end:{line:75,column:21}}})??``)+`            </div>
          </div>
        </div>
`},13:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <p class="movie-poster-card__description">`+e.escapeExpression((a=(a=o(n,`description`)||(t==null?t:o(t,`description`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`description`,hash:{},data:i,loc:{start:{line:60,column:56},end:{line:60,column:71}}}):a))+`</p>
`},14:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                <span class="movie-poster-card__button">`+e.escapeExpression((a=(a=o(n,`actionText`)||(t==null?t:o(t,`actionText`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`actionText`,hash:{},data:i,loc:{start:{line:64,column:56},end:{line:64,column:70}}}):a))+`</span>
`},15:function(e,t,n,r,i){var a=t??(e.nullContext||{}),o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                <div class="movie-poster-card__ratings">
`+(o(n,`if`).call(a,t==null?t:o(t,`imdbRating`),{name:`if`,hash:{},fn:e.program(16,i,0),inverse:e.noop,data:i,loc:{start:{line:68,column:18},end:{line:70,column:25}}})??``)+(o(n,`if`).call(a,t==null?t:o(t,`kpRating`),{name:`if`,hash:{},fn:e.program(17,i,0),inverse:e.noop,data:i,loc:{start:{line:71,column:18},end:{line:73,column:25}}})??``)+`                </div>
`},16:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                    <span class="movie-poster-card__rating">IMDb `+e.escapeExpression((a=(a=o(n,`imdbRating`)||(t==null?t:o(t,`imdbRating`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`imdbRating`,hash:{},data:i,loc:{start:{line:69,column:65},end:{line:69,column:79}}}):a))+`</span>
`},17:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                    <span class="movie-poster-card__rating">KP `+e.escapeExpression((a=(a=o(n,`kpRating`)||(t==null?t:o(t,`kpRating`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`kpRating`,hash:{},data:i,loc:{start:{line:72,column:63},end:{line:72,column:75}}}):a))+`</span>
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.hooks.helperMissing,c=`function`,l=e.escapeExpression,u=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<article
  class="movie-poster-card movie-poster-card--`+l((a=(a=u(n,`size`)||(t==null?t:u(t,`size`)))??s,typeof a===c?a.call(o,{name:`size`,hash:{},data:i,loc:{start:{line:2,column:46},end:{line:2,column:54}}}):a))+` movie-poster-card--`+l((a=(a=u(n,`variant`)||(t==null?t:u(t,`variant`)))??s,typeof a===c?a.call(o,{name:`variant`,hash:{},data:i,loc:{start:{line:2,column:74},end:{line:2,column:85}}}):a))+`"
  data-movie-id="`+l((a=(a=u(n,`id`)||(t==null?t:u(t,`id`)))??s,typeof a===c?a.call(o,{name:`id`,hash:{},data:i,loc:{start:{line:3,column:17},end:{line:3,column:23}}}):a))+`"
>
  <a class="movie-poster-card__link" href="`+l((a=(a=u(n,`href`)||(t==null?t:u(t,`href`)))??s,typeof a===c?a.call(o,{name:`href`,hash:{},data:i,loc:{start:{line:5,column:43},end:{line:5,column:51}}}):a))+`" router-link>
    <div class="movie-poster-card__media">
      <img
        class="movie-poster-card__image`+(u(n,`if`).call(o,t==null?t:u(t,`useContainedImage`),{name:`if`,hash:{},fn:e.program(0,i,0),inverse:e.noop,data:i,loc:{start:{line:8,column:39},end:{line:8,column:107}}})??``)+`"
        src="`+l((a=(a=u(n,`imageUrl`)||(t==null?t:u(t,`imageUrl`)))??s,typeof a===c?a.call(o,{name:`imageUrl`,hash:{},data:i,loc:{start:{line:9,column:13},end:{line:9,column:25}}}):a))+`"
        alt="`+l((a=(a=u(n,`title`)||(t==null?t:u(t,`title`)))??s,typeof a===c?a.call(o,{name:`title`,hash:{},data:i,loc:{start:{line:10,column:13},end:{line:10,column:22}}}):a))+`"
        draggable="false"
      />
      <div class="movie-poster-card__shade"></div>

`+(u(n,`if`).call(o,t==null?t:u(t,`showAlwaysContent`),{name:`if`,hash:{},fn:e.program(1,i,0),inverse:e.noop,data:i,loc:{start:{line:15,column:6},end:{line:50,column:13}}})??``)+`
`+(u(n,`if`).call(o,t==null?t:u(t,`showOverlay`),{name:`if`,hash:{},fn:e.program(12,i,0),inverse:e.noop,data:i,loc:{start:{line:52,column:6},end:{line:79,column:13}}})??``)+`    </div>
  </a>
</article>
`},useData:!0})})();var g=`default`,_=`medium`,v=`Смотреть`,y=class extends r{constructor(e={},t=null,n=null){if(!t)throw Error(`MoviePoster: не передан parent для MoviePosterComponent`);if(!n)throw Error(`MoviePoster: не передан el для MoviePosterComponent`);super(e,Handlebars.templates[`MoviePoster.hbs`],t,n)}init(){return this.context=b(this.context),super.init()}};function b(e={}){let t=e.variant||g,n=e.size||_,r=C(e.genres),i=T(e.description),a=w(e.ageRating||e.age_rating||e.ageLimit),o=E(e.imdbRating||e.imdb_rating),s=E(e.kpRating||e.kp_rating),c=t===`hero`&&!!e.backdropUrl,l=(c?e.backdropUrl:null)||e.posterUrl||e.backdropUrl||`img/image_11.jpg`,u=x(t);return{...e,variant:t,size:n,imageUrl:l,href:e.href||`/movie`,actionText:e.actionText||v,description:i,genreText:r.join(` • `),heroFacts:S(a,r),imdbRating:o,kpRating:s,hasRatings:t!==`hero`&&!!(o||s),isHero:t===`hero`,useContainedImage:t===`hero`&&!c,showAlwaysContent:u.showAlwaysContent,showOverlay:u.showOverlay,showDescription:u.showDescription&&!!i,showButton:u.showButton}}function x(e){return e===`compact`?{showAlwaysContent:!1,showOverlay:!0,showDescription:!1,showButton:!1}:e===`hero`?{showAlwaysContent:!0,showOverlay:!1,showDescription:!0,showButton:!0}:{showAlwaysContent:!1,showOverlay:!0,showDescription:!0,showButton:!0}}function S(e,t=[]){return[e,...t].filter(Boolean)}function C(e){return Array.isArray(e)?e.filter(Boolean).map(e=>String(e).trim()):typeof e==`string`&&e.trim()?e.split(`,`).map(e=>e.trim()).filter(Boolean):[]}function w(e){if(e==null||e===``)return``;let t=String(e).trim();return t?t.endsWith(`+`)?t:`${t}+`:``}function T(e){let t=String(e||``).trim();return t?t.length>160?`${t.slice(0,157).trim()}...`:t:``}function E(e){if(e==null||e===``)return``;let t=Number(e);return Number.isFinite(t)?t.toFixed(1):String(e).trim()}(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`PosterCarousel.hbs`]=e({0:function(e,t,n,r,i){return` poster-carousel--centered-hero`},1:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`    <header class="poster-carousel__header">
      <h2 class="poster-carousel__title">`+e.escapeExpression((a=(a=o(n,`title`)||(t==null?t:o(t,`title`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`title`,hash:{},data:i,loc:{start:{line:6,column:41},end:{line:6,column:50}}}):a))+`</h2>
    </header>
`},2:function(e,t,n,r,i){return`      <button
        class="poster-carousel__arrow poster-carousel__arrow--prev"
        type="button"
        data-action="scroll-prev"
        aria-label="Прокрутить влево"
      >
        <span>&lsaquo;</span>
      </button>
`},3:function(e,t,n,r,i){var a=e.lambda,o=e.escapeExpression,s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`          <div
            class="poster-carousel__slide poster-carousel__slide--`+o(a(t==null?t:s(t,`size`),t))+` poster-carousel__slide--`+o(a(t==null?t:s(t,`variant`),t))+`"
            data-index="`+o(a(t==null?t:s(t,`slideIndex`),t))+`"
          >
            <div data-poster-slot="`+o(a(t==null?t:s(t,`slotKey`),t))+`" class="poster-carousel__slot"></div>
          </div>
`},4:function(e,t,n,r,i){return`      <button
        class="poster-carousel__arrow poster-carousel__arrow--next"
        type="button"
        data-action="scroll-next"
        aria-label="Прокрутить вправо"
      >
        <span>&rsaquo;</span>
      </button>
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<section
  class="poster-carousel poster-carousel--`+e.escapeExpression((a=(a=s(n,`variant`)||(t==null?t:s(t,`variant`)))??e.hooks.helperMissing,typeof a==`function`?a.call(o,{name:`variant`,hash:{},data:i,loc:{start:{line:2,column:42},end:{line:2,column:53}}}):a))+(s(n,`if`).call(o,t==null?t:s(t,`centeredHero`),{name:`if`,hash:{},fn:e.program(0,i,0),inverse:e.noop,data:i,loc:{start:{line:2,column:53},end:{line:2,column:111}}})??``)+`"
>
`+(s(n,`if`).call(o,t==null?t:s(t,`title`),{name:`if`,hash:{},fn:e.program(1,i,0),inverse:e.noop,data:i,loc:{start:{line:4,column:2},end:{line:8,column:9}}})??``)+`
  <div class="poster-carousel__viewport-wrap">
`+(s(n,`if`).call(o,t==null?t:s(t,`showArrows`),{name:`if`,hash:{},fn:e.program(2,i,0),inverse:e.noop,data:i,loc:{start:{line:11,column:4},end:{line:20,column:11}}})??``)+`
    <div class="poster-carousel__viewport" data-role="viewport">
      <div class="poster-carousel__track">
`+(s(n,`each`).call(o,t==null?t:s(t,`posterItems`),{name:`each`,hash:{},fn:e.program(3,i,0),inverse:e.noop,data:i,loc:{start:{line:24,column:8},end:{line:31,column:17}}})??``)+`      </div>
    </div>

`+(s(n,`if`).call(o,t==null?t:s(t,`showArrows`),{name:`if`,hash:{},fn:e.program(4,i,0),inverse:e.noop,data:i,loc:{start:{line:35,column:4},end:{line:44,column:11}}})??``)+`  </div>
</section>
`},useData:!0})})();var D=class extends r{constructor(e={},t=null,n=null){if(!t)throw Error(`PosterCarousel: не передан parent для PosterCarouselComponent`);if(!n)throw Error(`PosterCarousel: не передан el для PosterCarouselComponent`);super(e,Handlebars.templates[`PosterCarousel.hbs`],t,n),this._dragState=null,this._isHeroCycling=!1,this._onDocumentMouseMoveBound=this._onDocumentMouseMove.bind(this),this._onDocumentMouseUpBound=this._onDocumentMouseUp.bind(this),this._onWindowResizeBound=this._onWindowResize.bind(this),this._onSlideClickBound=this._onSlideClick.bind(this)}init(){return this.context=ee(this.context),super.init()}setupChildren(){this.context.posterItems.forEach(e=>{let t=this.el.querySelector(`[data-poster-slot="${e.slotKey}"]`);t&&this.addChild(`poster-${e.slotKey}`,new y(e,this,t))})}addEventListeners(){let e=this.el.querySelector(`[data-action="scroll-prev"]`),t=this.el.querySelector(`[data-action="scroll-next"]`),n=this.el.querySelector(`[data-role="viewport"]`),r=this.el.querySelectorAll(`.poster-carousel__slide`);e?.addEventListener(`click`,this._onPrevClick),t?.addEventListener(`click`,this._onNextClick),n?.addEventListener(`mousedown`,this._onViewportMouseDown),r.forEach(e=>e.addEventListener(`click`,this._onSlideClickBound)),document.addEventListener(`mousemove`,this._onDocumentMouseMoveBound),document.addEventListener(`mouseup`,this._onDocumentMouseUpBound),window.addEventListener(`resize`,this._onWindowResizeBound),this.context.centeredHero&&this._applyActiveSlideState()}removeEventListeners(){let e=this.el.querySelector(`[data-action="scroll-prev"]`),t=this.el.querySelector(`[data-action="scroll-next"]`),n=this.el.querySelector(`[data-role="viewport"]`),r=this.el.querySelectorAll(`.poster-carousel__slide`);e?.removeEventListener(`click`,this._onPrevClick),t?.removeEventListener(`click`,this._onNextClick),n?.removeEventListener(`mousedown`,this._onViewportMouseDown),r.forEach(e=>e.removeEventListener(`click`,this._onSlideClickBound)),document.removeEventListener(`mousemove`,this._onDocumentMouseMoveBound),document.removeEventListener(`mouseup`,this._onDocumentMouseUpBound),window.removeEventListener(`resize`,this._onWindowResizeBound)}_onPrevClick=()=>{if(this.context.centeredHero){this._cycleHero(-1);return}this._scrollByDirection(-1)};_onNextClick=()=>{if(this.context.centeredHero){this._cycleHero(1);return}this._scrollByDirection(1)};_onSlideClick(e){if(!this.context.centeredHero)return;let t=e.currentTarget;if(t.classList.contains(`is-prev`)){this._cycleHero(-1);return}t.classList.contains(`is-next`)&&this._cycleHero(1)}_onViewportMouseDown=e=>{if(this.context.centeredHero||e.button!==0)return;let t=this.el.querySelector(`[data-role="viewport"]`);t&&(this._dragState={startX:e.pageX,scrollLeft:t.scrollLeft},t.classList.add(`is-dragging`))};_onDocumentMouseMove(e){if(!this._dragState)return;let t=this.el.querySelector(`[data-role="viewport"]`);if(!t)return;let n=e.pageX-this._dragState.startX;t.scrollLeft=this._dragState.scrollLeft-n}_onDocumentMouseUp(){this._dragState&&=(this.el.querySelector(`[data-role="viewport"]`)?.classList.remove(`is-dragging`),null)}_onWindowResize(){if(!this.context.centeredHero)return;let e=this.el.querySelector(`.poster-carousel__track`);e&&(e.style.transition=`none`,e.style.transform=`translateX(0)`,this._applyActiveSlideState())}_scrollByDirection(e){let t=this.el.querySelector(`[data-role="viewport"]`);t&&t.scrollBy({left:t.clientWidth*.82*e,behavior:`smooth`})}_applyActiveSlideState(){let e=Array.from(this.el.querySelectorAll(`.poster-carousel__slide`)),t=Math.floor(e.length/2);e.forEach((e,n)=>{e.classList.toggle(`is-active`,n===t),e.classList.toggle(`is-prev`,n===t-1),e.classList.toggle(`is-next`,n===t+1)})}_cycleHero(e){if(!this.context.centeredHero||this._isHeroCycling)return;let t=this.el.querySelector(`.poster-carousel__track`),n=Array.from(t?.children||[]);if(!t||n.length<2)return;this._isHeroCycling=!0;let r=te(t);if(e>0){let e=n[0],i=e.getBoundingClientRect().width+r;t.style.transition=`transform ${O}ms ease`,t.style.transform=`translateX(${-i}px)`,t.addEventListener(`transitionend`,()=>{t.style.transition=`none`,t.style.transform=`translateX(0)`,t.append(e),this._applyActiveSlideState(),this._isHeroCycling=!1},{once:!0});return}let i=n[n.length-1];t.prepend(i);let a=i.getBoundingClientRect().width+r;t.style.transition=`none`,t.style.transform=`translateX(${-a}px)`,t.offsetWidth,t.style.transition=`transform ${O}ms ease`,t.style.transform=`translateX(0)`,t.addEventListener(`transitionend`,()=>{t.style.transition=`none`,t.style.transform=`translateX(0)`,this._applyActiveSlideState(),this._isHeroCycling=!1},{once:!0})}},O=320;function ee(e={}){let t=Array.isArray(e.movies)?e.movies:[],n=e.posterSize||`medium`,r=e.posterVariant||`default`,i=!!e.centeredHero;return{...e,showArrows:e.showArrows!==!1,centeredHero:i,posterItems:t.map((t,a)=>({...t,size:i?`hero`:t.size||n,variant:i?`hero`:t.variant||r,slotKey:t.slotKey||`${e.slug||`carousel`}-${a}`,slideIndex:a}))}}function te(e){let t=window.getComputedStyle(e);return Number.parseFloat(t.columnGap||t.gap||`0`)||0}var ne=class extends i{constructor(e={},t=null,n=null){if(!n)throw Error(`Main: не передан корневой элемент для MainPage`);super(e,Handlebars.templates[`Main.hbs`],t,n,`MainPage`),this._contextLoaded=!1}init(){return super.init(),this._contextLoaded||this.loadContext(),this}async loadContext(){let{ok:e,resp:t}=await l.getAllSelections(),n=e?re(t):[],r={...this.context,selectionEntries:n,heroMovies:ie(n)};e||console.log(`Фильмы не прилетели с бэка`),this._contextLoaded=!0,this.refresh(r)}addEventListeners(){super.addEventListeners()}removeEventListeners(){super.removeEventListeners()}setupChildren(){let e=this.el.querySelector(`#header`);if(!e)throw Error(`Main: не найден header в шаблоне Main.hbs`);this.addChild(`header`,new m({...this.context.userData},this,e)),this._setupHeroCarousel(),this._setupSelectionCarousels()}_setupHeroCarousel(){let e=this.el.querySelector(`#hero-carousel`);!e||!Array.isArray(this.context.heroMovies)||!this.context.heroMovies.length||this.addChild(`hero-carousel`,new D({slug:`hero`,movies:this.context.heroMovies,posterVariant:`default`,posterSize:`medium`,centeredHero:!0,showArrows:!0},this,e))}_setupSelectionCarousels(){(Array.isArray(this.context.selectionEntries)?this.context.selectionEntries:[]).forEach(e=>{let t=this.el.querySelector(`[data-selection-slot="${e.slotKey}"]`);t&&this.addChild(`selection-${e.slotKey}`,new D({slug:e.slotKey,title:e.title,movies:e.movies,posterVariant:`default`,posterSize:`medium`,showArrows:!1},this,t))})}};function re(e=[]){return e.map((e,t)=>({title:e.title||`Подборка ${t+1}`,slotKey:`selection-${t}`,movies:ae(e.movies)}))}function ie(e=[]){let t=e.flatMap(e=>e.movies).slice(0,3);return t.length?t:k()}function ae(e=[]){return e.map((e,t)=>oe(e,t))}function oe(e={},t=0){return{id:e.id??`movie-${t}`,title:e.title||e.name||`Фильм`,posterUrl:e.posterUrl||e.poster_url||e.img_url||`img/image_10.jpg`,backdropUrl:e.backdropUrl||e.backdrop_url||``,ageRating:e.ageRating||e.age_rating||e.ageLimit||e.age_limit||`18+`,genres:e.genres||e.genre||[],description:e.description||e.summary||`Погрузитесь в атмосферу кино с подборкой фильмов, собранной специально для VKino.`,imdbRating:e.imdbRating||e.imdb_rating||``,kpRating:e.kpRating||e.kp_rating||``,actionText:`Смотреть`,href:`/movie`}}function k(){return[{id:`fallback-hero-1`,title:`Интерстеллар`,posterUrl:`img/image_10.jpg`,backdropUrl:`img/image_10.jpg`,ageRating:`16+`,genres:[`Триллер`,`Драма`],description:`История о случайной встрече, которая меняет планы на одну длинную ночь.`,imdbRating:`7.8`,kpRating:`7.6`,actionText:`Смотреть`,href:`/movie`},{id:`fallback-hero-2`,title:`Интерстеллар`,posterUrl:`img/image_11.jpg`,backdropUrl:`img/image_11.jpg`,ageRating:`12+`,genres:[`Мелодрама`,`Приключения`],description:`Теплая история о выборе, свободе и людях, которые появляются в нужный момент.`,imdbRating:`8.1`,kpRating:`7.9`,actionText:`Смотреть`,href:`/movie`},{id:`fallback-hero-3`,title:`Дюна`,posterUrl:`img/image_12.jpg`,backdropUrl:`img/image_12.jpg`,ageRating:`18+`,genres:[`Боевик`,`Криминал`],description:`Одна поездка через весь город превращается в гонку, из которой нельзя выйти раньше времени.`,imdbRating:`7.4`,kpRating:`7.3`,actionText:`Смотреть`,href:`/movie`}]}(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Movie.hbs`]=e({0:function(e,t,n,r,i){return`      <section class="movie-section">
        <h2 class="movie-section-title">Загрузка фильма</h2>
        <p class="movie-description">Получаем данные с сервера...</p>
      </section>
`},1:function(e,t,n,r,i){var a,o=t??(e.nullContext||{}),s=e.lambda,c=e.escapeExpression,l=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return((a=l(n,`if`).call(o,t==null?t:l(t,`hasError`),{name:`if`,hash:{},fn:e.program(2,i,0),inverse:e.noop,data:i,loc:{start:{line:11,column:6},end:{line:16,column:13}}}))??``)+`
      <section class="movie-hero">
        <div class="movie-poster-wrap">
          <img
            class="movie-main-poster"
            src="`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`posterUrl`),t))+`"
            alt="Постер фильма `+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`title`),t))+`"
          />
          <button class="movie-favorite-btn" type="button" aria-label="В избранное">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12.001 20.727L10.585 19.438C5.554 14.874 2.25 11.878 2.25 8.227C2.25 5.231 4.602 2.875 7.59 2.875C9.279 2.875 10.9 3.662 12.001 4.907C13.101 3.662 14.722 2.875 16.411 2.875C19.399 2.875 21.75 5.231 21.75 8.227C21.75 11.878 18.447 14.874 13.417 19.438L12.001 20.727Z"
                stroke="currentColor"
                stroke-width="1.8"
              />
            </svg>
          </button>
        </div>

        <div class="movie-hero-content">
          <h1 class="movie-title">`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`title`),t))+`</h1>

          <dl class="movie-meta">
            <div class="movie-meta-row">
              <dt>Длительность</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`duration`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Возраст</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`age`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Жанр</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`genres`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Страна</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`country`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Режиссер</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`director`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Тип контента</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`contentType`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Год</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`releaseYear`),t))+`</dd>
            </div>
            <div class="movie-meta-row">
              <dt>Язык</dt>
              <dd>`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`language`),t))+`</dd>
            </div>
          </dl>

          <div class="movie-ratings">
`+((a=l(n,`if`).call(o,(a=t==null?t:l(t,`movie`))==null?a:l(a,`ratings`),{name:`if`,hash:{},fn:e.program(3,i,0),inverse:e.program(5,i,0),data:i,loc:{start:{line:81,column:12},end:{line:93,column:19}}}))??``)+`          </div>

          <p class="movie-description">`+c(s((a=t==null?t:l(t,`movie`))==null?a:l(a,`description`),t))+`</p>

          <div class="movie-action-row">
            <button class="movie-btn movie-btn-primary" type="button">
              Смотреть
            </button>
            <button class="movie-btn movie-btn-secondary" type="button">
              Смотреть позже
            </button>
            <button class="movie-btn movie-btn-secondary" type="button">
              Совместный просмотр
            </button>
            <button class="movie-btn movie-btn-primary" type="button">
              + Создать комнату
            </button>
          </div>
        </div>
      </section>

      <section class="movie-section">
        <h2 class="movie-section-title">Смотреть официальный трейлер</h2>
`+((a=l(n,`if`).call(o,(a=t==null?t:l(t,`movie`))==null?a:l(a,`trailerUrl`),{name:`if`,hash:{},fn:e.program(6,i,0),inverse:e.program(7,i,0),data:i,loc:{start:{line:117,column:8},end:{line:140,column:15}}}))??``)+`      </section>

      <section class="movie-section">
        <h2 class="movie-section-title">Актерский состав</h2>
`+((a=l(n,`if`).call(o,(a=t==null?t:l(t,`movie`))==null?a:l(a,`cast`),{name:`if`,hash:{},fn:e.program(8,i,0),inverse:e.program(10,i,0),data:i,loc:{start:{line:145,column:8},end:{line:156,column:15}}}))??``)+`      </section>

      <section class="movie-section">
        <h2 class="movie-section-title">Смотреть также</h2>
        <div class="movie-filter-row">
          <button class="movie-filter-btn is-active" type="button">Похожие</button>
        </div>

`+((a=l(n,`if`).call(o,(a=t==null?t:l(t,`movie`))==null?a:l(a,`similar`),{name:`if`,hash:{},fn:e.program(11,i,0),inverse:e.program(13,i,0),data:i,loc:{start:{line:165,column:8},end:{line:175,column:15}}}))??``)+`      </section>
`},2:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`        <section class="movie-section movie-error-section">
          <h2 class="movie-section-title">Не удалось загрузить фильм</h2>
          <p class="movie-description">`+e.escapeExpression((a=(a=o(n,`errorText`)||(t==null?t:o(t,`errorText`)))??e.hooks.helperMissing,typeof a==`function`?a.call(t??(e.nullContext||{}),{name:`errorText`,hash:{},data:i,loc:{start:{line:14,column:39},end:{line:14,column:52}}}):a))+`</p>
        </section>
`},3:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return(a=o(n,`each`).call(t??(e.nullContext||{}),(a=t==null?t:o(t,`movie`))==null?a:o(a,`ratings`),{name:`each`,hash:{},fn:e.program(4,i,0),inverse:e.noop,data:i,loc:{start:{line:82,column:14},end:{line:87,column:23}}}))??``},4:function(e,t,n,r,i){var a=e.lambda,o=e.escapeExpression,s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`                <div class="movie-rating-card">
                  <span class="movie-rating-source">`+o(a(t==null?t:s(t,`source`),t))+`</span>
                  <span class="movie-rating-value">`+o(a(t==null?t:s(t,`value`),t))+`</span>
                </div>
`},5:function(e,t,n,r,i){return`              <div class="movie-rating-card">
                <span class="movie-rating-source">Рейтинг</span>
                <span class="movie-rating-value">Недоступно</span>
              </div>
`},6:function(e,t,n,r,i){var a,o=e.lambda,s=e.escapeExpression,c=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`          <a
            class="movie-trailer"
            href="`+s(o((a=t==null?t:c(t,`movie`))==null?a:c(a,`trailerUrl`),t))+`"
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              class="movie-trailer-image"
              src="`+s(o((a=t==null?t:c(t,`movie`))==null?a:c(a,`trailerPreviewUrl`),t))+`"
              alt="Официальный трейлер фильма `+s(o((a=t==null?t:c(t,`movie`))==null?a:c(a,`title`),t))+`"
            />
            <span class="movie-trailer-play" aria-hidden="true">▶</span>
          </a>
`},7:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`          <div class="movie-trailer movie-trailer-disabled">
            <img
              class="movie-trailer-image"
              src="`+e.escapeExpression(e.lambda((a=t==null?t:o(t,`movie`))==null?a:o(a,`trailerPreviewUrl`),t))+`"
              alt="Трейлер недоступен"
            />
            <span class="movie-empty-overlay">Трейлер недоступен</span>
          </div>
`},8:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`          <div class="movie-cast-list">
`+((a=o(n,`each`).call(t??(e.nullContext||{}),(a=t==null?t:o(t,`movie`))==null?a:o(a,`cast`),{name:`each`,hash:{},fn:e.program(9,i,0),inverse:e.noop,data:i,loc:{start:{line:147,column:12},end:{line:152,column:21}}}))??``)+`          </div>
`},9:function(e,t,n,r,i){var a=e.lambda,o=e.escapeExpression,s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <article class="movie-cast-card">
                <img src="`+o(a(t==null?t:s(t,`imgUrl`),t))+`" alt="`+o(a(t==null?t:s(t,`name`),t))+`" />
                <p>`+o(a(t==null?t:s(t,`name`),t))+`</p>
              </article>
`},10:function(e,t,n,r,i){return`          <p class="movie-empty-text">Данные об актерах пока недоступны.</p>
`},11:function(e,t,n,r,i){var a,o=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`          <div class="movie-similar-list">
`+((a=o(n,`each`).call(t??(e.nullContext||{}),(a=t==null?t:o(t,`movie`))==null?a:o(a,`similar`),{name:`each`,hash:{},fn:e.program(12,i,0),inverse:e.noop,data:i,loc:{start:{line:167,column:12},end:{line:171,column:21}}}))??``)+`          </div>
`},12:function(e,t,n,r,i){var a=e.lambda,o=e.escapeExpression,s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <a class="movie-similar-link" href="/movie?id=`+o(a(t==null?t:s(t,`id`),t))+`" router-link>
                <img class="movie-poster" src="`+o(a(t==null?t:s(t,`imgUrl`),t))+`" alt="`+o(a(t==null?t:s(t,`title`),t))+`" />
              </a>
`},13:function(e,t,n,r,i){return`          <p class="movie-empty-text">Похожие фильмы не найдены.</p>
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<div class="movie-page">
  <header id="header"></header>

  <main class="movie-details-page">
`+(a(n,`if`).call(t??(e.nullContext||{}),t==null?t:a(t,`loading`),{name:`if`,hash:{},fn:e.program(0,i,0),inverse:e.program(1,i,0),data:i,loc:{start:{line:5,column:4},end:{line:177,column:11}}})??``)+`  </main>
</div>
`},useData:!0})})();var A=`img/image_12.jpg`,j={1:`Россия`,2:`США`},M={1:`Русский`,2:`Английский`},N={film:`Фильм`,serial:`Сериал`,cartoon:`Мультфильм`},P=class extends i{constructor(e={},t=null,n=null){if(!n)throw Error(`Movie: не передан корневой элемент для Movie`);super({loading:!0,hasError:!1,errorText:``,movie:R(),...e},Handlebars.templates[`Movie.hbs`],t,n,`MoviePage`),this._contextLoaded=!1}init(){return super.init(),this._contextLoaded||this.loadContext(),this}async loadContext(){let e=F();if(!e){this._contextLoaded=!0,this.refresh({...this.context,loading:!1,hasError:!0,errorText:`В URL не указан id фильма`,movie:R()});return}if(!I(e)){this._contextLoaded=!0,this.refresh({...this.context,loading:!1,hasError:!0,errorText:`Некорректный формат id фильма`,movie:R(e)});return}let{ok:t,status:n,resp:r,error:i}=await l.getMovieById(e);if(!t){this._contextLoaded=!0,this.refresh({...this.context,loading:!1,hasError:!0,errorText:L(n,i),movie:R(e)});return}this._contextLoaded=!0,this.refresh({...this.context,loading:!1,hasError:!1,errorText:``,movie:z(r)})}setupChildren(){let e=this.el.querySelector(`#header`);if(!e)throw Error(`Movie: не найден header в шаблоне Movie.hbs`);this.addChild(`header`,new m({...this.context.userData},this,e))}};function F(){let e=new URLSearchParams(window.location.search);return String(e.get(`id`)||``).trim()||``}function I(e){return c.test(String(e||``).trim())}function L(e,t=``){return e===400?`Некорректный id фильма`:e===404?`Фильм не найден`:e===500?`Внутренняя ошибка сервера`:t||`Не удалось загрузить данные фильма`}function R(e=``){let t=J(e);return{id:t,title:t?`Фильм #${t}`:`Фильм`,description:`Описание недоступно`,director:`Не указан`,contentType:`Не указан`,releaseYear:`Не указан`,duration:`Не указана`,age:`Не указан`,language:`Не указан`,country:`Не указана`,genres:`Не указаны`,posterUrl:A,trailerUrl:``,trailerPreviewUrl:A,ratings:[],cast:[],similar:[]}}function z(e){if(!e||typeof e!=`object`)return R();let t=R(e.id),n=q(e.img_url)||t.posterUrl;return{...t,id:J(e.id)||t.id,title:J(e.title)||t.title,description:J(e.description)||t.description,director:J(e.director)||t.director,contentType:K(e.content_type),releaseYear:se(e.release_year),duration:B(e.duration_seconds),age:V(e.age_limit),language:G(e.original_language_id),country:W(e.country_id),genres:H(e.genres),posterUrl:n,trailerPreviewUrl:n,cast:U(e.actors)}}function B(e){let t=Number(e);if(!Number.isFinite(t)||t<=0)return`Не указана`;let n=Math.floor(t/60),r=Math.floor(n/60),i=n%60;return r?i?`${r}ч ${i}м`:`${r}ч`:`${i}м`}function V(e){let t=Number(e);return!Number.isFinite(t)||t<=0?`Не указан`:`${t}+`}function H(e){if(!Array.isArray(e)||e.length===0)return`Не указаны`;let t=e.map(e=>J(e)).filter(Boolean);return t.length?t.join(`, `):`Не указаны`}function U(e){return Array.isArray(e)?e.map(e=>{if(!e||typeof e!=`object`)return null;let t=J(e.full_name);return t?{id:J(e.id),name:t,imgUrl:q(e.img_url)||`img/user-avatar.png`}:null}).filter(Boolean):[]}function W(e){let t=Number(e);return Number.isFinite(t)&&j[t]?j[t]:Number.isFinite(t)?`ID ${t}`:`Не указана`}function G(e){let t=Number(e);return Number.isFinite(t)&&M[t]?M[t]:Number.isFinite(t)?`ID ${t}`:`Не указан`}function K(e){let t=J(e).toLowerCase();return t?N[t]||t:`Не указан`}function se(e){let t=Number(e);return!Number.isFinite(t)||t<=0?`Не указан`:String(t)}function q(e){let t=J(e);if(!t)return``;if(t.startsWith(`http://`)||t.startsWith(`https://`)||t.startsWith(`data:`)||t.startsWith(`blob:`)||t.startsWith(`img/`))return t;let n=t.startsWith(`/`)?t:`/${t}`,r=window.APP_CONFIG?.BASE_URL||window.location.origin;try{return new URL(n,r).href}catch{return t}}function J(e){return typeof e==`string`?e.trim():typeof e==`number`&&Number.isFinite(e)?String(e):``}(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`SignIn.hbs`]=e({compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){return`<div class="auth-styles sign-in-page">
<div class="container-main">
  <span
    class="bg-dot yellow"
    style="width:180px;height:180px;left:50px;top:60px;"
  ></span>
  <span
    class="bg-dot light"
    style="width:150px;height:150px;left:300px;top:-30px;"
  ></span>
  <span
    class="bg-dot yellow"
    style="width:200px;height:200px;right:260px;top:220px;"
  ></span>
  <span
    class="bg-dot light"
    style="width:160px;height:160px;left:20px;bottom:120px;"
  ></span>
  <span
    class="bg-dot light"
    style="width:210px;height:210px;right:60px;bottom:30px;"
  ></span>
  <span
    class="bg-dot yellow"
    style="width:170px;height:170px;right:20px;top:40px;"
  ></span>
  <span
    class="bg-dot yellow"
    style="width:140px;height:140px;left:160px;bottom:-60px;"
  ></span>
  <span
    class="bg-dot light"
    style="width:190px;height:190px;right:-40px;top:120px;"
  ></span>

  <div class="form-section">
    <a
      class="auth-close-link"
      href="/"
      router-link
      aria-label="Вернуться на главную"
    >
      <span class="auth-close-tooltip">На главную</span>
      <span class="auth-close-icon" aria-hidden="true">
        <span class="auth-close-line"></span>
        <span class="auth-close-line"></span>
      </span>
    </a>

    <div class="form-wrap">
      <div class="logo">
        <img src="img/logo.png" alt="VKino логотип" />Vkino
      </div>

      <form data-auth-form="login" novalidate>
        <div class="form-group">
          <label>Email</label>
          <input type="email" name="email" placeholder="Email" required />
          <div class="error-message" id="email-error"></div>
        </div>

        <div class="form-group">
          <label>Пароль</label>
          <div class="field has-eye">
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Пароль"
              required
            />
            <button
              class="eye-btn"
              type="button"
              aria-label="Показать пароль"
              data-target="password"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M2.5 12C4.4 8.6 7.7 6.2 12 6.2C16.3 6.2 19.6 8.6 21.5 12C19.6 15.4 16.3 17.8 12 17.8C7.7 17.8 4.4 15.4 2.5 12Z"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  stroke="currentColor"
                  stroke-width="1.8"
                />
                <path
                  class="slash"
                  d="M5 19L19 5"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="error-message" id="password-error"></div>
        </div>

        <button type="submit" class="btn">Войти</button>
      </form>

      <div class="footer-text">
        Нет аккаунта?
        <a href="/sign-up" router-link>Зарегистрироваться</a>
      </div>
    </div>

    <div class="popcorn-wrap">
      <div class="scene" id="scene">
        <div class="glow"></div>

        <svg
          class="kernel"
          style="--tx:-70px;--ty:-160px;--rot:200deg;--delay:0s;--dur:0.9s;width:28px;height:28px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="10"
              ry="8"
              fill="#fff9e3"
              transform="rotate(20)"
            /><circle cx="-4" cy="-3" r="7" fill="#fffde7" /><circle
              cx="4"
              cy="-4"
              r="6"
              fill="#fff8e1"
            /><circle cx="0" cy="3" r="6" fill="#fffde7" /><circle
              cx="-3"
              cy="2"
              r="4"
              fill="white"
              opacity="0.5"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:70px;--ty:-140px;--rot:-150deg;--delay:0.1s;--dur:0.85s;width:26px;height:26px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="7"
              fill="#ffe082"
              transform="rotate(-15)"
            /><circle cx="-3" cy="-4" r="7" fill="#fff9c4" /><circle
              cx="4"
              cy="-3"
              r="6"
              fill="#ffe082"
            /><circle cx="1" cy="4" r="5" fill="#fff9c4" /><circle
              cx="-2"
              cy="1"
              r="3"
              fill="white"
              opacity="0.45"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:-30px;--ty:-180px;--rot:280deg;--delay:0.2s;--dur:1s;width:30px;height:30px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="11"
              ry="8"
              fill="#fff8e1"
              transform="rotate(35)"
            /><circle cx="-5" cy="-2" r="7" fill="#fffde7" /><circle
              cx="3"
              cy="-5"
              r="7"
              fill="#ffe082"
            /><circle cx="1" cy="4" r="6" fill="#fff9c4" /><circle
              cx="-3"
              cy="0"
              r="3"
              fill="white"
              opacity="0.5"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:50px;--ty:-170px;--rot:-90deg;--delay:0.05s;--dur:0.75s;width:24px;height:24px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="7"
              fill="#ffe082"
              transform="rotate(10)"
            /><circle cx="-4" cy="-4" r="6" fill="#fff9c4" /><circle
              cx="4"
              cy="-3"
              r="6"
              fill="#ffe082"
            /><circle cx="0" cy="4" r="5" fill="#fffde7" /><circle
              cx="-1"
              cy="-1"
              r="3"
              fill="white"
              opacity="0.4"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:-90px;--ty:-100px;--rot:120deg;--delay:0.3s;--dur:0.95s;width:28px;height:28px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="10"
              ry="8"
              fill="#fff9e3"
              transform="rotate(-30)"
            /><circle cx="-3" cy="-5" r="7" fill="#fff8e1" /><circle
              cx="5"
              cy="-2"
              r="6"
              fill="#ffe082"
            /><circle cx="-1" cy="5" r="6" fill="#fffde7" /><circle
              cx="2"
              cy="-2"
              r="3"
              fill="white"
              opacity="0.5"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:90px;--ty:-110px;--rot:-200deg;--delay:0.15s;--dur:0.88s;width:26px;height:26px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="7"
              fill="#ffe082"
              transform="rotate(50)"
            /><circle cx="-4" cy="-3" r="6" fill="#fff9c4" /><circle
              cx="4"
              cy="-4"
              r="6"
              fill="#fff8e1"
            /><circle cx="1" cy="4" r="5" fill="#ffe082" /><circle
              cx="-2"
              cy="0"
              r="3"
              fill="white"
              opacity="0.45"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:10px;--ty:-200px;--rot:360deg;--delay:0.25s;--dur:1.1s;width:32px;height:32px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="11"
              ry="9"
              fill="#fff9c4"
              transform="rotate(-20)"
            /><circle cx="-5" cy="-3" r="8" fill="#fffde7" /><circle
              cx="4"
              cy="-5"
              r="7"
              fill="#ffe082"
            /><circle cx="0" cy="5" r="7" fill="#fff9c4" /><circle
              cx="-2"
              cy="-1"
              r="4"
              fill="white"
              opacity="0.45"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:-50px;--ty:-130px;--rot:45deg;--delay:0.4s;--dur:0.7s;width:24px;height:24px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="8"
              ry="6"
              fill="#ffe082"
              transform="rotate(60)"
            /><circle cx="-3" cy="-3" r="6" fill="#fff9c4" /><circle
              cx="3"
              cy="-3"
              r="5"
              fill="#fff8e1"
            /><circle cx="0" cy="4" r="5" fill="#ffe082" /><circle
              cx="-1"
              cy="0"
              r="3"
              fill="white"
              opacity="0.4"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:30px;--ty:-150px;--rot:-270deg;--delay:0.35s;--dur:0.92s;width:27px;height:27px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="10"
              ry="7"
              fill="#fff8e1"
              transform="rotate(-45)"
            /><circle cx="-4" cy="-4" r="7" fill="#fffde7" /><circle
              cx="4"
              cy="-3"
              r="6"
              fill="#ffe082"
            /><circle cx="1" cy="5" r="6" fill="#fff9c4" /><circle
              cx="-2"
              cy="1"
              r="3"
              fill="white"
              opacity="0.5"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:-110px;--ty:-80px;--rot:170deg;--delay:0.45s;--dur:0.82s;width:25px;height:25px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="7"
              fill="#ffe082"
              transform="rotate(25)"
            /><circle cx="-4" cy="-3" r="6" fill="#fff9c4" /><circle
              cx="4"
              cy="-4"
              r="6"
              fill="#fff8e1"
            /><circle cx="0" cy="4" r="5" fill="#ffe082" /><circle
              cx="-1"
              cy="-1"
              r="3"
              fill="white"
              opacity="0.45"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:110px;--ty:-90px;--rot:-130deg;--delay:0.08s;--dur:1.05s;width:29px;height:29px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="10"
              ry="8"
              fill="#fff9c4"
              transform="rotate(-10)"
            /><circle cx="-5" cy="-2" r="7" fill="#fffde7" /><circle
              cx="3"
              cy="-5"
              r="6"
              fill="#ffe082"
            /><circle cx="1" cy="5" r="6" fill="#fff9c4" /><circle
              cx="-2"
              cy="0"
              r="3"
              fill="white"
              opacity="0.4"
            /></g></svg>

        <svg
          class="kernel"
          style="--tx:-15px;--ty:-220px;--rot:320deg;--delay:0.5s;--dur:0.78s;width:26px;height:26px"
          viewBox="0 0 40 40"
        ><g transform="translate(20,20)"><ellipse
              cx="0"
              cy="0"
              rx="9"
              ry="7"
              fill="#ffe082"
              transform="rotate(40)"
            /><circle cx="-3" cy="-4" r="6" fill="#fff9c4" /><circle
              cx="4"
              cy="-3"
              r="6"
              fill="#fff8e1"
            /><circle cx="0" cy="4" r="5" fill="#fffde7" /><circle
              cx="-1"
              cy="-1"
              r="3"
              fill="white"
              opacity="0.45"
            /></g></svg>

        <div class="bucket-wrap">
          <svg
            class="bucket-svg"
            viewBox="0 0 160 180"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="bucketGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#c0392b" />
                <stop offset="30%" stop-color="#e74c3c" />
                <stop offset="60%" stop-color="#c0392b" />
                <stop offset="100%" stop-color="#922b21" />
              </linearGradient>
              <linearGradient id="stripGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#f9e04b" />
                <stop offset="50%" stop-color="#fff176" />
                <stop offset="100%" stop-color="#f9e04b" />
              </linearGradient>
              <linearGradient id="rimGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f5cba7" />
                <stop offset="100%" stop-color="#d4ac0d" />
              </linearGradient>
            </defs>

            <polygon
              points="20,40 140,40 125,175 35,175"
              fill="url(#bucketGrad)"
            />

            <clipPath id="bucketClip">
              <polygon points="20,40 140,40 125,175 35,175" />
            </clipPath>
            <g clip-path="url(#bucketClip)">
              <rect
                x="40"
                y="38"
                width="22"
                height="140"
                fill="url(#stripGrad)"
                opacity="0.9"
              />
              <rect
                x="98"
                y="38"
                width="22"
                height="140"
                fill="url(#stripGrad)"
                opacity="0.9"
              />
            </g>

            <rect
              x="15"
              y="33"
              width="130"
              height="14"
              rx="7"
              fill="url(#rimGrad)"
            />
            <rect x="34" y="170" width="92" height="8" rx="4" fill="#7b241c" />

            <ellipse cx="80" cy="38" rx="52" ry="22" fill="#ffe082" />
            <circle cx="50" cy="28" r="18" fill="#fff9c4" />
            <circle cx="75" cy="18" r="20" fill="#ffe082" />
            <circle cx="100" cy="24" r="17" fill="#fff9c4" />
            <circle cx="120" cy="32" r="15" fill="#ffe082" />
            <circle cx="35" cy="35" r="13" fill="#ffcc02" />
            <circle cx="62" cy="10" r="14" fill="#fff8e1" />
            <circle cx="90" cy="8" r="13" fill="#ffe082" />
            <circle cx="110" cy="15" r="12" fill="#fff9c4" />

            <circle cx="55" cy="22" r="5" fill="white" opacity="0.4" />
            <circle cx="82" cy="12" r="4" fill="white" opacity="0.3" />
            <circle cx="105" cy="20" r="4" fill="white" opacity="0.35" />

            <polygon
              points="30,50 50,50 45,140 28,140"
              fill="white"
              opacity="0.07"
            />
          </svg>
        </div>
      </div>

      <p class="hint">Наведи мышку на ведёрко ✨</p>
    </div>
  </div>
</div>
</div>
`},useData:!0})})();function Y(e=[],t=`page`){let n=[];return e.forEach(e=>{let r=e.startsWith(`/`)?e:`/${e}`,i=`link[data-page-style="${t}:${r}"]`,a=document.head.querySelector(i);a||(a=document.createElement(`link`),a.rel=`stylesheet`,a.href=r,a.dataset.pageStyle=`${t}:${r}`,document.head.appendChild(a)),n.push(a)}),()=>{n.forEach(e=>{e.remove()})}}function X(e){if(!e)return()=>{};let t=t=>{let n=t.target.closest(`.eye-btn`);if(!n||!e.contains(n))return;let r=n.dataset.target;if(!r)return;let i=e.querySelector(`#${r}`);if(!i)return;let a=i.type===`password`;i.type=a?`text`:`password`,n.classList.toggle(`is-active`,a)};return e.addEventListener(`click`,t),()=>{e.removeEventListener(`click`,t)}}var Z=(e,t,n)=>{e&&e.classList.toggle(`is-error`,!!n),t&&(t.textContent=n||``)},ce=(e=``)=>{let t=e.trim();return t?t.length>63?`Слишком длинный email`:t.includes(`..`)?`Email не должен содержать несколько точек подряд`:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)?``:`Укажите корректный email`:`Введите email`},le=(e=``)=>{let t=[];return e.length<6&&t.push(`минимум 6 символов`),e.length>255&&t.push(`максимум 255 символов`),/\s/.test(e)&&t.push(`без пробелов`),(/^[a-zA-Z]+$/.test(e)||/^\d+$/.test(e))&&t.push(`нужны буквы и цифры`),t.length?`Пароль: `+t.join(`, `):``},Q=(e,t={})=>{if(!e||e.dataset.validationReady===`true`)return()=>{};e.dataset.validationReady=`true`;let n=e.querySelector(`input[type="email"]`),r=e.querySelector(`#password`),i=e.querySelector(`#password-repeat`),a=e.querySelector(`#email-error`),o=e.querySelector(`#password-error`),s=e.querySelector(`#password-repeat-error`),c=[[n,a],[r,o],[i,s]],l=e=>{if(!e)return``;if(e===n){let e=ce(n.value||``);return Z(n,a,e),e}if(e===r){let e=le(r.value||``);return Z(r,o,e),i&&Z(i,s,r.value===(i.value||``)?``:`Пароли не совпадают`),e}if(e===i){let e=(r?.value||``)===(i.value||``)?``:`Пароли не совпадают`;return Z(i,s,e),e}return``},u=e=>{l(e.target)},d=async a=>{let o=!1;e.noValidate=!0,c.forEach(([e,t])=>{e&&Z(e,t,``)});let s=n?l(n):``,u=r?l(r):``,d=i?l(i):``;if((s||u||d)&&(o=!0),o){a.preventDefault();return}if(typeof t.onSubmit==`function`){a.preventDefault();let n=new FormData(e);await t.onSubmit({email:String(n.get(`email`)||``).trim(),password:String(n.get(`password`)||``)},e)}};return c.forEach(([e])=>{e&&(e.addEventListener(`input`,u),e.addEventListener(`blur`,u))}),e.addEventListener(`submit`,d),()=>{c.forEach(([e])=>{e&&(e.removeEventListener(`input`,u),e.removeEventListener(`blur`,u))}),e.removeEventListener(`submit`,d),delete e.dataset.validationReady}},$=class extends i{constructor(e={},t=null,n=null){if(!n)throw Error(`SignIn: не передан корневой элемент для SignIn`);super(e,Handlebars.templates[`SignIn.hbs`],t,n,`SignInPage`),this._detachStyles=null,this._destroyPasswordToggle=null,this._destroyValidation=null}init(){return this._detachStyles=Y([`/css/main.css`,`/css/auth.css`,`/css/login.css`],`sign-in`),super.init()}addEventListeners(){this._destroyPasswordToggle=X(this.el),this._destroyValidation=Q(this.el.querySelector(`form[data-auth-form="login"]`),{onSubmit:this.handleSubmit.bind(this)})}removeEventListeners(){this._destroyPasswordToggle&&=(this._destroyPasswordToggle(),null),this._destroyValidation&&=(this._destroyValidation(),null)}async handleSubmit(e){let t=await p.signIn(e);if(!t.ok){Z(this.el.querySelector(`#password`),this.el.querySelector(`#password-error`),t.resp?.Error||t.resp?.message||t.error||`Не удалось выполнить вход`);return}typeof this.context.onSuccess==`function`&&this.context.onSuccess(t.resp)}beforeDestroy(){this._detachStyles&&=(this._detachStyles(),null)}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`SignUp.hbs`]=e({compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){return`<div class="auth-styles sign-up-page">
  <canvas id="fx"></canvas>

  <div class="container-main">
    <span
      class="bg-dot yellow"
      style="width:180px;height:180px;left:50px;top:60px;"
    ></span>
    <span
      class="bg-dot light"
      style="width:150px;height:150px;left:300px;top:-30px;"
    ></span>
    <span
      class="bg-dot yellow"
      style="width:200px;height:200px;right:260px;top:220px;"
    ></span>
    <span
      class="bg-dot light"
      style="width:160px;height:160px;left:20px;bottom:120px;"
    ></span>
    <span
      class="bg-dot light"
      style="width:210px;height:210px;right:60px;bottom:30px;"
    ></span>
    <span
      class="bg-dot yellow"
      style="width:170px;height:170px;right:20px;top:40px;"
    ></span>
    <span
      class="bg-dot yellow"
      style="width:140px;height:140px;left:160px;bottom:-60px;"
    ></span>
    <span
      class="bg-dot light"
      style="width:190px;height:190px;right:-40px;top:120px;"
    ></span>

    <div class="form-section">
      <a
        class="auth-close-link"
        href="/"
        router-link
        aria-label="Вернуться на главную"
      >
        <span class="auth-close-tooltip">На главную</span>
        <span class="auth-close-icon" aria-hidden="true">
          <span class="auth-close-line"></span>
          <span class="auth-close-line"></span>
        </span>
      </a>

      <div class="form-wrap">
        <div class="logo">
          <img src="/img/logo.png" alt="VKino логотип" />Vkino
        </div>

        <form data-auth-form="register" novalidate>
          <div class="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              placeholder="Начните вводить"
              required
            />
            <div class="error-message" id="email-error"></div>
          </div>

          <div class="form-group">
            <label>Пароль</label>
            <div class="field has-eye">
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Начните вводить"
                required
              />
              <button
                class="eye-btn"
                type="button"
                aria-label="Показать пароль"
                data-target="password"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12C4.4 8.6 7.7 6.2 12 6.2C16.3 6.2 19.6 8.6 21.5 12C19.6 15.4 16.3 17.8 12 17.8C7.7 17.8 4.4 15.4 2.5 12Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <path
                    class="slash"
                    d="M5 19L19 5"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <div class="error-message" id="password-error"></div>
          </div>

          <div class="form-group">
            <label>Повтор пароля</label>
            <div class="field has-eye">
              <input
                id="password-repeat"
                name="passwordRepeat"
                type="password"
                placeholder="Начните вводить"
                required
              />
              <button
                class="eye-btn"
                type="button"
                aria-label="Показать пароль"
                data-target="password-repeat"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12C4.4 8.6 7.7 6.2 12 6.2C16.3 6.2 19.6 8.6 21.5 12C19.6 15.4 16.3 17.8 12 17.8C7.7 17.8 4.4 15.4 2.5 12Z"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    stroke-width="1.8"
                  />
                  <path
                    class="slash"
                    d="M5 19L19 5"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            </div>
            <div class="error-message" id="password-repeat-error"></div>
          </div>

          <button type="submit" class="btn">Зарегистрироваться</button>
        </form>

        <div class="footer-text">
          Уже есть аккаунт?
          <a href="/sign-in" router-link>Войти</a>
        </div>
      </div>

      <div class="bottle-wrap">
        <div id="scene">
          <div id="puddle"></div>
          <div id="stream"></div>

          <div id="bw">
            <svg
              viewBox="0 0 190 540"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              width="100%"
              height="100%"
              style="filter:drop-shadow(0 28px 55px rgba(0,0,0,.9)) drop-shadow(0 0 30px rgba(160,80,0,.1))"
            >
              <defs>
                <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#080503" />
                  <stop offset="8%" stop-color="#140d08" />
                  <stop offset="22%" stop-color="#20140e" />
                  <stop offset="42%" stop-color="#2a1a12" />
                  <stop offset="58%" stop-color="#251610" />
                  <stop offset="76%" stop-color="#180f08" />
                  <stop offset="92%" stop-color="#0e0905" />
                  <stop offset="100%" stop-color="#070402" />
                </linearGradient>

                <linearGradient id="neckG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#0c0806" />
                  <stop offset="35%" stop-color="#1c1209" />
                  <stop offset="65%" stop-color="#24170c" />
                  <stop offset="100%" stop-color="#0c0806" />
                </linearGradient>

                <linearGradient id="lblG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#5c2200" />
                  <stop offset="10%" stop-color="#a84010" />
                  <stop offset="30%" stop-color="#d45a18" />
                  <stop offset="50%" stop-color="#e8721e" />
                  <stop offset="70%" stop-color="#d45a18" />
                  <stop offset="90%" stop-color="#a84010" />
                  <stop offset="100%" stop-color="#5c2200" />
                </linearGradient>

                <linearGradient id="wvG" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="white" stop-opacity="0" />
                  <stop offset="20%" stop-color="white" stop-opacity=".45" />
                  <stop offset="50%" stop-color="white" stop-opacity=".6" />
                  <stop offset="80%" stop-color="white" stop-opacity=".45" />
                  <stop offset="100%" stop-color="white" stop-opacity="0" />
                </linearGradient>

                <linearGradient id="cpG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#ff8c45" />
                  <stop offset="60%" stop-color="#d4580e" />
                  <stop offset="100%" stop-color="#8d3000" />
                </linearGradient>

                <linearGradient id="lqG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#1e0c06" stop-opacity=".96" />
                  <stop offset="100%" stop-color="#090302" stop-opacity=".99" />
                </linearGradient>

                <linearGradient id="hlL" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="white" stop-opacity=".28" />
                  <stop offset="100%" stop-color="white" stop-opacity="0" />
                </linearGradient>

                <linearGradient id="hlL2" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="white" stop-opacity=".10" />
                  <stop offset="100%" stop-color="white" stop-opacity="0" />
                </linearGradient>

                <path
                  id="bp"
                  d="
                                    M83 28
                                    C83 28 80 30 80 44
                                    L80 95
                                    C75 108 55 122 38 152
                                    L30 168
                                    C28 185 28 200 30 222
                                    C32 242 44 264 46 292
                                    L46 314
                                    C43 340 28 366 26 404
                                    L26 452
                                    C26 472 34 488 95 492
                                    C156 488 164 472 164 452
                                    L164 404
                                    C162 366 147 340 144 314
                                    L144 292
                                    C146 264 158 242 160 222
                                    C162 200 162 185 160 168
                                    L152 152
                                    C135 122 115 108 110 95
                                    L110 44
                                    C110 30 107 28 107 28
                                    Z
                                "
                />

                <clipPath id="bc"><use href="#bp" /></clipPath>
              </defs>

              <use
                href="#bp"
                fill="url(#body)"
                stroke="#1c1208"
                stroke-width="1"
              />

              <g clip-path="url(#bc)">
                <rect
                  x="26"
                  y="168"
                  width="138"
                  height="324"
                  fill="url(#lqG)"
                />
                <circle cx="55" cy="390" r="3.5" fill="rgba(255,255,255,.04)" />
                <circle
                  cx="145"
                  cy="320"
                  r="4.5"
                  fill="rgba(255,255,255,.03)"
                />
                <circle cx="82" cy="462" r="3" fill="rgba(255,255,255,.04)" />
                <circle cx="36" cy="280" r="5" fill="rgba(255,255,255,.025)" />
                <circle cx="118" cy="248" r="2" fill="rgba(255,255,255,.04)" />
              </g>

              <path
                d="
                                M30 168 L160 168 L160 364
                                C130 372 95 374 95 374
                                C95 374 60 372 30 364 Z
                            "
                fill="url(#lblG)"
              />

              <path
                d="
                                M30 168 L160 168 L160 184
                                C130 176 95 173 95 173
                                C95 173 60 176 30 184 Z
                            "
                fill="white"
                fill-opacity=".88"
              />

              <path
                d="
                                M30 348 C60 353 95 355 95 355
                                C95 355 130 353 160 348
                                L160 364
                                C130 372 95 374 95 374
                                C95 374 60 372 30 364 Z
                            "
                fill="white"
                fill-opacity=".88"
              />

              <foreignObject x="20" y="208" width="150" height="62">
                <div
                  xmlns="http://www.w3.org/1999/xhtml"
                  style="
                                    font-family:'Arial Black',Arial,sans-serif;
                                    font-size:52px;font-weight:900;
                                    color:white;text-align:center;
                                    line-height:1;
                                    text-shadow:1px 2px 0 rgba(0,0,0,.4),2px 4px 10px rgba(0,0,0,.5);
                                    letter-spacing:2px;white-space:nowrap;
                                "
                >COLA</div>
              </foreignObject>

              <path
                d="M30 272 Q60 257 95 265 Q130 273 160 258"
                stroke="url(#wvG)"
                stroke-width="12"
                fill="none"
                stroke-linecap="round"
              />
              <path
                d="M30 290 Q60 275 95 283 Q130 291 160 276"
                stroke="url(#wvG)"
                stroke-width="5"
                fill="none"
                stroke-linecap="round"
                opacity=".3"
              />

              <path
                d="M30 168 L30 364 L40 368 L40 164 Z"
                fill="rgba(0,0,0,.18)"
              />
              <path
                d="M160 168 L160 364 L150 368 L150 164 Z"
                fill="rgba(0,0,0,.18)"
              />

              <path
                d="
                                M80 95
                                C75 108 55 122 38 152
                                L30 168 L160 168 L152 152
                                C135 122 115 108 110 95 Z
                            "
                fill="url(#neckG)"
                opacity=".9"
              />

              <rect
                x="80"
                y="28"
                width="30"
                height="68"
                rx="3"
                fill="url(#neckG)"
              />

              <ellipse
                cx="95"
                cy="92"
                rx="16"
                ry="4"
                fill="#0c0c1a"
                stroke="#1e1e2e"
                stroke-width="1.2"
              />

              <path
                d="M82 30 L82 92 L86 90 L86 30 Z"
                fill="url(#hlL)"
                opacity=".5"
              />

              <path
                d="
                                M26 160 L26 450
                                Q31 452 36 450
                                L37 164
                                Q31 162 26 160 Z
                            "
                fill="url(#hlL)"
                opacity=".52"
              />

              <path
                d="
                                M38 156 L38 448
                                L45 448 L45 160 Z
                            "
                fill="url(#hlL2)"
                opacity=".55"
              />

              <path
                d="M26 224 Q95 220 164 224"
                stroke="rgba(255,255,255,.04)"
                stroke-width="3"
                fill="none"
              />
              <path
                d="M26 312 Q95 308 164 312"
                stroke="rgba(255,255,255,.04)"
                stroke-width="3"
                fill="none"
              />
              <path
                d="M26 398 Q95 394 164 398"
                stroke="rgba(0,0,0,.2)"
                stroke-width="2.5"
                fill="none"
              />

              <path
                d="
                                M26 452 Q95 447 164 452
                                Q164 463 95 467
                                Q26 463 26 452 Z
                            "
                fill="rgba(0,0,0,.12)"
              />

              <g id="capG">
                <rect
                  x="79"
                  y="4"
                  width="32"
                  height="26"
                  rx="5"
                  fill="url(#cpG)"
                />
                <ellipse cx="95" cy="4" rx="16" ry="5.5" fill="#ee6820" />
                <ellipse
                  cx="91"
                  cy="2.5"
                  rx="9"
                  ry="2.8"
                  fill="white"
                  fill-opacity=".32"
                />
                <line
                  x1="82"
                  y1="5"
                  x2="82"
                  y2="29"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="85.5"
                  y1="4.5"
                  x2="85.5"
                  y2="30"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="89"
                  y1="4"
                  x2="89"
                  y2="30"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="95"
                  y1="4"
                  x2="95"
                  y2="30"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="101"
                  y1="4"
                  x2="101"
                  y2="30"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="104.5"
                  y1="4.5"
                  x2="104.5"
                  y2="30"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <line
                  x1="108"
                  y1="5"
                  x2="108"
                  y2="29"
                  stroke="#7a2a00"
                  stroke-width="1"
                  opacity=".65"
                />
                <ellipse
                  cx="95"
                  cy="29"
                  rx="16"
                  ry="3"
                  fill="#aa4400"
                  fill-opacity=".8"
                />
                <ellipse
                  cx="95"
                  cy="29"
                  rx="16"
                  ry="3"
                  fill="none"
                  stroke="#663300"
                  stroke-width=".8"
                />
              </g>
            </svg>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`},useData:!0})})();var ue=e=>{if(!e)return()=>{};let t=!1,n=e.querySelector(`#scene`),r=e.querySelector(`#bw`),i=e.querySelector(`#stream`),a=e.querySelector(`#puddle`),o=e.querySelector(`#capG`),s=e.querySelector(`#fx`);if(!n||!r||!i||!a||!o||!s)return()=>{};let c=s.getContext(`2d`);if(!c)return()=>{};let l=[],u=null,d=null,f=(e,t)=>e+Math.random()*(t-e),p=()=>{s.width=window.innerWidth,s.height=window.innerHeight},m=()=>{let e=30*Math.PI/180,t=n.offsetHeight,i=r.getBoundingClientRect(),a=i.left+i.width*.5,o=i.top+i.height*.5;return{x:a+t*.455*Math.sin(e),y:o-t*.455*Math.cos(e)}},h=e=>{let t=(Math.random()<.68?f(-128,8):f(-145,25))*Math.PI/180,n=f(170,460),r=f(2.5,9.5),i=f(0,1);l.push({t:`d`,x:e.x+f(-6,6),y:e.y+f(-3,3),vx:Math.cos(t)*n,vy:Math.sin(t)*n,ay:f(270,370),drag:.87,r,cr:60+i*75|0,cg:2+i*10|0,cb:2+i*8|0,op:f(.78,1),life:1,decay:f(.5,.88),stretch:f(1,2.1)})},g=e=>{let t=f(-132,12)*Math.PI/180,n=f(80,300);l.push({t:`b`,x:e.x+f(-5,5),y:e.y+f(-3,3),vx:Math.cos(t)*n,vy:Math.sin(t)*n,ay:f(90,190),drag:.91,r:f(2,8.5),op:f(.55,.95),life:1,decay:f(.33,.65)})},_=(e,t)=>{c.save(),c.globalAlpha=t;let n=Math.sqrt(e.vx*e.vx+e.vy*e.vy),r=Math.atan2(e.vy,e.vx),i=1+Math.min(n/270,1.6)*(e.stretch-1);c.translate(e.x,e.y),c.rotate(r+Math.PI/2);let a=e.r,o=e.r*i,s=c.createRadialGradient(-a*.28,-o*.26,0,0,0,Math.max(a,o)*1.1),l=Math.min(255,e.cr+130),u=Math.min(255,e.cg+55),d=Math.min(255,e.cb+25);s.addColorStop(0,`rgba(${l},${u},${d},.92)`),s.addColorStop(.38,`rgba(${e.cr},${e.cg},${e.cb},.95)`),s.addColorStop(.82,`rgba(${e.cr*.55|0},${e.cg*.45|0},0,.65)`),s.addColorStop(1,`rgba(${e.cr*.3|0},0,0,.15)`),c.beginPath(),c.ellipse(0,0,a,o,0,0,Math.PI*2),c.fillStyle=s,c.fill(),c.beginPath(),c.ellipse(-a*.22,-o*.28,a*.33,o*.18,0,0,Math.PI*2),c.fillStyle=`rgba(255,255,255,.52)`,c.fill(),c.beginPath(),c.arc(-a*.08,-o*.1,a*.11,0,Math.PI*2),c.fillStyle=`rgba(255,255,255,.28)`,c.fill(),c.restore()},v=(e,t)=>{c.save(),c.globalAlpha=t,c.translate(e.x,e.y);let n=e.r,r=c.createRadialGradient(0,0,n*.5,0,0,n);r.addColorStop(0,`rgba(140,185,255,0)`),r.addColorStop(.7,`rgba(170,210,255,.08)`),r.addColorStop(.87,`rgba(205,232,255,.48)`),r.addColorStop(1,`rgba(255,255,255,.82)`),c.beginPath(),c.arc(0,0,n,0,Math.PI*2),c.fillStyle=r,c.fill(),c.beginPath(),c.arc(0,0,n*.78,0,Math.PI*2),c.fillStyle=`rgba(55,4,2,.1)`,c.fill(),c.beginPath(),c.ellipse(-n*.26,-n*.3,n*.42,n*.23,-.42,0,Math.PI*2),c.fillStyle=`rgba(255,255,255,.82)`,c.fill(),c.beginPath(),c.ellipse(n*.18,n*.36,n*.18,n*.1,.38,0,Math.PI*2),c.fillStyle=`rgba(255,255,255,.28)`,c.fill(),c.beginPath(),c.arc(0,0,n,0,Math.PI*2),c.strokeStyle=`rgba(155,115,255,.2)`,c.lineWidth=n*.22,c.stroke(),c.restore()},y=e=>{d||=e;let t=Math.min((e-d)/1e3,.05);d=e,c.clearRect(0,0,s.width,s.height),l=l.filter(e=>e.life>.012);for(let e of l){e.vx*=e.drag**(t*60),e.vy+=e.ay*t,e.x+=e.vx*t,e.y+=e.vy*t,e.life-=e.decay*t;let n=Math.max(0,e.life)*e.op;e.t===`d`?_(e,n):v(e,n)}u=l.length?requestAnimationFrame(y):null,l.length||(d=null)},b=()=>{let e=m();for(let t=0;t<70;t++)setTimeout(()=>h(e),t*16);for(let t=0;t<40;t++)setTimeout(()=>g(e),t*20+25);for(let t=0;t<22;t++)setTimeout(()=>h(e),300+t*28);u||=requestAnimationFrame(y)},x=()=>{t||(t=!0,n.classList.add(`exploded`),r.classList.add(`shake`),setTimeout(()=>{o.style.display=`none`,i.classList.add(`gush`),a.classList.add(`spread`),b()},430))};return p(),window.addEventListener(`resize`,p),n.addEventListener(`click`,x),()=>{window.removeEventListener(`resize`,p),n.removeEventListener(`click`,x),u&&=(cancelAnimationFrame(u),null),l=[],c.clearRect(0,0,s.width,s.height)}},de=class extends i{constructor(e={},t=null,n=null){if(!n)throw Error(`SignUp: не передан корневой элемент для SignUp`);super(e,Handlebars.templates[`SignUp.hbs`],t,n,`SignUpPage`),this._detachStyles=null,this._destroyPasswordToggle=null,this._destroyValidation=null,this._destroyBottleEffect=null}init(){return this._detachStyles=Y([`/css/main.css`,`/css/auth.css`,`/css/register.css`],`sign-up`),super.init()}addEventListeners(){this._destroyPasswordToggle=X(this.el),this._destroyValidation=Q(this.el.querySelector(`form[data-auth-form="register"]`),{onSubmit:this.handleSubmit.bind(this)}),this._destroyBottleEffect=ue(this.el)}removeEventListeners(){this._destroyPasswordToggle&&=(this._destroyPasswordToggle(),null),this._destroyValidation&&=(this._destroyValidation(),null),this._destroyBottleEffect&&=(this._destroyBottleEffect(),null)}async handleSubmit(e){let t=await p.signUp(e),n={"user already exists":`такой пользователь уже существует`,"invalid credentials":`Некорректные данные для учётной записи`,"internal server error":`Ошибка сервера`};if(!t.ok){Z(this.el.querySelector(`input[type="email"]`),this.el.querySelector(`#password`),this.el.querySelector(`#password-error`),n[t.resp?.Error]||t.resp?.message||t.error||`Не удалось зарегистрироваться`);return}typeof this.context.onSuccess==`function`&&this.context.onSuccess(t.resp)}beforeDestroy(){this._detachStyles&&=(this._detachStyles(),null)}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Actor.hbs`]=e({0:function(e,t,n,r,i){var a,o=e.lambda,s=e.escapeExpression,c=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`    <section class="actor-card">
      <div class="actor-card__photo">
          <img
          src="`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`picture_src`),t))+`"
          alt="`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`full_name`),t))+`"
        />
      </div>

      <div class="actor-card__content">
        <h1 class="actor-card__title">`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`full_name`),t))+`</h1>
        <p class="actor-card__subtitle">Об актере</p>

        <dl class="actor-card__details">
          <div class="actor-card__detail">
            <dt>ID</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`id`),t))+`</dd>
          </div>

          <div class="actor-card__detail">
            <dt>Страна</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`country_label`),t))+`</dd>
          </div>

          <div class="actor-card__detail actor-card__detail--wide">
            <dt>Дата рождения</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`birth_date`),t))+`</dd>
          </div>

          <div class="actor-card__detail actor-card__detail--wide">
            <dt>Биография</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`biography`),t))+`</dd>
          </div>

          <div class="actor-card__detail">
            <dt>Создан</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`created_at`),t))+`</dd>
          </div>

          <div class="actor-card__detail">
            <dt>Обновлен</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`updated_at`),t))+`</dd>
          </div>

          <div class="actor-card__detail">
            <dt>Всего фильмов</dt>
            <dd>`+s(o((a=t==null?t:c(t,`actor`))==null?a:c(a,`movies_count`),t))+`</dd>
          </div>
        </dl>
      </div>
    </section>

    <section class="actor-movies">
      <div id="actor-movies-carousel"></div>
    </section>
`},1:function(e,t,n,r,i){return`    <section class="actor-card">
      <h1 class="actor-card__title">Актер не найден</h1>
    </section>
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<header id="header"></header>

<main class="actor-page">
`+(a(n,`if`).call(t??(e.nullContext||{}),t==null?t:a(t,`actor`),{name:`if`,hash:{},fn:e.program(0,i,0),inverse:e.program(1,i,0),data:i,loc:{start:{line:4,column:2},end:{line:63,column:9}}})??``)+`</main>
`},useData:!0})})();var fe=class extends i{constructor(e={},t=null,n=null){if(!n)throw Error(`Actor: не передан корневой элемент для ActorPage`);super(e,Handlebars.templates[`Actor.hbs`],t,n,`ActorPage`),this._contextLoaded=!1}init(){return super.init(),this._contextLoaded||this.loadContext(),this}async loadContext(){let e=this.context.actorId??this._getActorIdFromLocation();if(!e){this._contextLoaded=!0,this.refresh({...this.context,actor:this._mapActor(this._createActorStub())});return}let{ok:t,resp:n}=await l.getActorById(e),r=t?n:this._createActorStub(e),i={...this.context,actor:this._mapActor(r)};t||console.log(`Актер не прилетел с бэка, используется заглушка`),this._contextLoaded=!0,this.refresh(i)}addEventListeners(){super.addEventListeners()}removeEventListeners(){super.removeEventListeners()}_getActorIdFromLocation(){let e=new URLSearchParams(window.location.search).get(`id`);if(e)return e;let t=window.location.pathname.split(`/`).filter(Boolean),n=t.indexOf(`actor`);return(n>=0?t[n+1]:null)||null}_mapActor(e){if(!e)return null;let t=e.movie_ids??e.MovieIDs,n=e.birth_date??e.BirthDate,r=e.biography??e.Biography,i=e.created_at??e.CreatedAt,a=e.updated_at??e.UpdatedAt,o=Array.isArray(t)?t:[];return{id:e.id??e.ID??null,full_name:e.full_name??e.FullName??`Имя актера не указано`,country_id:e.country_id??e.CountryID??null,country_label:this._formatCountry(e.country_id??e.CountryID),picture_file_key:e.picture_file_key??e.PictureFileKey??``,picture_src:e.picture_file_key||e.PictureFileKey||`img/user-avatar.png`,birth_date:n?this._formatDate(n):`Не указана`,biography:r||`Нет описания`,created_at:i?this._formatDate(i):`Не указано`,updated_at:a?this._formatDate(a):`Не указано`,movie_ids:o,movies_count:o.length,movies:this._buildMovieCards(o)}}_createActorStub(e=null){return{id:Number(e)||0,full_name:`Кристиан Бейл`,birth_date:`1974-01-30T00:00:00Z`,biography:`Актер с широким диапазоном ролей: от психологических драм до масштабных приключенческих фильмов.`,country_id:826,picture_file_key:``,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),movie_ids:[101,205,309,412,518,624]}}_formatDate(e){let t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleDateString(`ru-RU`)}_formatCountry(e){return e==null||e===``?`Не указана`:`Country #${e}`}_buildMovieCards(e){let t=[`img/1.jpg`,`img/2.jpeg`,`img/3.jpg`,`img/4.jpg`,`img/5.jpg`,`img/image_10.jpg`,`img/image_11.jpg`,`img/image_12.jpg`];return e.map((e,n)=>({id:e,title:`Фильм ${e}`,posterUrl:t[n%t.length],poster_src:t[n%t.length],description:`Фильм из фильмографии актера.`,genres:[],actionText:`О фильме`,href:`/movie?id=${e}`}))}setupChildren(){let e=this.el.querySelector(`#header`);if(!e)throw Error(`Actor: не найден header в шаблоне Actor.hbs`);this.addChild(`header`,new m({...this.context.userData},this,e)),this._setupActorMoviesCarousel()}_setupActorMoviesCarousel(){let e=this.el.querySelector(`#actor-movies-carousel`),t=Array.isArray(this.context.actor?.movies)?this.context.actor.movies:[];!e||!t.length||this.addChild(`actor-movies-carousel`,new D({slug:`actor-movies`,title:`Фильмы с этим актером`,movies:t,posterVariant:`default`,posterSize:`small`,showArrows:!1},this,e))}};async function pe(){await p.init(),n.registerRoute(`/`,e=>new ne({},null,e)).registerRoute(`/sign-in`,e=>new $({onSuccess:()=>n.go(`/`)},null,e)).registerRoute(`/sign-up`,e=>new de({onSuccess:()=>n.go(`/`)},null,e)).registerRoute(`/movie/:id`,e=>new P({},null,e)).registerRoute(`/actor/:id`,e=>new fe({},null,e)),n.init()}pe();
var e=class{constructor(e){if(!e)throw Error(`Router: не передан корневой DOM-элемент`);this.root=e,this.routeTable=new Map,this.activePage=null,this._syncRoute=this._syncRoute.bind(this),this._processLinkClick=this._processLinkClick.bind(this),document.addEventListener(`click`,this._processLinkClick),window.addEventListener(`popstate`,this._syncRoute)}registerRoute(e,t){if(!e)throw Error(`Router: не указан path`);if(typeof t!=`function`)throw Error(`Router: pageBuilder для пути "${e}" должен быть функцией`);return this.routeTable.set(this._formatPath(e),t),this}go(e){let t=this._formatPath(e);window.location.pathname!==t&&(window.history.pushState({},``,t),this._syncRoute())}init(){console.log(`Router initialized`),this._syncRoute()}destroy(){document.removeEventListener(`click`,this._processLinkClick),window.removeEventListener(`popstate`,this._syncRoute),this.activePage?.destroy&&this.activePage.destroy(),this.activePage=null}_processLinkClick(e){let t=e.target.closest(`[router-link]`);if(!t||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;let n=t.getAttribute(`href`);console.log(`Router href =`,n),n&&(e.preventDefault(),this.go(n))}_syncRoute(){let e=this._formatPath(window.location.pathname);console.log(`route path =`,e);let t=this.routeTable.get(e)||this.routeTable.get(`/404`);if(console.log(`pageBuilder =`,t),!t)throw Error(`Router: маршрут "${e}" не найден и маршрут "/404" не зарегистрирован`);this.activePage?.destroy&&this.activePage.destroy(),this.root.innerHTML=``;let n=t(this.root);if(!n||typeof n.init!=`function`)throw Error(`Router: builder для пути "${e}" должен возвращать страницу с методом init()`);this.activePage=n,n.init()}_formatPath(e){return!e||e===`/`?`/`:e.endsWith(`/`)?e.slice(0,-1):e}},t=class{constructor(e={},t,n=null,r=null){if(!t)throw Error(`Не задан шаблон компонента`);if(!r)throw Error(`Не передан корневой DOM-элемент компонента`);this._id=crypto.randomUUID?.()??String(Date.now()),this.el=r,this.template=t,this.context=e,this.parent=n,this.children=new Map}render(){let e=this.template({...this.context});return this.el.innerHTML=e,this}addEventListeners(){}removeEventListeners(){}beforeDestroy(){}init(){return this.render(),this.setupChildren(),this.initChildren(),this.addEventListeners(),this}destroy(){this.removeEventListeners(),this.destroyChildren(),this.beforeDestroy(),this.el&&(this.el.innerHTML=``),this.el=null,this.context=null,this.template=null,this.parent=null}refresh(e){return this.removeEventListeners(),this.destroyChildren(),this.context={...e},this.init(),this}setupChildren(){}initChildren(){for(let[,e]of this.children)e.init()}refreshChildren(e={}){for(let[,t]of this.children)t.refresh(e)}destroyChildren(){for(let[,e]of this.children)e.destroy();this.children.clear()}addChild(e,t){if(!e)throw Error(`Не указано имя дочернего компонента`);if(!t)throw Error(`Не передан дочерний компонент "${e}"`);return this.children.has(e)&&this.children.get(e).destroy(),this.children.set(e,t),t}getChild(e){return this.children.get(e)??null}removeChild(e){let t=this.children.get(e);t&&(t.destroy(),this.children.delete(e))}},n=class extends t{constructor(e={},t,n=null,r=null,i=null){super(e,t,n,r),this.title=i}onShow(){}onHide(){}onRefresh(){}show(){return this.onShow(),this}hide(){return this.onHide(),this}refresh(e={}){return super.refresh(e),this.onRefresh(),this}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Main.hbs`]=e({0:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`      <div class="selection-section">
        <h2 class="selection-title">
          <div class="selection-rectangle"></div>
          <span></span><span>`+e.escapeExpression(e.lambda(t==null?t:a(t,`title`),t))+`&nbsp;<span
              class="selection-triangle"
            >▸</span></span>
        </h2>
        <div class="scroll-container">
          <div class="scroll-items">
`+(a(n,`each`).call(t??(e.nullContext||{}),t==null?t:a(t,`movies`),{name:`each`,hash:{},fn:e.program(1,i,0),inverse:e.noop,data:i,loc:{start:{line:92,column:12},end:{line:100,column:21}}})??``)+`          </div>
        </div>
      </div>
`},1:function(e,t,n,r,i){var a=e.lambda,o=e.escapeExpression,s=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`              <img
                class="movie-poster"
                data-movie-poster-id="`+o(a(t==null?t:s(t,`id`),t))+`"
                src="`+o(a(t==null?t:s(t,`img_url`),t))+`"
                draggable="false"
                alt="`+o(a(t==null?t:s(t,`title`),t))+`"
              />
`},compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){var a=e.lookupProperty||function(e,t){if(Object.prototype.hasOwnProperty.call(e,t))return e[t]};return`<header id="header"></header>

<div class="main">
  <div class="main-content" id="main-content">
    <div class="carousel-section">
      <button
        class="carousel-icon-button left"
        type="button"
        aria-label="Предыдущий слайд"
      >
        <svg
          width="40"
          height="54"
          viewBox="0 0 40 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="40"
            height="54"
            rx="7"
            transform="matrix(-1 0 0 1 40 0)"
            fill="#F5E8D0"
            fill-opacity="0.24"
          />
          <path
            d="M29.0807 44L33 40.9825L14.8386 27L33 13.0175L29.0807 10L7 27L29.0807 44Z"
            fill="#FF571F"
            fill-opacity="0.61"
          />
        </svg>
      </button>

      <div class="carousel-container">
        <div class="carousel-item">
          <img
            class="carousel-image back"
            src="img/image_10.jpg"
            alt="Промо 1"
          />
        </div>
        <div class="carousel-item">
          <img class="carousel-image" src="img/image_11.jpg" alt="Промо 2" />
        </div>
        <div class="carousel-item">
          <img
            class="carousel-image back"
            src="img/image_12.jpg"
            alt="Промо 3"
          />
        </div>
      </div>

      <button
        class="carousel-icon-button right"
        type="button"
        aria-label="Следующий слайд"
      >
        <svg
          width="40"
          height="54"
          viewBox="0 0 40 54"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            width="40"
            height="54"
            rx="7"
            fill="#F5E8D0"
            fill-opacity="0.25"
          />
          <path
            d="M10.9193 44L7 40.9825L25.1614 27L7 13.0175L10.9193 10L33 27L10.9193 44Z"
            fill="#FF571F"
            fill-opacity="0.61"
          />
        </svg>
      </button>
    </div>

`+(a(n,`each`).call(t??(e.nullContext||{}),t==null?t:a(t,`selections`),{name:`each`,hash:{},fn:e.program(0,i,0),inverse:e.noop,data:i,loc:{start:{line:82,column:4},end:{line:104,column:13}}})??``)+`  </div>
</div>
`},useData:!0})})();var r=class e{constructor(e,t=``,n=`vkino_access_token`){this.baseUrl=e.replace(/\/+$/,``),this.namespace=t,this.accessTokenKey=n}withNamespace(t){return new e(this.baseUrl,t,this.accessTokenKey)}getAccessToken(){return localStorage.getItem(this.accessTokenKey)}setAccessToken(e){if(!e){this.clearAccessToken();return}localStorage.setItem(this.accessTokenKey,e)}clearAccessToken(){localStorage.removeItem(this.accessTokenKey)}buildUrl(e=``){let t=this.namespace?`/${String(this.namespace).replace(/^\/+|\/+$/g,``)}`:``,n=e?`/${String(e).replace(/^\/+/,``)}`:``;return`${this.baseUrl}${t}${n}`}async request(e,{method:t=`GET`,data:n=null,headers:r={}}={}){let a=this.buildUrl(e),o=this.getAccessToken(),s={method:t,credentials:`include`,headers:{Accept:`application/json`,...r}};n!==null&&(s.headers[`Content-Type`]=`application/json`,s.body=JSON.stringify(n)),o&&(s.headers.Authorization=`Bearer ${o}`);let c;try{c=await fetch(a,s)}catch(e){return{ok:!1,status:0,resp:null,error:e.message||`Network error`}}let l=await c.text(),u=null;if(l)try{u=JSON.parse(l)}catch{u={raw:l}}return{ok:c.ok,status:c.status,resp:u,error:i(u)}}get(e){return this.request(e,{method:`GET`})}post(e,t=null){return this.request(e,{method:`POST`,data:t})}put(e,t=null){return this.request(e,{method:`PUT`,data:t})}delete(e){return this.request(e,{method:`DELETE`})}};function i(e){return!e||typeof e!=`object`?``:e.Error||e.error||e.message||``}var a=new r(`http://localhost:8080`),o=new class{constructor(e){this.api=e.withNamespace(`movie`)}async getAllSelections(){return this.api.get(`/selection/all`)}async getSelectionByTitle(e){return this.api.get(`/selection/${e}`)}}(a);(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Header.hbs`]=e({0:function(e,t,n,r,i){return`      <form class="vk-header__search-form" data-menu="search">
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
`},useData:!0})})();function s(e){let t=structuredClone(e),n=new Set;return{getState(){return t},setState(e){t={...t,...e},[...n].forEach(e=>e(t))},subscribe(e){return n.add(e),()=>{n.delete(e)}},reset(e){t=structuredClone(e),[...n].forEach(e=>e(t))}}}var c=new class{constructor(e){this.apiRoot=e,this.api=e.withNamespace(`/auth`)}_saveAccessToken(e){let t=e?.resp?.access_token;e?.ok&&t&&this.apiRoot.setAccessToken(t)}_clearSessionLocal(){this.apiRoot.clearAccessToken()}getAccessToken(){return this.apiRoot.getAccessToken()}clearAccessToken(){this._clearSessionLocal()}async signIn(e){let t=await this.api.post(`/sign-in`,e);return this._saveAccessToken(t),t}async signUp(e){let t=await this.api.post(`/sign-up`,e);return this._saveAccessToken(t),t}async refresh(){let e=await this.api.post(`/refresh`);return this._saveAccessToken(e),e.ok||this._clearSessionLocal(),e}async me(){return this.api.get(`/me`)}async logout(){let e=await this.api.post(`/logout`);return this._clearSessionLocal(),e}}(a),l={status:`idle`,user:null,error:null},u=new class{constructor(){this.store=s(l)}getState(){return this.store.getState()}subscribe(e){return this.store.subscribe(e)}_setState(e){this.store.setState(e)}_setGuest(e=null){this._setState({status:`guest`,user:null,error:e})}_setAuthenticated(e){this._setState({status:`authenticated`,user:e,error:null})}async init(){if(this._setState({status:`loading`,error:null}),!c.getAccessToken()){this._setGuest();return}let e=await c.me();if(e.ok){this._setAuthenticated(e.resp);return}if(e.status===401&&(await c.refresh()).ok&&(e=await c.me(),e.ok)){this._setAuthenticated(e.resp);return}c.clearAccessToken(),this._setGuest(`Не удалось восстановить сессию`)}async signIn(e){this._setState({status:`loading`,error:null});let t=await c.signIn(e);if(!t.ok)return this._setGuest(t.resp?.Error||`Не удалось выполнить вход`),t;let n=await c.me();return n.ok?(this._setAuthenticated(n.resp),t):(this._setGuest(`Вход выполнен, но не удалось получить данные пользователя`),{ok:!1,status:n.status,resp:{Error:`Не удалось получить данные пользователя`}})}async signUp(e){this._setState({status:`loading`,error:null});let t=await c.signUp(e);if(!t.ok)return this._setGuest(t.resp?.Error||`Не удалось выполнить регистрацию`),t;let n=await c.me();return n.ok?(this._setAuthenticated(n.resp),t):(this._setGuest(`Регистрация выполнена, но не удалось получить данные пользователя`),{ok:!1,status:n.status,resp:{Error:`Не удалось получить данные пользователя`}})}async logout(){await c.logout(),this._setGuest()}},d=class extends t{constructor(e={},t=null,n=null){if(!t)throw Error(`Header: не передан parent для HeaderComponent`);if(!n)throw Error(`Header: не передан el для HeaderComponent`);super(e,Handlebars.templates[`Header.hbs`],t,n),this._unsubscribe=null,this._onDocumentClickBound=this._onDocumentClick.bind(this)}init(){return this.context=this._buildContext(u.getState(),this.context),super.init()}addEventListeners(){this._subscribeToAuth(),this._bindToggleButton(`[data-action="toggle-burger-menu"]`,this._onBurgerToggleClick),this._bindToggleButton(`[data-action="toggle-profile-menu"]`,this._onProfileToggleClick),this._bindToggleButton(`[data-action="toggle-search"]`,this._onSearchToggleClick),this._bindToggleButton(`[data-action="logout"]`,this._onLogoutClick),this._bindNodeList(`[data-action="close-all-menus"]`,this._onCloseAllMenusClick),this._bindSubmitForm(`[data-menu="search"]`,this._onSearchSubmit),document.addEventListener(`click`,this._onDocumentClickBound)}removeEventListeners(){this._unsubscribe&&=(this._unsubscribe(),null),this._unbindToggleButton(`[data-action="toggle-burger-menu"]`,this._onBurgerToggleClick),this._unbindToggleButton(`[data-action="toggle-profile-menu"]`,this._onProfileToggleClick),this._unbindToggleButton(`[data-action="toggle-search"]`,this._onSearchToggleClick),this._unbindToggleButton(`[data-action="logout"]`,this._onLogoutClick),this._unbindNodeList(`[data-action="close-all-menus"]`,this._onCloseAllMenusClick),this._unbindSubmitForm(`[data-menu="search"]`,this._onSearchSubmit),document.removeEventListener(`click`,this._onDocumentClickBound)}_onBurgerToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleBurgerMenu()};_onProfileToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleProfileMenu()};_onSearchToggleClick=e=>{e.preventDefault(),e.stopPropagation(),this.toggleSearch()};_onCloseAllMenusClick=()=>{this.closeAllMenus()};_onSearchSubmit=e=>{e.preventDefault()};_onLogoutClick=async e=>{e.preventDefault(),e.stopPropagation(),this.closeAllMenus();let t=await u.logout();console.log(t)};_onDocumentClick(e){this.context.isAnyMenuOpen&&(this._isClickInsideMenu(e.target)||this.closeAllMenus())}toggleBurgerMenu(){this._applyMenuState({isBurgerMenuOpen:!this.context.isBurgerMenuOpen,isProfileMenuOpen:!1,isSearchOpen:!1})}closeBurgerMenu(){this.context.isBurgerMenuOpen&&this._applyMenuState({isBurgerMenuOpen:!1})}toggleProfileMenu(){this.context.isAuthorized&&this._applyMenuState({isBurgerMenuOpen:!1,isProfileMenuOpen:!this.context.isProfileMenuOpen,isSearchOpen:!1})}toggleSearch(){this._applyMenuState({isBurgerMenuOpen:!1,isProfileMenuOpen:!1,isSearchOpen:!this.context.isSearchOpen})}_subscribeToAuth(){this._unsubscribe=u.subscribe(e=>{this.refresh(this._buildContext(e,this.context))})}_buildContext(e,t={}){let n=e.status===`authenticated`,r={...t,isAuthorized:n,userName:f(e.user?.email),isBurgerMenuOpen:t.isBurgerMenuOpen??!1,isSearchOpen:t.isSearchOpen??!1,isProfileMenuOpen:n?t.isProfileMenuOpen??!1:!1};return{...r,isAnyMenuOpen:r.isBurgerMenuOpen||r.isProfileMenuOpen}}_applyMenuState(e){let t={...this.context,...e};t.isAnyMenuOpen=t.isBurgerMenuOpen||t.isProfileMenuOpen,this.refresh(t)}_isClickInsideMenu(e){let t=this.el.querySelector(`[data-action="toggle-burger-menu"]`),n=this.el.querySelector(`[data-action="toggle-profile-menu"]`),r=this.el.querySelector(`[data-action="toggle-search"]`),i=this.el.querySelector(`[data-menu="burger"]`),a=this.el.querySelector(`[data-menu="profile"]`),o=this.el.querySelector(`[data-menu="search"]`);return t?.contains(e)||n?.contains(e)||r?.contains(e)||i?.contains(e)||a?.contains(e)||o?.contains(e)}_bindToggleButton(e,t){let n=this.el.querySelector(e);n&&n.addEventListener(`click`,t)}_unbindToggleButton(e,t){let n=this.el.querySelector(e);n&&n.removeEventListener(`click`,t)}_bindNodeList(e,t){this.el.querySelectorAll(e).forEach(e=>{e.addEventListener(`click`,t)})}_unbindNodeList(e,t){this.el.querySelectorAll(e).forEach(e=>{e.removeEventListener(`click`,t)})}_bindSubmitForm(e,t){let n=this.el.querySelector(e);n&&n.addEventListener(`submit`,t)}_unbindSubmitForm(e,t){let n=this.el.querySelector(e);n&&n.removeEventListener(`submit`,t)}};function f(e=``){let t=String(e).trim();if(!t)return``;let n=t.indexOf(`@`);return n===-1?t:t.slice(0,n)}var p=class extends n{constructor(e={},t=null,n=null){if(!n)throw Error(`Main: не передан корневой элемент для MainPage`);super(e,Handlebars.templates[`Main.hbs`],t,n,`MainPage`),this._contextLoaded=!1,this._scrollContainerHandlers=new Map,this._posterClickHandlers=new Map}init(){return super.init(),this._contextLoaded||this.loadContext(),this}async loadContext(){let{ok:e,resp:t}=await o.getAllSelections(),n={...this.context,selections:e?t:[]};e||console.log(`Фильмы не прилетели с бэка`),this._contextLoaded=!0,this.refresh(n)}addEventListeners(){super.addEventListeners(),this._addScrollContainerListeners(),this._addMoviePostersClickListeners()}removeEventListeners(){super.removeEventListeners(),this._removeScrollContainerListeners(),this._removeMoviePostersClickListeners()}_addScrollContainerListeners(){this.el.querySelectorAll(`.scroll-container`).forEach(e=>{let t=!1,n=0,r=0,i=i=>{i.preventDefault(),t=!0,n=i.pageX,r=e.scrollLeft,e.classList.add(`is-dragging`)},a=i=>{if(!t)return;let a=i.pageX-n;e.scrollLeft=r-a},o=()=>{t&&(t=!1,e.classList.remove(`is-dragging`))},s=()=>{t&&(t=!1,e.classList.remove(`is-dragging`))};e.addEventListener(`mousedown`,i),document.addEventListener(`mousemove`,a),document.addEventListener(`mouseup`,o),document.addEventListener(`mouseleave`,s),this._scrollContainerHandlers.set(e,{onMouseDown:i,onMouseMove:a,onMouseUp:o,onMouseLeave:s})})}_removeScrollContainerListeners(){for(let[e,t]of this._scrollContainerHandlers)e.removeEventListener(`mousedown`,t.onMouseDown),document.removeEventListener(`mousemove`,t.onMouseMove),document.removeEventListener(`mouseup`,t.onMouseUp),document.removeEventListener(`mouseleave`,t.onMouseLeave);this._scrollContainerHandlers.clear()}_addMoviePostersClickListeners(){this.el.querySelectorAll(`.movie-poster`).forEach(e=>{let t=()=>{let t=e.dataset.moviePosterId;console.log(`Нажали на постер фильма:`,t)};e.addEventListener(`click`,t),this._posterClickHandlers.set(e,t)})}_removeMoviePostersClickListeners(){for(let[e,t]of this._posterClickHandlers)e.removeEventListener(`click`,t);this._posterClickHandlers.clear()}setupChildren(){let e=this.el.querySelector(`#header`);if(!e)throw Error(`Main: не найден header в шаблоне Main.hbs`);this.addChild(`header`,new d({...this.context.userData},this,e))}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`Movie.hbs`]=e({compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){return`<p>Проверка авторизации</p>`},useData:!0})})();var m=class extends n{constructor(e={},t=null,n=null){if(!n)throw Error(`Movie: не передан корневой элемент для Movie`);super(e,Handlebars.templates[`Movie.hbs`],t,n,`MoviePage`)}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`SignIn.hbs`]=e({compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){return`<div class="auth-styles sign-in-page">
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
`},useData:!0})})();function h(e=[],t=`page`){let n=[];return e.forEach(e=>{let r=e.startsWith(`/`)?e:`/${e}`,i=`link[data-page-style="${t}:${r}"]`,a=document.head.querySelector(i);a||(a=document.createElement(`link`),a.rel=`stylesheet`,a.href=r,a.dataset.pageStyle=`${t}:${r}`,document.head.appendChild(a)),n.push(a)}),()=>{n.forEach(e=>{e.remove()})}}function g(e){if(!e)return()=>{};let t=t=>{let n=t.target.closest(`.eye-btn`);if(!n||!e.contains(n))return;let r=n.dataset.target;if(!r)return;let i=e.querySelector(`#${r}`);if(!i)return;let a=i.type===`password`;i.type=a?`text`:`password`,n.classList.toggle(`is-active`,a)};return e.addEventListener(`click`,t),()=>{e.removeEventListener(`click`,t)}}var _=(e,t,n)=>{e&&e.classList.toggle(`is-error`,!!n),t&&(t.textContent=n||``)},v=(e=``)=>{let t=e.trim();return t?t.length>63?`Слишком длинный email`:t.includes(`..`)?`Email не должен содержать несколько точек подряд`:/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)?``:`Укажите корректный email`:`Введите email`},y=(e=``)=>{let t=[];return e.length<6&&t.push(`минимум 6 символов`),e.length>255&&t.push(`максимум 255 символов`),/\s/.test(e)&&t.push(`без пробелов`),(/^[a-zA-Z]+$/.test(e)||/^\d+$/.test(e))&&t.push(`нужны буквы и цифры`),t.length?`Пароль: `+t.join(`, `):``},b=(e,t={})=>{if(!e||e.dataset.validationReady===`true`)return()=>{};e.dataset.validationReady=`true`;let n=e.querySelector(`input[type="email"]`),r=e.querySelector(`#password`),i=e.querySelector(`#password-repeat`),a=e.querySelector(`#email-error`),o=e.querySelector(`#password-error`),s=e.querySelector(`#password-repeat-error`),c=[[n,a],[r,o],[i,s]],l=e=>{if(!e)return``;if(e===n){let e=v(n.value||``);return _(n,a,e),e}if(e===r){let e=y(r.value||``);return _(r,o,e),i&&_(i,s,r.value===(i.value||``)?``:`Пароли не совпадают`),e}if(e===i){let e=(r?.value||``)===(i.value||``)?``:`Пароли не совпадают`;return _(i,s,e),e}return``},u=e=>{l(e.target)},d=async a=>{let o=!1;e.noValidate=!0,c.forEach(([e,t])=>{e&&_(e,t,``)});let s=n?l(n):``,u=r?l(r):``,d=i?l(i):``;if((s||u||d)&&(o=!0),o){a.preventDefault();return}if(typeof t.onSubmit==`function`){a.preventDefault();let n=new FormData(e);await t.onSubmit({email:String(n.get(`email`)||``).trim(),password:String(n.get(`password`)||``)},e)}};return c.forEach(([e])=>{e&&(e.addEventListener(`input`,u),e.addEventListener(`blur`,u))}),e.addEventListener(`submit`,d),()=>{c.forEach(([e])=>{e&&(e.removeEventListener(`input`,u),e.removeEventListener(`blur`,u))}),e.removeEventListener(`submit`,d),delete e.dataset.validationReady}},x=class extends n{constructor(e={},t=null,n=null){if(!n)throw Error(`SignIn: не передан корневой элемент для SignIn`);super(e,Handlebars.templates[`SignIn.hbs`],t,n,`SignInPage`),this._detachStyles=null,this._destroyPasswordToggle=null,this._destroyValidation=null}init(){return this._detachStyles=h([`/css/main.css`,`/css/auth.css`,`/css/login.css`],`sign-in`),super.init()}addEventListeners(){this._destroyPasswordToggle=g(this.el),this._destroyValidation=b(this.el.querySelector(`form[data-auth-form="login"]`),{onSubmit:this.handleSubmit.bind(this)})}removeEventListeners(){this._destroyPasswordToggle&&=(this._destroyPasswordToggle(),null),this._destroyValidation&&=(this._destroyValidation(),null)}async handleSubmit(e){let t=await u.signIn(e);if(!t.ok){_(this.el.querySelector(`#password`),this.el.querySelector(`#password-error`),t.resp?.Error||t.resp?.message||t.error||`Не удалось выполнить вход`);return}typeof this.context.onSuccess==`function`&&this.context.onSuccess(t.resp)}beforeDestroy(){this._detachStyles&&=(this._detachStyles(),null)}};(function(){var e=Handlebars.template,t=Handlebars.templates=Handlebars.templates||{};t[`SignUp.hbs`]=e({compiler:[8,`>= 4.3.0`],main:function(e,t,n,r,i){return`<div class="auth-styles sign-up-page">
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
        <div class="bottle-stage" data-bottle-scene>
          <canvas class="bottle-stage__fx" data-bottle-fx aria-hidden="true"></canvas>

          <button
            class="bottle bottle--ready"
            type="button"
            aria-label="Открыть бутылку"
            aria-describedby="sign-up-bottle-hint"
            data-bottle
          >
            <span class="bottle__shadow" aria-hidden="true"></span>
            <span class="bottle__sprite">
              <img
                class="bottle__body"
                src="/img/bottle-body.png"
                alt=""
                draggable="false"
                data-bottle-body
              />
              <img
                class="bottle__cap"
                src="/img/bottle-cap.png"
                alt=""
                draggable="false"
                data-bottle-cap
              />
            </span>
          </button>

          <p class="bottle-stage__hint" id="sign-up-bottle-hint">
            Нажми на бутылку, чтобы открыть и выпустить газировку.
          </p>
        </div>
      </div>
    </div>
  </div>
</div>
`},useData:!0})})();var S=140,C=95,w=150,T=820,E=1680,D=w+T+E,O=.76,k=.108,A=-Math.PI/4,j=45,M=(e,t,n)=>Math.min(Math.max(e,t),n),N=(e,t,n)=>e+(t-e)*n,P=(e,t)=>e+Math.random()*(t-e),F=e=>1-(1-e)**3,I=e=>e*e*e,L=e=>{let t=1.70158;return 1+(t+1)*(e-1)**3+t*(e-1)**2},R=e=>-(Math.cos(Math.PI*e)-1)/2,z=()=>({active:!1,x:0,y:0,vx:0,vy:0,gravity:0,drag:1,life:0,maxLife:0,size:0,alpha:0,stretch:1,type:`spray`}),B=e=>e?e.complete&&e.naturalWidth>0?typeof e.decode==`function`?e.decode().catch(()=>{}):Promise.resolve():new Promise(t=>{let n=()=>{e.removeEventListener(`load`,r),e.removeEventListener(`error`,r)},r=()=>{if(n(),typeof e.decode==`function`){e.decode().catch(()=>{}).finally(t);return}t()};e.addEventListener(`load`,r,{once:!0}),e.addEventListener(`error`,r,{once:!0})}):Promise.resolve(),V=e=>{if(!e)return()=>{};let t=e.querySelector(`[data-bottle-scene]`),n=e.querySelector(`[data-bottle]`),r=e.querySelector(`[data-bottle-body]`),i=e.querySelector(`[data-bottle-cap]`),a=e.querySelector(`[data-bottle-fx]`);if(!t||!n||!r||!i||!a)return()=>{};let o=a.getContext(`2d`);if(!o)return()=>{};let s=window.matchMedia(`(prefers-reduced-motion: reduce)`),c=Array.from({length:S},z),l={carry:0},u={ready:!1,phase:`idle`,interactionStart:0,rafId:0,lastFrameTime:0,idleTime:0,dpr:1,reducedMotion:s.matches};n.dataset.ready=`false`;let d=()=>{let e=t.getBoundingClientRect(),n=window.devicePixelRatio||1;u.dpr=n,a.width=Math.max(1,Math.round(e.width*n)),a.height=Math.max(1,Math.round(e.height*n)),a.style.width=`${e.width}px`,a.style.height=`${e.height}px`,o.setTransform(n,0,0,n,0,0)},f=()=>{let e=t.getBoundingClientRect(),r=n.getBoundingClientRect();return{x:r.left-e.left,y:r.top-e.top,width:r.width,height:r.height}},p=()=>{let e=f();return{x:e.x+e.width*O,y:e.y+e.height*k}},m=()=>{c.forEach(e=>{e.active=!1}),l.carry=0},h=()=>{n.style.transform=`translate3d(0, 0, 0) rotate(${j}deg) scale(1)`,i.style.transform=`translate3d(0, 0, 0) rotate(20deg) scale(1)`,i.style.opacity=`1`,i.style.visibility=`visible`},g=(e,t,r)=>{let i=n.querySelector(`.bottle__shadow`);i&&(i.style.transform=`translateX(-50%) scale(${e}, ${t})`,i.style.opacity=String(r))},_=(e,t,n=.18)=>{let r=c.find(e=>!e.active);if(!r)return;let i=u.reducedMotion?.15:.24,a=A+P(-i,i),o=P(260,560)*t,s=Math.random()<n;r.active=!0,r.type=s?`bubble`:`spray`,r.x=e.x+P(-2,4),r.y=e.y+P(-2,2),r.vx=Math.cos(a)*o+P(-18,22),r.vy=Math.sin(a)*o-P(6,22),r.gravity=s?P(90,180):P(420,620),r.drag=s?.992:.984,r.maxLife=s?P(.7,1.15):P(.45,.92),r.life=r.maxLife,r.size=s?P(2,5.4):P(3.1,7.6),r.alpha=s?P(.18,.34):P(.78,.96),r.stretch=s?1:P(1.4,2.3)},v=(e,t,n)=>{let r=C*n*(u.reducedMotion?.48:1);for(l.carry+=r*t;l.carry>=1;)--l.carry,_(e,N(.72,1.22,n))},y=e=>{let t=1-e.life/e.maxLife,n=e.alpha*(1-t);if(n<=0)return;if(o.save(),o.globalAlpha=n,o.translate(e.x,e.y),e.type===`bubble`){o.beginPath(),o.arc(0,0,e.size,0,Math.PI*2),o.fillStyle=`rgba(255, 245, 226, 0.16)`,o.fill(),o.lineWidth=1,o.strokeStyle=`rgba(255, 255, 255, 0.4)`,o.stroke(),o.restore();return}let r=Math.atan2(e.vy,e.vx)+Math.PI/2;o.rotate(r);let i=e.size,a=e.size*e.stretch,s=o.createRadialGradient(-i*.2,-a*.25,0,0,0,a);s.addColorStop(0,`rgba(255, 246, 225, 0.95)`),s.addColorStop(.32,`rgba(255, 219, 140, 0.92)`),s.addColorStop(.72,`rgba(255, 149, 79, 0.7)`),s.addColorStop(1,`rgba(188, 52, 24, 0.06)`),o.beginPath(),o.ellipse(0,0,i,a,0,0,Math.PI*2),o.fillStyle=s,o.fill(),o.restore()},b=e=>{o.clearRect(0,0,a.width,a.height),c.forEach(t=>{if(t.active){if(t.vx*=t.drag**(e*60),t.vy+=t.gravity*e,t.x+=t.vx*e,t.y+=t.vy*e,t.life-=e,t.life<=0){t.active=!1;return}y(t)}})},x=e=>{let t=Math.sin(e*.0014),r=Math.sin(e*.0021+1.2),a=t*2.2,o=r*-5;n.style.transform=`translate3d(0, ${o}px, 0) rotate(${j+a}deg) scale(1)`,g(1+t*.045,1-Math.abs(t)*.06,.84-Math.abs(t)*.1),i.style.transform=`translate3d(0, 0, 0) rotate(20deg) scale(1)`,i.style.opacity=`1`},V=e=>{let t=M(e/w,0,1),r=Math.max(0,e-w),a=M(r/T,0,1),o=e<w,s=0,c=0,l=1,u=1,d=.82;if(o)s=Math.sin(t*Math.PI*5.4)*(1-t)*2.3,c=t*3,l=1+t*.1,u=1-t*.08,d=.78;else{let e=Math.sin(Math.min(a,1)*Math.PI);s=N(-5.2,.8,F(a))+Math.sin(a*10)*.35*(1-a),c=N(8,-2,F(a))-e*4,l=N(1.12,1,a),u=N(.88,1,a),d=N(.7,.82,a)}if(n.style.transform=`translate3d(0, ${c}px, 0) rotate(${j+s}deg) scale(1)`,g(l,u,d),!o){let e=M(r/(T+240),0,1),t=N(0,124,L(e)),n=N(0,-182,F(e))+e**2*112,a=N(20,288,e),o=N(1,.9,e),s=1-I(M((e-.52)/.48,0,1));i.style.transform=`translate3d(${t}px, ${n}px, 0) rotate(${a}deg) scale(${o})`,i.style.opacity=String(s),i.style.visibility=s<=.02?`hidden`:`visible`}},H=e=>{let t=M((e-(w+T))/420,0,1),r=Math.sin(t*Math.PI*2)*(1-t)*.45;n.style.transform=`translate3d(0, ${r*-1.4}px, 0) rotate(${j+r}deg) scale(1)`,g(1,1,.82),i.style.opacity=`0`,i.style.visibility=`hidden`},U=()=>{u.phase=`idle`,u.interactionStart=0,m(),h(),g(1,1,.82),n.ariaLabel=`Открыть бутылку`},W=e=>{!u.ready||u.phase!==`idle`||(u.phase=`opening`,u.interactionStart=e,l.carry=0,n.ariaLabel=`Бутылка открывается`)},G=(e,t)=>{if(u.phase===`idle`){x(e);return}let r=e-u.interactionStart,i=r-(w+120);if(V(r),i>=0&&r<=D){let e=M(i/E,0,1),n=1-(1-M(e/.16,0,1))**2,r=1-R(e),a=M(Math.max(n,r*.82),.18,1);v(p(),t,a)}r>=D&&(u.phase=`opened`,n.ariaLabel=`Анимация завершена`),u.phase===`opened`&&H(r)},K=e=>{u.lastFrameTime||=e;let t=Math.min((e-u.lastFrameTime)/1e3,.032);u.lastFrameTime=e,u.idleTime+=t,G(e,t),b(t),u.rafId=window.requestAnimationFrame(K)},q=()=>{W(performance.now())},J=()=>{d()},Y=()=>{u.reducedMotion=s.matches,m(),u.phase!==`idle`&&U()};return Promise.all([B(r),B(i)]).finally(()=>{d(),u.ready=!0,n.dataset.ready=`true`,U()}),window.addEventListener(`resize`,J),n.addEventListener(`click`,q),typeof s.addEventListener==`function`&&s.addEventListener(`change`,Y),u.rafId=window.requestAnimationFrame(K),()=>{window.removeEventListener(`resize`,J),n.removeEventListener(`click`,q),typeof s.removeEventListener==`function`&&s.removeEventListener(`change`,Y),u.rafId&&=(window.cancelAnimationFrame(u.rafId),0),o.clearRect(0,0,a.width,a.height),m()}},H=class extends n{constructor(e={},t=null,n=null){if(!n)throw Error(`SignUp: не передан корневой элемент для SignUp`);super(e,Handlebars.templates[`SignUp.hbs`],t,n,`SignUpPage`),this._detachStyles=null,this._destroyPasswordToggle=null,this._destroyValidation=null,this._destroyBottleEffect=null}init(){return this._detachStyles=h([`/css/main.css`,`/css/auth.css`,`/css/register.css`],`sign-up`),super.init()}addEventListeners(){this._destroyPasswordToggle=g(this.el),this._destroyValidation=b(this.el.querySelector(`form[data-auth-form="register"]`),{onSubmit:this.handleSubmit.bind(this)}),this._destroyBottleEffect=V(this.el)}removeEventListeners(){this._destroyPasswordToggle&&=(this._destroyPasswordToggle(),null),this._destroyValidation&&=(this._destroyValidation(),null),this._destroyBottleEffect&&=(this._destroyBottleEffect(),null)}async handleSubmit(e){let t=await u.signUp(e),n={"user already exists":`такой пользователь уже существует`,"invalid credentials":`Некорректные данные для учётной записи`,"internal server error":`Ошибка сервера`};if(!t.ok){_(this.el.querySelector(`input[type="email"]`),this.el.querySelector(`#password`),this.el.querySelector(`#password-error`),n[t.resp?.Error]||t.resp?.message||t.error||`Не удалось зарегистрироваться`);return}typeof this.context.onSuccess==`function`&&this.context.onSuccess(t.resp)}beforeDestroy(){this._detachStyles&&=(this._detachStyles(),null)}},U=document.getElementById(`root`);if(!U)throw Error(`main.js: Не найден #root`);var W=new e(U);async function G(){await u.init(),W.registerRoute(`/`,e=>new p({},null,e)).registerRoute(`/sign-in`,e=>new x({onSuccess:()=>W.go(`/`)},null,e)).registerRoute(`/sign-up`,e=>new H({onSuccess:()=>W.go(`/`)},null,e)).registerRoute(`/movie`,e=>new m({},null,e)),W.init()}G();
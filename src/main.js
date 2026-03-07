import { Router } from './router/BaseRouter.js';
import MainPage from './pages/Main/Main.js';
import SignInPage from './pages/SignIn/SignIn.js';
import SignUpPage from './pages/SignUp/SignUp.js';

const rootEl = document.getElementById('root');
if (!rootEl) {
    throw new Error('main.js: Не найден #root');
}

// Нужно дёргать данные из api.js / client.js
const router = new Router(rootEl);
router
    .addRoute('/', (root) => new MainPage(
        {
            isAuthorized: false,
            userName: 'Олег Константинович',
        },
        null,
        root
    ))
    .addRoute('/sign-in', (root) => new SignInPage({}, null, root))
    .addRoute('/sign-up', (root) => new SignUpPage({}, null, root))
    // .addRoute('/404', (root) => new NotFoundPage({}, null, root));

router.start();
import { Router } from './router/Router.js';
import MainPage from './pages/Main/Main.js';
import SignInPage from './pages/SignIn/SignIn.js';
import SignUpPage from './pages/SignUp/SignUp.js';

const rootEl = document.getElementById('root');

if (!rootEl) {
    throw new Error('main.js: Не найден #root');
}

const router = new Router(rootEl);

router
    .registerRoute('/', (root) => new MainPage(
        {
            userData: {
                isAuthorized: true,
                userName: 'Олег Константинович',
            },
        },
        null,
        root
    ))
    .registerRoute('/sign-in', (root) => new SignInPage({}, null, root))
    .registerRoute('/sign-up', (root) => new SignUpPage({}, null, root));

router.init();
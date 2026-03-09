import { Router } from './router/Router.js';
import MainPage from './pages/Main/Main.js';
import MoviePage from './pages/Movie/Movie.js';
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
                isAuthorized: false,
                userName: 'Олег Константинович',
            },
        },
        null,
        root
    ))
    .registerRoute('/movie', (root) => new MoviePage({}, null, root))
    .registerRoute('/sign-in', (root) => new SignInPage({}, null, root))
    .registerRoute('/sign-up', (root) => new SignUpPage(
        {
            onSuccess: () => router.go('/sign-in'),
        },
        null,
        root
    ))

router.init();
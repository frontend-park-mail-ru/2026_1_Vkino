// написать frontend-router, который по url -> Page
// пока базовый вид

// import MainPage from './pages/Main/Main.js';

// document.addEventListener('DOMContentLoaded', () => {
//     const rootEl = document.getElementById('root');

//     if (!rootEl) {
//         throw new Error('Не найден контейнер #root');
//     }

//     const page = new MainPage(
//         {
//             isAuthorized: true,
//             userName: 'Олег Константинович',
//             onSignIn: () => {
//                 console.log('Открыть вход');
//                 window.location.href = '/login';
//             },
//             onSignUp: () => {
//                 console.log('Открыть регистрацию');
//                 window.location.href = '/register';
//             },
//         },
//         null,
//         rootEl
//     );

//     page.init();
// });
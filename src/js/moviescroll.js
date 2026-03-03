document.addEventListener('DOMContentLoaded', () => {
    const scrollContainers = document.querySelectorAll('.scroll-container');
    
    const moviePosters = document.querySelectorAll('.movie-poster')

    moviePosters.forEach(moviePoster => {
        moviePoster.addEventListener('click', (e) => {
            console.log("нажали на постер")
            /* логика перехода на другую страницу и удаления listener-ов*/
        })
    })

    scrollContainers.forEach(container => {
        let isDragging = false;
        let startX;
        let startScrollLeft;

        container.addEventListener('mousedown', (e) => {
            e.preventDefault();
            
            isDragging = true;
            startX = e.pageX;
            startScrollLeft = container.scrollLeft;

            moviePosters.forEach(poster => { // я понимаю, что это плохо, но больше никак не получилось починить(
                // не переопределяется cursor pointer при наведении на постер
                // как будто можно и просто с cursor pointer перемещать)
                poster.style.cursor = 'grabbing';
            });

            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.pageX - startX;
            container.scrollLeft = startScrollLeft - dx;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'default';
                container.style.userSelect = 'auto';

                moviePosters.forEach(poster => { // ну и тут тоже плохо соответственно, но я не придумала, как еще(
                    poster.style.cursor = 'pointer';
            });
            }
        });

        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'default';
                container.style.userSelect = 'auto';
            }
        });
    });
});


document.addEventListener('DOMContentLoaded', () => {
    const scrollContainers = document.querySelectorAll('.scroll-container');
    
    const moviePosters = document.querySelectorAll('.movie-poster')

    moviePosters.forEach(moviePoster => {
        moviePoster.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("нажали на постер")
            /* логика перехода на другую страницу и удаления listener-ов*/
        })
    })

    scrollContainers.forEach(container => {
        let isDragging = false;
        let startX;
        let startScrollLeft;

        container.addEventListener('mousedown', (e) => {
            e.preventDefault(); // спросить, что за стандартное поведение, из-за которого не работает
            
            isDragging = true;
            startX = e.pageX;
            startScrollLeft = container.scrollLeft;
            container.style.cursor = 'grabbing';
            container.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const dx = e.pageX - startX;
            container.scrollLeft = startScrollLeft - dx;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'pointer';
                container.style.userSelect = 'auto';
            }
        });

        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'pointer';
                container.style.userSelect = 'auto';
            }
        });
    });
});


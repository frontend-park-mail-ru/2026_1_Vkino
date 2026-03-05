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

            container.classList.add('is-dragging');
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.pageX - startX;
            container.scrollLeft = startScrollLeft - dx;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('is-dragging');
            }
        });

        document.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
            }
        });
    });
});


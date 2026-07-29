<script>
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.course-item-container');
    const cards    = document.querySelectorAll('.course-item');
    const dots     = document.querySelectorAll('.carousel-indicators li');

    /* ---------- 1️⃣  Dot navigation ---------- */
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const idx = Number(dot.dataset.index);
            container.scrollLeft = cards[idx].offsetLeft;
        });
    });

    /* ---------- 2️⃣  Keep dots in sync while scrolling ---------- */
    container.addEventListener('scroll', () => {
        let closest = 0;
        let minDiff = Infinity;
        cards.forEach((card, i) => {
            const diff = Math.abs(card.offsetLeft - container.scrollLeft);
            if (diff < minDiff) {
                minDiff = diff;
                closest = i;
            }
        });
        dots.forEach((dot, i) => dot.classList.toggle('active', i === closest));
    });

    /* ---------- 3️⃣  Auto‑scroll ---------- */
    const scrollSpeed = 5;          // pixels per step
    const intervalMs  = 20;         // ms between steps
    let autoScrollId = null;

    function startAutoScroll() {
        if (autoScrollId !== null) return;          // already running
        autoScrollId = setInterval(() => {
            if (container.scrollLeft + container.clientWidth >= container.scrollWidth) {
                container.scrollLeft = 0;            // jump back to start
            } else {
                container.scrollLeft += scrollSpeed;
            }
        }, intervalMs);
    }

    function stopAutoScroll() {
        clearInterval(autoScrollId);
        autoScrollId = null;
    }

    // Only start if there is something to scroll
    if (container.scrollWidth > container.clientWidth) {
        startAutoScroll();

        // Pause when the mouse is over the carousel (so the user can read)
        container.addEventListener('mouseenter', stopAutoScroll);
        container.addEventListener('mouseleave', startAutoScroll);
    }
});
</script>
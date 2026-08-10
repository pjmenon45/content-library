document.addEventListener('DOMContentLoaded', () => {
  const placeholder = document.getElementById('carousel-placeholder');
  if (!placeholder) return;

  // 1. Fetch carousel.html and inject into index.html
  fetch('carousel.html')
    .then(response => {
      if (!response.ok) throw new Error('Failed to load carousel');
      return response.text();
    })
    .then(html => {
      placeholder.innerHTML = html;
      initCarousel(); // Initialize indicators and scroll handlers
    })
    .catch(err => console.error('Error loading carousel:', err));
});

function initCarousel() {
  const container = document.querySelector('.course-item-container');
  const items = document.querySelectorAll('.course-item');
  const dots = document.querySelectorAll('.carousel-indicators li');

  if (!container || !dots.length) return;

  let currentIndex = 0;
  let autoScrollTimer = null;

  // Function to scroll to a specific slide
  const scrollToSlide = (index) => {
    if (items[index]) {
      items[index].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  // Click handler for dots
  dots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'), 10);
      if (!isNaN(index)) {
        currentIndex = index;
        scrollToSlide(currentIndex);
      }
    });
  });

  // Sync active dot on scroll
  container.addEventListener('scroll', () => {
    let closestIndex = 0;
    let minDistance = Infinity;

    items.forEach((item, index) => {
      const distance = Math.abs(item.getBoundingClientRect().left - container.getBoundingClientRect().left);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });

    currentIndex = closestIndex;
    dots.forEach((dot, idx) => {
      dot.classList.toggle('active', idx === closestIndex);
    });
  });

  // Start auto-scrolling
  const startAutoScroll = () => {
    autoScrollTimer = setInterval(() => {
      currentIndex = (currentIndex + 1) % items.length;
      scrollToSlide(currentIndex);
    }, 3000); // Scrolls every 3 seconds
  };

  // Pause on hover
  const stopAutoScroll = () => clearInterval(autoScrollTimer);

  container.addEventListener('mouseenter', stopAutoScroll);
  container.addEventListener('mouseleave', startAutoScroll);
  container.addEventListener('touchstart', stopAutoScroll);

  startAutoScroll();
}
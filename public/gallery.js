const CATEGORY_LABELS = { article: 'Article', ebook: 'eBook', video: 'Video', webinar: 'Webinar' };

const form = document.getElementById('filter-form');
const grid = document.getElementById('card-grid');
const emptyState = document.getElementById('empty-state');

function currentFilters() {
  const category = form.querySelector('input[name="category"]:checked').value;
  const topic = form.querySelector('#topic').value;
  return { category, topic };
}

function cardHTML(item) {
  const typeLabel = CATEGORY_LABELS[item.category] || item.category;
  const thumb = `https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${item.youtube_id}`;
  return `
    <li class="card">
      <div class="card-media">
        <img src="${thumb}" alt="" loading="lazy">
        <a class="play-overlay" href="${watchUrl}" target="_blank" rel="noopener" aria-label="Watch ${escapeHTML(item.title)} on YouTube">
          <span aria-hidden="true">&#9654;</span>
        </a>
      </div>
      <div class="card-body">
        <span class="card-type">${typeLabel}</span>
        <h3 class="card-title"><a href="${watchUrl}" target="_blank" rel="noopener">${escapeHTML(item.title)}</a></h3>
        <p class="card-desc">${escapeHTML(item.description)}</p>
      </div>
    </li>
  `;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadContent() {
  const { category, topic } = currentFilters();
  const params = new URLSearchParams({ category, topic });

  grid.innerHTML = '';
  emptyState.hidden = true;

  try {
    const res = await fetch(`/api/content?${params.toString()}`);
    const items = await res.json();

    if (!items.length) {
      emptyState.hidden = false;
      return;
    }

    grid.innerHTML = items.map(cardHTML).join('');
  } catch (err) {
    emptyState.textContent = 'Could not load content. Is the server running?';
    emptyState.hidden = false;
  }
}

form.addEventListener('change', loadContent);
loadContent();

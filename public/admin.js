const form = document.getElementById('add-form');
const status = document.getElementById('form-status');
const list = document.getElementById('existing-list');

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function loadExisting() {
  const res = await fetch('/api/content');
  const items = await res.json();
  list.innerHTML = items.map(item => `
    <li class="card">
      <div class="card-media">
        <img src="https://img.youtube.com/vi/${item.youtube_id}/hqdefault.jpg" alt="" loading="lazy">
      </div>
      <div class="card-body">
        <span class="card-type">${item.category}</span>
        <h3 class="card-title">${escapeHTML(item.title)}</h3>
        <p class="card-desc">${escapeHTML(item.description)}</p>
        <div class="card-footer">
          <button class="btn btn-danger" data-id="${item.id}">Delete</button>
        </div>
      </div>
    </li>
  `).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'form-status';
  status.textContent = '';

  const data = Object.fromEntries(new FormData(form).entries());

  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const body = await res.json();

    if (!res.ok) {
      status.className = 'form-status error';
      status.textContent = body.error || 'Something went wrong.';
      return;
    }

    status.className = 'form-status success';
    status.textContent = `Added "${body.title}".`;
    form.reset();
    loadExisting();
  } catch (err) {
    status.className = 'form-status error';
    status.textContent = 'Could not reach the server.';
  }
});

list.addEventListener('click', async (e) => {
  if (!e.target.matches('[data-id]')) return;
  const id = e.target.getAttribute('data-id');
  if (!confirm('Delete this entry?')) return;
  await fetch(`/api/content/${id}`, { method: 'DELETE' });
  loadExisting();
});

async function loadStats() {
  const panel = document.getElementById('stats-panel');
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    const recentDays = stats.viewsByDay.slice(0, 7)
      .map(d => `${d.day}: ${d.n}`)
      .join(' &middot; ') || 'no data yet';
    const referrers = stats.topReferrers.slice(0, 5)
      .map(r => `${escapeHTML(r.referrer)} (${r.n})`)
      .join(', ') || 'none recorded';

    panel.innerHTML = `
      <p><strong>${stats.totalViews}</strong> total gallery views &middot; <strong>${stats.totalContent}</strong> entries in the library.</p>
      <p>Last 7 days: ${recentDays}</p>
      <p>Top referrers: ${referrers}</p>
    `;
  } catch (err) {
    panel.textContent = 'Could not load stats.';
  }
}

loadExisting();
loadStats();

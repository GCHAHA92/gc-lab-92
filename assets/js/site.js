(() => {
  const $ = selector => document.querySelector(selector);
  const toast = $('#toast');
  let toastTimer;
  function showToast(message) { if (!toast) return; clearTimeout(toastTimer); toast.textContent = message; toast.classList.add('show'); toastTimer = setTimeout(() => toast.classList.remove('show'), 2200); }
  document.querySelectorAll('[data-message]').forEach(element => element.addEventListener('click', () => showToast(element.dataset.message)));
  document.querySelectorAll('[data-message][tabindex]').forEach(element => element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showToast(element.dataset.message); }
  }));
  const body = $('.window-body');
  $('#minBtn')?.addEventListener('click', () => { body.hidden = !body.hidden; });
  $('#maxBtn')?.addEventListener('click', () => $('#mainWindow')?.classList.toggle('max'));
  const toolGrid = $('.tool-grid');
  if (toolGrid) {
    const items = [...toolGrid.children], pageSize = 4, pageCount = Math.ceil(items.length / pageSize); let page = 0;
    const render = nextPage => {
      const previousPage = page;
      page = Math.max(0, Math.min(nextPage, pageCount - 1));
      items.forEach((item, index) => { item.hidden = Math.floor(index / pageSize) !== page; });
      $('#pageLabel').textContent = `${page + 1} / ${pageCount}`;
      $('#prevPage').disabled = page === 0;
      $('#nextPage').disabled = page === pageCount - 1;
      toolGrid.classList.remove('page-next', 'page-prev');
      void toolGrid.offsetWidth;
      if (page !== previousPage) toolGrid.classList.add(page > previousPage ? 'page-next' : 'page-prev');
    };
    if (pageCount > 1) { $('#pager').hidden = false; $('#prevPage').addEventListener('click', () => render(page - 1)); $('#nextPage').addEventListener('click', () => render(page + 1)); }
    render(0);
  }
  const clock = $('#clock');
  const updateClock = () => { if (clock) clock.textContent = new Intl.DateTimeFormat('ko-KR', { hour:'2-digit', minute:'2-digit', hour12:false }).format(new Date()); };
  updateClock(); setInterval(updateClock, 30000);
})();

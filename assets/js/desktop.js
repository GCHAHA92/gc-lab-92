(() => {
  const body = document.body;
  if (!body || body.dataset.gcDesktopReady === 'true') return;
  body.dataset.gcDesktopReady = 'true';
  body.classList.add('gc-desktop-page');

  const root = body.dataset.gcRoot || '../../';
  const taskTitle = body.dataset.gcTaskTitle || document.title || '임시 사이트';
  const taskIcon = body.dataset.gcTaskIcon || 'assets/icons/computer.svg';
  const taskIconPath = `${root}${taskIcon}`;

  const analytics = document.createElement('script');
  analytics.src = `${root}assets/js/analytics.js`;
  document.head.append(analytics);

  const shortcuts = document.createElement('aside');
  shortcuts.className = 'gc-shell-shortcuts';
  shortcuts.setAttribute('aria-label', '바탕화면 바로가기');
  shortcuts.innerHTML = `
    <a class="gc-shell-shortcut" href="${root}tools/">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/icons/folder.svg" alt=""></span><span>MY_TOOLS</span>
    </a>
    <button class="gc-shell-shortcut" type="button" data-gc-message="새올행정시스템 바로가기입니다.">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/images/saeol.ico" alt=""></span><span>새올</span>
    </button>
    <a class="gc-shell-shortcut" href="${root}about/">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/icons/computer.svg" alt=""></span><span>ABOUT_ME</span>
    </a>
    <a class="gc-shell-shortcut" href="${root}notes/">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/icons/notebook.svg" alt=""></span><span>NOTES</span>
    </a>
    <a class="gc-shell-shortcut" href="${root}guestbook/">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/icons/guestbook.svg" alt=""></span><span>방명록</span>
    </a>
    <button class="gc-shell-shortcut" type="button" data-gc-message="삭제된 아이디어도 언젠가 부활할 수 있습니다.">
      <span class="gc-shell-shortcut-icon"><img src="${root}assets/icons/trash.svg" alt=""></span><span>TRASH</span>
    </button>`;

  const taskbar = document.createElement('div');
  taskbar.className = 'gc-shell-taskbar';
  taskbar.innerHTML = `
    <button class="gc-shell-start" type="button">▣ START</button>
    <div class="gc-shell-task"><img src="${taskIconPath}" alt="">${taskTitle}</div>
    <div class="gc-shell-clock">00:00</div>`;

  const toast = document.createElement('div');
  toast.className = 'gc-shell-toast';
  toast.setAttribute('role', 'status');

  body.prepend(shortcuts);
  body.append(taskbar, toast);

  const appWindow = body.querySelector('.window');
  const minimizeButton = appWindow?.querySelector('[aria-label="최소화"]');
  const maximizeButton = appWindow?.querySelector('[aria-label="최대화"]');

  const setMaximized = maximized => {
    if (!appWindow || !maximizeButton) return;
    appWindow.classList.toggle('gc-window-maximized', maximized);
    body.classList.toggle('gc-window-maximized', maximized);
    maximizeButton.textContent = maximized ? '❐' : '□';
    maximizeButton.setAttribute('aria-label', maximized ? '이전 크기로 복원' : '최대화');
  };

  minimizeButton?.addEventListener('click', () => {
    appWindow.classList.toggle('gc-window-minimized');
  });
  maximizeButton?.addEventListener('click', () => {
    setMaximized(!appWindow.classList.contains('gc-window-maximized'));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && appWindow?.classList.contains('gc-window-maximized')) setMaximized(false);
  });

  let toastTimer;
  const showToast = message => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('show');
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };

  shortcuts.querySelectorAll('[data-gc-message]').forEach(button => {
    button.addEventListener('click', () => showToast(button.dataset.gcMessage));
  });
  taskbar.querySelector('.gc-shell-start').addEventListener('click', () => {
    location.href = root;
  });

  const clock = taskbar.querySelector('.gc-shell-clock');
  const updateClock = () => {
    clock.textContent = new Intl.DateTimeFormat('ko-KR', {
      hour:'2-digit', minute:'2-digit', hour12:false
    }).format(new Date());
  };
  updateClock();
  setInterval(updateClock, 30000);
})();

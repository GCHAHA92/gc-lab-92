(() => {
  'use strict';

  const $ = selector => document.querySelector(selector);
  const PAGE_SIZE = 12;
  const config = window.GC_SUPABASE || {};
  const configured = Boolean(config.url && config.publishableKey && window.supabase?.createClient);
  const client = configured
    ? window.supabase.createClient(config.url, config.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })
    : null;

  const state = {
    entries: [],
    total: 0,
    loading: false,
    manageMode: 'edit',
    manageEntryId: null,
  };

  function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(value));
  }

  function setStatus(message, tone = '') {
    const status = $('#status');
    status.className = `terminal${tone ? ` ${tone}` : ''}`;
    status.replaceChildren(document.createTextNode(`${message} `));
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    status.append(cursor);
  }

  function setBusy(button, busy, busyText = '처리 중...') {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? busyText : button.dataset.label;
  }

  function entryById(id) {
    return state.entries.find(entry => entry.id === id);
  }

  function makeButton(label, action, id) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'text-btn';
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.id = id;
    return button;
  }

  function renderLocked(entry, body) {
    body.className = 'locked';
    const description = document.createElement('p');
    description.textContent = '비밀글입니다. 작성할 때 설정한 비밀번호를 입력해주세요.';
    const input = document.createElement('input');
    input.type = 'password';
    input.minLength = 6;
    input.maxLength = 50;
    input.autocomplete = 'current-password';
    input.placeholder = '글 비밀번호';
    input.setAttribute('aria-label', '비밀글 비밀번호');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn small';
    button.textContent = '내용 보기';
    button.dataset.action = 'unlock';
    button.dataset.id = entry.id;
    const error = document.createElement('span');
    error.className = 'inline-error hidden';
    error.dataset.unlockError = entry.id;
    body.append(description, input, button, error);
  }

  function renderEntry(entry) {
    const article = document.createElement('article');
    article.className = `entry${entry.is_secret ? ' secret' : ''}`;
    article.dataset.id = entry.id;

    const top = document.createElement('header');
    top.className = 'entry-top';
    const nickname = document.createElement('b');
    nickname.textContent = entry.nickname;
    top.append(nickname);
    if (entry.is_secret) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = '비밀글';
      top.append(badge);
    }
    const time = document.createElement('time');
    time.dateTime = entry.created_at;
    time.textContent = formatDate(entry.created_at);
    top.append(time);

    const body = document.createElement('div');
    if (entry.is_secret && !entry.unlocked) {
      renderLocked(entry, body);
    } else {
      body.className = 'entry-body';
      body.textContent = entry.content || '';
    }

    const actions = document.createElement('footer');
    actions.className = 'entry-actions';
    actions.append(makeButton('수정', 'edit', entry.id), makeButton('삭제', 'delete', entry.id));
    article.append(top, body, actions);
    return article;
  }

  function renderEntries() {
    const list = $('#entryList');
    list.replaceChildren(...state.entries.map(renderEntry));
    $('#entryCount').textContent = `${state.total.toLocaleString()}개의 기록`;
    $('#emptyState').classList.toggle('hidden', state.entries.length > 0);
    $('#moreBtn').classList.toggle('hidden', state.entries.length >= state.total || !state.entries.length);
  }

  async function loadEntries({ append = false } = {}) {
    if (!client || state.loading) return;
    state.loading = true;
    const refreshButton = $('#refreshBtn');
    const moreButton = $('#moreBtn');
    setBusy(append ? moreButton : refreshButton, true, '불러오는 중...');
    setStatus('방명록을 불러오고 있습니다...');

    try {
      const offset = append ? state.entries.length : 0;
      const { data, error } = await client.rpc('list_guestbook_entries', { p_limit: PAGE_SIZE, p_offset: offset });
      if (error) throw error;
      const rows = Array.isArray(data) ? data : [];
      state.total = Number(rows[0]?.total_count || (append ? state.total : 0));
      state.entries = append ? [...state.entries, ...rows] : rows;
      renderEntries();
      setStatus('방명록을 불러왔습니다.', 'ok');
    } catch (error) {
      console.error('[guestbook] load failed', error);
      setStatus(error.message || '방명록을 불러오지 못했습니다.', 'error');
    } finally {
      setBusy(append ? moreButton : refreshButton, false);
      state.loading = false;
    }
  }

  async function createEntry(event) {
    event.preventDefault();
    if (!client) return;
    if ($('#website').value) return;
    const button = $('#submitBtn');
    const nickname = $('#nickname').value.trim();
    const content = $('#message').value.trim();
    const password = $('#password').value;
    const isSecret = $('#isSecret').checked;

    if (!nickname || !content || password.length < 6) {
      setStatus('닉네임, 내용, 6자 이상의 비밀번호를 확인해주세요.', 'error');
      return;
    }

    setBusy(button, true, '저장 중...');
    setStatus('새 글을 안전하게 저장하고 있습니다...');
    try {
      const { error } = await client.rpc('create_guestbook_entry', {
        p_nickname: nickname, p_content: content, p_password: password, p_is_secret: isSecret,
      });
      if (error) throw error;
      $('#writeForm').reset();
      $('#charCount').textContent = '0 / 500';
      setStatus('방명록에 글을 남겼습니다.', 'ok');
      await loadEntries();
    } catch (error) {
      console.error('[guestbook] create failed', error);
      setStatus(error.message || '글을 저장하지 못했습니다.', 'error');
    } finally {
      setBusy(button, false);
    }
  }

  async function unlockEntry(button, entry) {
    const locked = button.closest('.locked');
    const input = locked.querySelector('input');
    const errorBox = locked.querySelector('.inline-error');
    if (input.value.length < 6) {
      errorBox.textContent = '비밀번호를 6자 이상 입력해주세요.';
      errorBox.classList.remove('hidden');
      return;
    }
    setBusy(button, true, '확인 중...');
    errorBox.classList.add('hidden');
    try {
      const { data, error } = await client.rpc('read_secret_guestbook_entry', { p_id: entry.id, p_password: input.value });
      if (error) throw error;
      const content = Array.isArray(data) ? data[0]?.content : null;
      if (!content) throw new Error('비밀번호가 일치하지 않습니다.');
      entry.content = content;
      entry.unlocked = true;
      renderEntries();
    } catch (error) {
      errorBox.textContent = error.message || '비밀글을 열지 못했습니다.';
      errorBox.classList.remove('hidden');
      setBusy(button, false);
    }
  }

  function openManageDialog(entry, mode) {
    state.manageMode = mode;
    state.manageEntryId = entry.id;
    $('#manageForm').reset();
    $('#dialogMessage').textContent = '';
    $('#dialogTitle').textContent = mode === 'edit' ? '글 수정' : '글 삭제';
    $('#dialogSubmit').textContent = mode === 'edit' ? '저장' : '삭제';
    $('#dialogSubmit').classList.toggle('danger', mode === 'delete');
    const editFields = $('#editFields');
    const isEdit = mode === 'edit';
    editFields.classList.toggle('hidden', !isEdit);
    editFields.querySelectorAll('input,textarea').forEach(field => { field.disabled = !isEdit; });
    if (mode === 'edit') {
      if (entry.is_secret && !entry.unlocked) {
        setStatus('비밀글 내용을 먼저 연 뒤 수정해주세요.', 'error');
        return;
      }
      $('#editNickname').value = entry.nickname;
      $('#editMessage').value = entry.content || '';
      $('#editSecret').checked = entry.is_secret;
    }
    $('#manageDialog').showModal();
    $('#managePassword').focus();
  }

  async function manageEntry(event) {
    event.preventDefault();
    const entry = entryById(state.manageEntryId);
    if (!entry || !client) return;
    const password = $('#managePassword').value;
    const submit = $('#dialogSubmit');
    if (password.length < 6) {
      $('#dialogMessage').textContent = '비밀번호를 6자 이상 입력해주세요.';
      return;
    }
    setBusy(submit, true, state.manageMode === 'edit' ? '저장 중...' : '삭제 중...');
    $('#dialogMessage').textContent = '';
    try {
      let response;
      if (state.manageMode === 'edit') {
        response = await client.rpc('update_guestbook_entry', {
          p_id: entry.id,
          p_nickname: $('#editNickname').value.trim(),
          p_content: $('#editMessage').value.trim(),
          p_password: password,
          p_is_secret: $('#editSecret').checked,
        });
      } else {
        response = await client.rpc('delete_guestbook_entry', { p_id: entry.id, p_password: password });
      }
      if (response.error) throw response.error;
      if (!response.data) throw new Error('비밀번호가 일치하지 않습니다.');
      $('#manageDialog').close();
      setStatus(state.manageMode === 'edit' ? '글을 수정했습니다.' : '글을 삭제했습니다.', 'ok');
      await loadEntries();
    } catch (error) {
      $('#dialogMessage').textContent = error.message || '요청을 처리하지 못했습니다.';
    } finally {
      setBusy(submit, false);
    }
  }

  function handleListClick(event) {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const entry = entryById(button.dataset.id);
    if (!entry) return;
    if (button.dataset.action === 'unlock') unlockEntry(button, entry);
    if (button.dataset.action === 'edit') openManageDialog(entry, 'edit');
    if (button.dataset.action === 'delete') openManageDialog(entry, 'delete');
  }

  function init() {
    $('#message').addEventListener('input', event => {
      $('#charCount').textContent = `${event.target.value.length} / 500`;
    });
    $('#writeForm').addEventListener('submit', createEntry);
    $('#refreshBtn').addEventListener('click', () => loadEntries());
    $('#moreBtn').addEventListener('click', () => loadEntries({ append: true }));
    $('#entryList').addEventListener('click', handleListClick);
    $('#manageForm').addEventListener('submit', manageEntry);
    $('#dialogClose').addEventListener('click', () => $('#manageDialog').close());
    $('#dialogCancel').addEventListener('click', () => $('#manageDialog').close());

    if (!configured) {
      $('#setupNotice').classList.remove('hidden');
      $('#writeForm').querySelectorAll('input,textarea,button').forEach(element => { element.disabled = true; });
      $('#refreshBtn').disabled = true;
      setStatus('Supabase 프로젝트 연결 후 방명록을 사용할 수 있습니다.', 'error');
      return;
    }
    loadEntries();
  }

  init();
})();

/* ── CURSOR GLOW ── */
const cursorGlow = document.getElementById('cursorGlow');
document.addEventListener('mousemove', e => {
  cursorGlow.style.left = e.clientX + 'px';
  cursorGlow.style.top  = e.clientY + 'px';
});

/* ── THEME TOGGLE ── */
const themeBtn = document.getElementById('toggleTheme');
const savedTheme = localStorage.getItem('kbTheme');
if (savedTheme === 'light') document.body.classList.add('light');
themeBtn.addEventListener('click', () => {
  document.body.classList.toggle('light');
  localStorage.setItem('kbTheme', document.body.classList.contains('light') ? 'light' : 'dark');
  showToast(document.body.classList.contains('light') ? '☀️ Light mode on' : '🌙 Dark mode on');
});

/* ── DATA ── */
let tasksData = {};
let dragEl    = null;
let editingId = null;
let selectedPriority = 'medium';
let selectedCol      = 'todo';

/* ── COLUMNS MAP ── */
const columns = {
  todo:     { list: document.getElementById('todo-list'),     badge: document.getElementById('todo-badge'),     count: document.getElementById('todoCount') },
  progress: { list: document.getElementById('progress-list'), badge: document.getElementById('progress-badge'), count: document.getElementById('progressCount') },
  done:     { list: document.getElementById('done-list'),     badge: document.getElementById('done-badge'),     count: document.getElementById('doneCount') }
};

/* ── TOAST ── */
function showToast(msg, icon='✦') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span>${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove());
  }, 2800);
}

/* ── UNIQUE ID ── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

/* ── DUE DATE LABEL ── */
function dueDateLabel(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr + 'T00:00:00');
  const diff  = Math.round((due - today) / 86400000);
  if (diff < 0)  return { text: `${Math.abs(diff)}d overdue`, cls: 'overdue' };
  if (diff === 0) return { text: 'Due today', cls: 'soon' };
  if (diff === 1) return { text: 'Due tomorrow', cls: 'soon' };
  if (diff <= 7)  return { text: `Due in ${diff}d`, cls: 'soon' };
  return { text: due.toLocaleDateString('en-GB', {day:'numeric', month:'short'}), cls: '' };
}

/* ── CREATE TASK ELEMENT ── */
function createTaskEl(data) {
  const { id, title, desc, priority, due, colId, done: isDone } = data;

  const priColors = { high: 'var(--accent-high)', medium: 'var(--accent-med)', low: 'var(--accent-low)' };
  const dueInfo   = dueDateLabel(due);

  const el = document.createElement('div');
  el.className = 'task' + (isDone ? ' done-task' : '');
  el.dataset.id = id;
  el.setAttribute('draggable', 'true');
  el.style.setProperty('--pri-color', priColors[priority] || 'transparent');

  el.innerHTML = `
    <div class="task-top">
      <div class="task-title">${escHtml(title)}</div>
    </div>
    ${desc ? `<div class="task-desc">${escHtml(desc)}</div>` : ''}
    <div class="task-meta">
      <span class="tag-priority tag-${priority}">${priority}</span>
      ${dueInfo ? `<span class="tag-due ${dueInfo.cls}">⏰ ${dueInfo.text}</span>` : ''}
    </div>
    <div class="task-actions">
      <button class="task-btn complete-btn">${isDone ? '↩ Undo' : '✓ Done'}</button>
      <button class="task-btn edit-btn">✎ Edit</button>
      <button class="task-btn delete-btn">✕ Delete</button>
    </div>
  `;

  /* drag */
  el.addEventListener('dragstart', () => {
    dragEl = el;
    setTimeout(() => el.classList.add('dragging'), 0);
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    dragEl = null;
  });

  /* complete */
  el.querySelector('.complete-btn').addEventListener('click', () => {
    data.done = !data.done;
    el.classList.toggle('done-task', data.done);
    el.querySelector('.complete-btn').textContent = data.done ? '↩ Undo' : '✓ Done';
    if (data.done) showToast('🎉 Task completed!', '✓');
    persist(); updateStats();
  });

  /* delete */
  el.querySelector('.delete-btn').addEventListener('click', () => {
    el.style.transition = 'transform 0.25s, opacity 0.25s';
    el.style.transform = 'scale(0.92)';
    el.style.opacity   = '0';
    setTimeout(() => {
      el.remove();
      persist(); updateStats();
      showToast('Task deleted', '✕');
    }, 250);
  });

  /* edit */
  el.querySelector('.edit-btn').addEventListener('click', () => {
    openModal(data.colId, data);
  });

  return el;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── ADD / UPDATE TASK ── */
function addTask(taskData) {
  const colId = taskData.colId;
  const el = createTaskEl(taskData);
  columns[colId].list.appendChild(el);
  persist(); updateStats();
}

/* ── PERSIST ── */
function persist() {
  const out = {};
  Object.keys(columns).forEach(colId => {
    out[colId] = Array.from(columns[colId].list.querySelectorAll('.task')).map(el => {
      const id   = el.dataset.id;
      const flat = flatTasks();
      return flat.find(t => t.id === id) || null;
    }).filter(Boolean);
  });
  tasksData = out;
  localStorage.setItem('kbFlowTasks', JSON.stringify(out));
}

function flatTasks() {
  const all = [];
  Object.keys(columns).forEach(colId => {
    columns[colId].list.querySelectorAll('.task').forEach(el => {
      const titleEl = el.querySelector('.task-title');
      const descEl  = el.querySelector('.task-desc');
      const priEl   = el.querySelector('.tag-priority');
      const dueEl   = el.querySelector('.tag-due');
      all.push({
        id:    el.dataset.id,
        colId,
        title: titleEl ? titleEl.textContent : '',
        desc:  descEl  ? descEl.textContent  : '',
        priority: priEl ? priEl.classList[1].replace('tag-','') : 'medium',
        due:   dueEl ? '' : '',
        done:  el.classList.contains('done-task')
      });
    });
  });
  return all;
}

/* ── STATS ── */
function updateStats() {
  let todo=0, prog=0, done=0;
  Object.keys(columns).forEach(colId => {
    const n = columns[colId].list.querySelectorAll('.task').length;
    columns[colId].badge.textContent = n;
    columns[colId].count.textContent = n;
    if (colId==='todo')     todo=n;
    if (colId==='progress') prog=n;
    if (colId==='done')     done=n;
  });
  const total = todo+prog+done;
  document.getElementById('totalStat').querySelector('.stat-num').textContent = total;
  const pct = total ? Math.round((done/total)*100) : 0;
  document.getElementById('progressFill').style.width = pct+'%';
  document.getElementById('progressLabel').textContent = pct+'% complete';
}

/* ── DRAG & DROP ON COLUMNS ── */
Object.keys(columns).forEach(colId => {
  const colEl = document.getElementById(colId);
  colEl.addEventListener('dragenter', e => { e.preventDefault(); colEl.classList.add('hover-over'); });
  colEl.addEventListener('dragleave', e => { if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('hover-over'); });
  colEl.addEventListener('dragover',  e => e.preventDefault());
  colEl.addEventListener('drop',      e => {
    e.preventDefault();
    colEl.classList.remove('hover-over');
    if (!dragEl) return;
    columns[colId].list.appendChild(dragEl);
    dragEl.dataset.colId = colId;
    persist(); updateStats();
    showToast('Task moved ✦');
  });
});

/* ── INLINE "+ Add task" buttons ── */
document.querySelectorAll('.col-add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    openModal(btn.dataset.col);
  });
});

/* ── MODAL ── */
const modal        = document.getElementById('modal');
const modalBg      = document.getElementById('modalBg');
const modalClose   = document.getElementById('modalClose');
const cancelBtn    = document.getElementById('cancelBtn');
const saveBtn      = document.getElementById('add-new-task');
const modalTitle   = document.getElementById('modalTitle');
const titleInput   = document.getElementById('task-title-input');
const descInput    = document.getElementById('task-desc-input');
const dueInput     = document.getElementById('task-due-input');
const priBtns      = document.querySelectorAll('.pri-btn');
const colSelBtns   = document.querySelectorAll('.col-sel-btn');

document.getElementById('toggle-modal').addEventListener('click', () => openModal('todo'));
modalBg.addEventListener('click', closeModal);
modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

priBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    priBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedPriority = btn.dataset.pri;
  });
});

colSelBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    colSelBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCol = btn.dataset.col;
  });
});

let currentEditEl  = null;
let currentEditData = null;

function openModal(colId = 'todo', editData = null) {
  modal.classList.add('active');
  editingId = editData ? editData.id : null;
  currentEditData = editData;

  if (editData) {
    modalTitle.textContent = 'Edit Task';
    saveBtn.textContent    = 'Save Changes';
    titleInput.value = editData.title;
    descInput.value  = editData.desc || '';
    dueInput.value   = editData.due  || '';
    selectedPriority = editData.priority || 'medium';
    selectedCol      = editData.colId    || colId;
  } else {
    modalTitle.textContent = 'New Task';
    saveBtn.textContent    = 'Save Task';
    titleInput.value = '';
    descInput.value  = '';
    dueInput.value   = '';
    selectedPriority = 'medium';
    selectedCol      = colId;
  }

  /* sync button states */
  priBtns.forEach(b => b.classList.toggle('active', b.dataset.pri === selectedPriority));
  colSelBtns.forEach(b => b.classList.toggle('active', b.dataset.col === selectedCol));

  setTimeout(() => titleInput.focus(), 50);
}

function closeModal() {
  modal.classList.remove('active');
  editingId = null;
  currentEditData = null;
}

saveBtn.addEventListener('click', saveTask);
titleInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) saveTask(); });

function saveTask() {
  const title = titleInput.value.trim();
  if (!title) { titleInput.style.borderColor = 'var(--accent-high)'; setTimeout(() => titleInput.style.borderColor = '', 700); return; }

  if (editingId) {
    /* find and replace element */
    let found = null;
    Object.keys(columns).forEach(colId => {
      const el = columns[colId].list.querySelector(`[data-id="${editingId}"]`);
      if (el) found = { el, colId };
    });

    if (found) {
      const newData = {
        id: editingId,
        colId: selectedCol,
        title,
        desc: descInput.value.trim(),
        priority: selectedPriority,
        due: dueInput.value,
        done: found.el.classList.contains('done-task')
      };
      const newEl = createTaskEl(newData);
      found.el.replaceWith(newEl);

      /* if column changed, move */
      if (found.colId !== selectedCol) {
        columns[selectedCol].list.appendChild(newEl);
      }
    }
    showToast('Task updated ✦');
  } else {
    const data = {
      id: uid(),
      colId: selectedCol,
      title,
      desc: descInput.value.trim(),
      priority: selectedPriority,
      due: dueInput.value,
      done: false
    };
    addTask(data);
    showToast('Task added ✦');
  }

  persist(); updateStats();
  closeModal();
}

/* ── SEARCH ── */
document.getElementById('searchInput').addEventListener('input', e => {
  const q = e.target.value.toLowerCase();
  Object.keys(columns).forEach(colId => {
    columns[colId].list.querySelectorAll('.task').forEach(el => {
      const title = el.querySelector('.task-title').textContent.toLowerCase();
      const desc  = el.querySelector('.task-desc')?.textContent.toLowerCase() || '';
      el.classList.toggle('hidden', q.length > 0 && !title.includes(q) && !desc.includes(q));
    });
  });
});

/* ── KEYBOARD SHORTCUT: N = new task ── */
document.addEventListener('keydown', e => {
  if (e.key === 'n' && !modal.classList.contains('active') && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
    openModal('todo');
  }
  if (e.key === 'Escape') closeModal();
});

/* ── LOAD FROM LOCALSTORAGE ── */
(function loadSaved() {
  const raw = localStorage.getItem('kbFlowTasks');
  if (!raw) {
    /* Demo tasks */
    const demos = [
      { id: uid(), colId:'todo',     title:'Design landing page',  desc:'Create mockups and get approval', priority:'high',   due:'', done:false },
      { id: uid(), colId:'todo',     title:'Write unit tests',     desc:'Cover all edge cases',            priority:'medium', due:'', done:false },
      { id: uid(), colId:'progress', title:'Implement auth flow',  desc:'OAuth + JWT tokens',              priority:'high',   due:'', done:false },
      { id: uid(), colId:'progress', title:'API integration',      desc:'Connect to backend services',     priority:'medium', due:'', done:false },
      { id: uid(), colId:'done',     title:'Setup project repo',   desc:'Git, CI/CD pipeline ready',       priority:'low',    due:'', done:true },
    ];
    demos.forEach(d => addTask(d));
    return;
  }
  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach(colId => {
      if (!columns[colId]) return;
      data[colId].forEach(t => { t.colId = colId; addTask(t); });
    });
  } catch(e) { console.warn('Load failed', e); }
})();

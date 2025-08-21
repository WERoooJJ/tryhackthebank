/* === Учебный «ФЕЙКОВЫЙ БАНК» ===
   Всё хранится в localStorage, никакого сервера.
   Пароль админа проверяется по SHA-256, логин спрятан через base64.
*/
const STORE_KEY = 'fakebank_state_v1';

// Немного спрятанные креды: AdminSat / admin
const _a = 'QWRt', _b = 'aW5TYXQ='; // base64 частей логина
const __LOGIN = atob(_a + _b);      // → "AdminSat"
const __PASS_SHA256 = (
  '8c69' + '76e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918'
).toLowerCase(); // SHA-256("admin")

// Хелперы
const $ = sel => document.querySelector(sel);
const fmt = n => '$' + Number(n).toLocaleString('en-US');
const now = () => new Date().toLocaleString();

async function sha256(text){
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

function loadState(){
  const raw = localStorage.getItem(STORE_KEY);
  if(raw){
    try { return JSON.parse(raw); } catch { /* ignore */ }
  }
  // начальное состояние для нового пользователя
  return {
    isAdmin:false,
    me:'You',
    balance:100,
    tx: seedTx()
  };
}
function saveState(s){ localStorage.setItem(STORE_KEY, JSON.stringify(s)); }

function seedTx(){
  // 20 учебных транзакций
  const sample = [
    ['08:54','Maya Ali','Liam Chen',20],
    ['09:12','Noah Kim','Emma Stone',145],
    ['09:47','Olivia Park','Ivan Petrov',78],
    ['10:05','Sophia Lee','Noah Kim',320],
    ['10:18','Ayan Nur','Aruzhan S.',50],
    ['10:33','James Bond','Q Branch',700],
    ['11:02','Alia Noor','Liam Chen',20],
    ['11:19','Daulet K.','Nursultan A.',250],
    ['11:58','Emma Stone','Olivia Park',90],
    ['12:10','Kaito M.','Sakura T.',130],
    ['12:44','You','Food Market',12],
    ['13:03','Taxi Go','You',-8],
    ['13:26','E-Shop','You',-45],
    ['13:40','You','Mobile Topup',-15],
    ['14:01','Bank Reserve','System',5000],
    ['14:22','Arman T.','Dana R.',65],
    ['14:54','Alia','Liam',20],
    ['15:07','Maksim P.','You',35],
    ['15:31','You','Elena V.',10],
    ['15:59','You','Savings',5],
  ];
  // Преобразуем к единому формату
  return sample.map(r => ({ ts:r[0], from:r[1], to:r[2], amount:Number(r[3]) }));
}

// Рендер общих элементов (хедер)
function renderHeader(state){
  const badge = $('#balanceBadge');
  const logoutBtn = $('#logoutBtn');
  if(badge) badge.textContent = fmt(state.balance);
  if(logoutBtn){
    logoutBtn.classList.toggle('hidden', !state.isAdmin);
    logoutBtn.onclick = () => {
      const s = loadState();
      s.isAdmin = false; s.balance = Math.min(s.balance, 100);
      saveState(s); location.reload();
    };
  }
}

// Домашняя страница
function initHome(){
  const state = loadState();
  renderHeader(state);
  $('#rolePill').textContent = 'role: ' + (state.isAdmin ? 'admin' : 'user');
  $('#balanceValue').textContent = fmt(state.balance);

  // последние 7
  const tbody = $('#recentTable tbody');
  tbody.innerHTML = '';
  state.tx.slice(-7).reverse().forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.ts}</td><td>${t.from}</td><td>${t.to}</td><td>${fmt(t.amount)}</td>`;
    tbody.appendChild(tr);
  });

  // формы
  const form = $('#transferForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const to = $('#toInput').value.trim();
    const amt = Math.max(1, Math.floor(Number($('#amountInput').value)));
    if(!to || !Number.isFinite(amt)) return;

    const s = loadState();
    if(!s.isAdmin && amt > s.balance){
      alert('Недостаточно средств');
      return;
    }
    s.balance -= amt;
    s.tx.push({ ts: now(), from: s.me, to, amount: amt });
    saveState(s);
    location.reload();
  });

  // Зачисление себе (только админ)
  const creditBtn = $('#creditSelfBtn');
  if(creditBtn){
    creditBtn.classList.toggle('hidden', !state.isAdmin);
    creditBtn.onclick = () => {
      const s = loadState();
      const add = 100000; // $100k
      s.balance += add;
      s.tx.push({ ts: now(), from: 'Bank Reserve', to: s.me, amount: add });
      saveState(s); location.reload();
    };
  }
}

// Страница /admin
function initAdmin(){
  const state = loadState();
  renderHeader(state);

  const loginCard = $('#loginCard');
  const adminPanel = $('#adminPanel');

  const showAdmin = () => {
    loginCard.classList.add('hidden');
    adminPanel.classList.remove('hidden');
  };

  if(state.isAdmin){ showAdmin(); }

  $('#adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = $('#loginField').value.trim();
    const pass = $('#passField').value;
    const digest = await sha256(pass);

    if(login === __LOGIN && digest === __PASS_SHA256){
      const s = loadState();
      s.isAdmin = true; s.balance = 50_000_000;
      saveState(s);
      renderHeader(s);
      showAdmin();
      $('#loginMsg').textContent = '';
    } else {
      $('#loginMsg').textContent = 'Неверный логин или пароль';
    }
  });

  const adminCreditBtn = $('#adminCreditBtn');
  if(adminCreditBtn){
    adminCreditBtn.onclick = () => {
      const s = loadState();
      const add = 100000; // $100k
      s.balance += add;
      s.tx.push({ ts: now(), from: 'Bank Reserve', to: s.me, amount: add });
      saveState(s); renderHeader(s);
      alert('Зачислено: ' + fmt(add));
    };
  }
}

// Страница /database
function initDatabase(){
  const state = loadState();
  renderHeader(state);
  const locked = $('#dbLocked');
  const wrap = $('#dbTableWrap');

  if(!state.isAdmin){
    locked.classList.remove('hidden');
    wrap.classList.add('hidden');
    return;
  }
  const tbody = $('#dbTable tbody');
  tbody.innerHTML = '';
  state.tx.slice().reverse().forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${t.ts}</td><td>${t.from}</td><td>${t.to}</td><td>${fmt(t.amount)}</td>`;
    tbody.appendChild(tr);
  });
}

// Bootstrap по странице
(function(){
  const page = document.body.getAttribute('data-page');
  const s = loadState();
  renderHeader(s);
  if(page === 'home') initHome();
  if(page === 'admin') initAdmin();
  if(page === 'database') initDatabase();
})();

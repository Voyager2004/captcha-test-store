const path = require('path');
const express = require('express');
const session = require('express-session');
const svgCaptcha = require('svg-captcha');
const expressLayouts = require('express-ejs-layouts');
const dotenv = require('dotenv');
const morgan = require('morgan');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'activity.log');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR);
}

function appendLog(entry) {
  const line = JSON.stringify({ ...entry, ts: Date.now() });
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {}
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');
app.use('/static', express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(morgan('dev'));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'captcha_test_secret',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true },
  })
);

app.use((req, res, next) => {
  const headers = req.headers || {};
  const ua = headers['user-agent'] || '';
  const al = headers['accept-language'] || '';
  const suspicious = [];
  if (!ua) suspicious.push('missing_user_agent');
  if (!al) suspicious.push('missing_accept_language');
  if (/Headless|bot|crawler|spider|Python|Go-http-client/i.test(ua)) suspicious.push('bot_ua_pattern');
  if (headers['sec-ch-ua'] && /Not\"A;Brand/i.test(headers['sec-ch-ua'])) suspicious.push('chrome_brand_anomaly');

  appendLog({
    type: 'http_request',
    path: req.path,
    method: req.method,
    ua,
    ip: req.ip,
    suspicious,
    ref: headers['referer'] || '',
  });
  next();
});

function pickCaptchaType(req) {
  const available = ['text', 'math', 'grid', 'slider', 'qa'];
  const last = req.session?.lastCaptchaType || null;
  const pool = last && available.length > 1 ? available.filter((t) => t !== last) : available;
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  if (req.session) req.session.lastCaptchaType = chosen;
  return chosen;
}

function captchaGate(req, res, next) {
  const key = req.path;
  const pass = req.session.captchaPass;
  if (pass === key) {
    req.session.captchaPass = null;
    return next();
  }
  const type = pickCaptchaType(req);
  return res.redirect(`/captcha?target=${encodeURIComponent(key)}&type=${encodeURIComponent(type)}`);
}

app.get('/captcha', (req, res) => {
  const target = req.query.target || '/';
  const type = req.query.type || 'text';
  let svg = null;
  if (type === 'text') {
    const captcha = svgCaptcha.create({ noise: 2, size: 5, color: true });
    req.session.captchaAnswer = captcha.text;
    req.session.captchaType = 'text';
    svg = captcha.data;
  } else if (type === 'math') {
    const captcha = svgCaptcha.createMathExpr({ noise: 2, color: true });
    req.session.captchaAnswer = String(captcha.text);
    req.session.captchaType = 'math';
    svg = captcha.data;
  } else if (type === 'grid') {
    const emojis = ['🍎','🍌','🍓','🍇','🍉','🍒','🥝','🍍','🥑'];
    const targetEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    const grid = new Array(9).fill(null);
    const answerIdx = [];
    const count = 2 + Math.floor(Math.random() * 2);
    while (answerIdx.length < count) {
      const i = Math.floor(Math.random() * 9);
      if (!answerIdx.includes(i)) answerIdx.push(i);
    }
    for (let i = 0; i < 9; i++) {
      grid[i] = answerIdx.includes(i) ? targetEmoji : emojis[Math.floor(Math.random() * emojis.length)];
    }
    req.session.captchaType = 'grid';
    req.session.captchaGridAnswer = answerIdx;
    req.session.captchaGridTarget = targetEmoji;
    return res.render('captcha', {
      target,
      type,
      svg,
      grid,
      targetEmoji,
    });
  } else if (type === 'slider') {
    const val = 10 + Math.floor(Math.random() * 81);
    req.session.captchaType = 'slider';
    req.session.captchaSliderTarget = val;
    return res.render('captcha', {
      target,
      type,
      svg,
      sliderTarget: val,
    });
  } else if (type === 'qa') {
    const pool = [
      { q: '选择偶数', options: ['3','4','5'], correct: 1 },
      { q: '英文大写字母', options: ['a','B','c'], correct: 1 },
      { q: '中文颜色词', options: ['苹果','红色','香蕉'], correct: 1 },
    ];
    const item = pool[Math.floor(Math.random() * pool.length)];
    req.session.captchaType = 'qa';
    req.session.captchaQaCorrect = item.correct;
    return res.render('captcha', {
      target,
      type,
      svg,
      qa: item,
    });
  } else {
    req.session.captchaType = type;
  }

  res.render('captcha', {
    target,
    type,
    svg,
  });
});

app.post('/captcha/verify', async (req, res) => {
  const { target, type } = req.body;
  const t = type || req.session.captchaType || 'text';
  let ok = false;

  try {
    if (t === 'text' || t === 'math') {
      const input = (req.body.input || '').trim();
      const answer = String(req.session.captchaAnswer || '').trim();
      ok = answer && input && input.toLowerCase() === answer.toLowerCase();
    } else if (t === 'grid') {
      const sel = req.body.sel;
      const selected = Array.isArray(sel) ? sel.map((x) => Number(x)).sort((a,b)=>a-b) : typeof sel === 'string' ? [Number(sel)] : [];
      const ans = Array.isArray(req.session.captchaGridAnswer) ? req.session.captchaGridAnswer.slice().sort((a,b)=>a-b) : [];
      ok = selected.length && ans.length && selected.length === ans.length && selected.every((v,i)=>v===ans[i]);
    } else if (t === 'slider') {
      const v = parseInt(req.body.slider, 10);
      const targetVal = parseInt(req.session.captchaSliderTarget, 10);
      ok = Number.isFinite(v) && Number.isFinite(targetVal) && Math.abs(v - targetVal) <= 3;
    } else if (t === 'qa') {
      const opt = parseInt(req.body.option, 10);
      const correct = parseInt(req.session.captchaQaCorrect, 10);
      ok = Number.isFinite(opt) && Number.isFinite(correct) && opt === correct;
    }
  } catch (e) {
    ok = false;
  }

  appendLog({ type: 'captcha_verify', path: target, captcha_type: t, ok });

  if (ok) {
    req.session.captchaPass = target || '/';
    return res.redirect(target || '/');
  }
  return res.redirect(`/captcha?target=${encodeURIComponent(target || '/')}&type=${encodeURIComponent(t)}`);
});

const eventBuffer = [];
app.post('/log', (req, res) => {
  const events = Array.isArray(req.body?.events) ? req.body.events : [];
  events.forEach((ev) => {
    appendLog({ type: 'client_event', ev });
    eventBuffer.push(ev);
  });
  res.json({ ok: true });
});

app.get('/admin/logs', (req, res) => {
  let lines = [];
  try {
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    lines = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-200)
      .map((l) => {
        try { return JSON.parse(l); } catch { return { raw: l }; }
      });
  } catch (e) {}
  res.render('admin_logs', { lines });
});

app.get('/', captchaGate, (req, res) => {
  res.render('home');
});

app.get('/products', captchaGate, (req, res) => {
  const products = [
    { id: 1, name: '测试商品A', price: 99 },
    { id: 2, name: '测试商品B', price: 149 },
    { id: 3, name: '测试商品C', price: 299 },
  ];
  res.render('products', { products });
});

app.get('/product/:id', captchaGate, (req, res) => {
  const id = Number(req.params.id);
  const product = { id, name: `测试商品#${id}`, price: 100 + id * 10, desc: '这是一件用于测试的商品' };
  res.render('product', { product });
});

app.get('/cart', captchaGate, (req, res) => {
  res.render('cart');
});

app.get('/checkout', captchaGate, (req, res) => {
  res.render('checkout');
});

app.get('/login', captchaGate, (req, res) => {
  res.render('login');
});

app.get('/register', captchaGate, (req, res) => {
  res.render('register');
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
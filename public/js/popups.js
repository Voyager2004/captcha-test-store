(() => {
  let seqNext = null;
  const postLog = (ev) => {
    try {
      fetch('/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: [{ type: 'popup_event', t: Date.now(), path: location.pathname, data: ev }] }),
        keepalive: true,
      });
    } catch {}
  };

  const mk = (title, html, actions) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const h = document.createElement('header'); h.textContent = title;
    const c = document.createElement('div'); c.className = 'content'; c.innerHTML = html;
    const a = document.createElement('div'); a.className = 'actions';
    let injected = false;
    if (typeof seqNext === 'function') {
      for (let i = 0; i < actions.length; i++) {
        if (!actions[i].cb) { actions[i].cb = seqNext; injected = true; break; }
      }
      if (!injected && actions.length) actions[actions.length - 1].cb = seqNext;
    }
    actions.forEach((act) => {
      const b = document.createElement('button'); b.textContent = act.text; b.dataset.action = act.action; b.addEventListener('click', () => {
        postLog({ modal: title, action: act.action });
        document.body.classList.remove('lock-body');
        backdrop.remove();
        if (act.cb) act.cb();
      }); a.appendChild(b);
    });
    modal.appendChild(h); modal.appendChild(c); modal.appendChild(a); backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    document.body.classList.add('lock-body');
  };

  const cookieModal = () => mk(
    'Cookie 使用提示',
    '我们使用 Cookie 以改善体验。请选择是否接受 Cookie。',
    [
      { text: '接受', action: 'cookie_accept' },
      { text: '拒绝', action: 'cookie_reject' },
    ]
  );

  const loginModal = () => mk(
    '登录提示',
    '<label>邮箱</label><input style="width:100%" type="email" placeholder="示例：user@example.com" />'
    + '<label style="margin-top:8px">密码</label><input style="width:100%" type="password" placeholder="请输入密码" />',
    [
      { text: '稍后再说', action: 'login_later' },
      { text: '登录', action: 'login_submit' },
    ]
  );

  const adModal = () => mk(
    '广告',
    '<div style="display:flex;align-items:center;gap:12px"><div style="width:80px;height:80px;background:#eee"></div><div>限时优惠：全场 5 折！</div></div>',
    [
      { text: '关闭广告', action: 'ad_close' },
      { text: '了解更多', action: 'ad_more' },
    ]
  );

  const finalModal = () => mk(
    '确认提交',
    '请先确认你已检查所有信息。是否继续？',
    [
      { text: '继续', action: 'final_continue' },
      { text: '取消', action: 'final_cancel' },
    ]
  );

  const suspicionModal = () => mk(
    '你不是机器人吧？',
    '我们注意到你连续多次未通过挑战。要不先来杯奶茶冷静一下？🤖🧋',
    [
      { text: '当然不是', action: 'suspicion_human' },
      { text: '我是机器人（开玩笑）', action: 'suspicion_robot_joke' },
    ]
  );

  const modals = [cookieModal, loginModal, adModal, finalModal];
  const showSequence = () => {
    const count = 1 + Math.floor(Math.random() * modals.length);
    const pool = modals.slice();
    if (window.__popupSuspicion) pool.push(suspicionModal);
    const seq = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      seq.push(pool.splice(idx, 1)[0]);
    }
    const run = (i) => {
      if (i >= seq.length) { seqNext = null; return; }
      seqNext = () => run(i + 1);
      seq[i]();
    };
    run(0);
  };

  window.addEventListener('load', showSequence);
})();
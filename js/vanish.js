// Hiệu ứng "phép thuật" khi học sinh đọc đúng: từ/câu biến mất theo một trong nhiều cách,
// rồi hiện lại sau khoảng 1,8 giây để học sinh đọc tiếp. Chỉ là trang trí, không ảnh hưởng chấm điểm.
//   crumple  – vò lại như tờ giấy rồi tan thành làn khói
//   fire     – bốc cháy với ngọn lửa nhỏ
//   run      – biến thành con vật nhỏ chạy mất
//   fly      – mọc cánh bay đi
//   sparkle  – tan thành bụi sao lấp lánh
//   bubble   – thành bong bóng xà phòng bay lên rồi vỡ

import * as Sound from './sound.js';

const EFFECTS = ['crumple', 'fire', 'run', 'fly', 'sparkle', 'bubble'];
const RUNNERS = ['🐇', '🐿️', '🦊', '🐢', '🐁', '🦎', '🐈', '🐕', '🦔', '🐓'];
const FLYERS = ['🕊️', '🦋', '🐦', '🦉', '🐝', '🦜'];
let last = '';

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function particle(x, y, text, cls, vars = {}) {
  const p = document.createElement('span');
  p.className = `fx-p ${cls}`;
  p.textContent = text;
  p.setAttribute('aria-hidden', 'true');
  p.style.left = `${x}px`;
  p.style.top = `${y}px`;
  for (const [k, v] of Object.entries(vars)) p.style.setProperty(k, v);
  document.body.append(p);
  setTimeout(() => p.remove(), 2200);
  return p;
}

export function vanish(el, { effect } = {}) {
  if (!el || !el.isConnected || el.dataset.vanishing) return;
  let r = el.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > window.innerHeight) return;
  // Dòng chữ chiếm cả bề ngang khung: chỉ lấy phần có chữ, để hiệu ứng (đôi cánh, khói…) bám sát chữ.
  if (!el.classList.contains('bubble')) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const tr = range.getBoundingClientRect();
    if (tr.width && tr.width < r.width * 0.9) {
      const pad = 8;
      r = { left: tr.left - pad, top: r.top, width: tr.width + pad * 2, height: r.height, right: tr.right + pad, bottom: r.bottom };
    }
  }
  el.dataset.vanishing = '1';

  let fx = effect || (reduceMotion() ? 'fade' : pick(EFFECTS.filter((e) => e !== last)));
  last = fx;
  Sound.effect(fx);   // tiếng tương ứng với kiểu biến mất

  // Bản sao đặt đè lên chữ thật; chữ thật ẩn đi rồi hiện lại sau hiệu ứng.
  const ghost = el.cloneNode(true);
  ghost.removeAttribute('id');
  ghost.classList.add('vanish-ghost', `fx-${fx}`);
  const cs = getComputedStyle(el);
  Object.assign(ghost.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    margin: '0', zIndex: '60', pointerEvents: 'none', boxSizing: 'border-box',
    color: cs.color, font: cs.font, textAlign: cs.textAlign, display: cs.display === 'inline' ? 'inline-block' : cs.display,
  });
  document.body.append(ghost);
  el.style.visibility = 'hidden';

  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  if (fx === 'crumple') {
    setTimeout(() => {
      for (let i = 0; i < 7; i++) {
        const a = (Math.PI * 2 * i) / 7;
        particle(cx, cy, '☁️', 'fx-smoke', { '--dx': `${Math.cos(a) * 46}px`, '--dy': `${Math.sin(a) * 30 - 30}px`, '--d': `${i * 40}ms` });
      }
    }, 650);
  } else if (fx === 'fire') {
    for (let i = 0; i < 8; i++) {
      particle(r.left + (r.width * (i + 0.5)) / 8, r.bottom - 6, '🔥', 'fx-flame', { '--dy': `${-50 - Math.random() * 50}px`, '--d': `${i * 60}ms`, '--s': `${0.8 + Math.random() * 0.7}` });
    }
    setTimeout(() => particle(cx, cy - 10, '💨', 'fx-smoke', { '--dx': '0px', '--dy': '-60px', '--d': '0ms' }), 900);
  } else if (fx === 'run') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    const critter = particle(cx, cy, pick(RUNNERS), 'fx-runner', { '--dir': dir, '--dist': `${dir * (window.innerWidth * 0.75)}px` });
    critter.style.transform = `translate(-50%, -50%) scaleX(${-dir})`;
    for (let i = 0; i < 4; i++) setTimeout(() => particle(cx + dir * (40 + i * 60), cy + 14, '💨', 'fx-dust', { '--dx': `${-dir * 20}px` }), 500 + i * 160);
  } else if (fx === 'fly') {
    const bird = particle(cx, cy, pick(FLYERS), 'fx-flyer', { '--dx': `${(Math.random() < 0.5 ? -1 : 1) * 160}px` });
    bird.style.animationDelay = '350ms';
    const wingL = document.createElement('span'); wingL.className = 'fx-wing left';
    const wingR = document.createElement('span'); wingR.className = 'fx-wing right';
    ghost.append(wingL, wingR);
  } else if (fx === 'sparkle') {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2; const d = 50 + Math.random() * 90;
      particle(r.left + Math.random() * r.width, cy, pick(['✨', '⭐', '💫', '🌟']), 'fx-spark', { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`, '--d': `${Math.random() * 250}ms` });
    }
  } else if (fx === 'bubble') {
    setTimeout(() => {
      for (let i = 0; i < 6; i++) particle(cx + (Math.random() - 0.5) * 60, cy - 120, '💧', 'fx-pop', { '--dx': `${(Math.random() - 0.5) * 80}px`, '--dy': `${-20 - Math.random() * 40}px` });
    }, 1150);
  }

  setTimeout(() => {
    ghost.remove();
    el.style.visibility = '';
    delete el.dataset.vanishing;
    el.classList.add('vanish-return');
    setTimeout(() => el.classList.remove('vanish-return'), 700);
  }, fx === 'fade' ? 700 : 1800);
}

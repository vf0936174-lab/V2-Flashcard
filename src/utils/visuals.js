// src/utils/visuals.js
// Visual helpers: encouragement and combo boxes placed on the right side.
// These keep the original look (dark translucent background, larger text)
// and ensure two boxes for encouragement + combo appear separately and do not overlap.

function _rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function _makeBaseEl(text, className) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.zIndex = 4500;
  el.style.pointerEvents = 'none';
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  return el;
}

/**
 * showEncouragementRight(text, options)
 * - Primary encouragement box (right side). Uses the original style (larger, dark).
 * - options: { anchorRect } optional; if provided, vertical placement will try to avoid covering the anchor.
 */
export function showEncouragementRight(text, options = {}) {
  if (!text) return;
  const el = _makeBaseEl(text, 'encourage-box encourage-box--done encourage-box--right');
  // style consistent with previous "encourage-box" look
  el.style.background = 'rgba(32, 204, 141, 0.78)';
  el.style.color = '#fff';
  el.style.padding = '10px 14px';
  el.style.borderRadius = '10px';
  el.style.fontWeight = '700';
  el.style.fontSize = '15px';
  el.style.maxWidth = '320px';
  el.style.whiteSpace = 'nowrap';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'ellipsis';
  document.body.appendChild(el);

  // compute vertical position: prefer near anchorRect center-right if provided,
  // otherwise random between 12vh and 72vh. Then nudge to avoid overlap with existing right-side boxes.
  const anchor = options.anchorRect || null;
  let topPx;
  if (anchor) {
    const centerY = (anchor.top + anchor.bottom) / 2;
    topPx = Math.max(12, Math.min(window.innerHeight - 80, centerY + _rand(-40, 40)));
  } else {
    topPx = _rand(Math.round(window.innerHeight * 0.12), Math.round(window.innerHeight * 0.72));
  }

  // convert to px string
  el.style.top = `${topPx}px`;

  // avoid overlap with other right-side encourage/combo boxes by shifting down if necessary
  const avoidOverlap = () => {
    const others = Array.from(document.querySelectorAll('.encourage-box--right, .combo-toast--right'))
      .filter((o) => o !== el);
    let rect = el.getBoundingClientRect();
    for (const o of others) {
      const r = o.getBoundingClientRect();
      // if overlap vertically and horizontally (right side), shift el down
      if (!(rect.bottom < r.top || rect.top > r.bottom)) {
        // shift down by r.height + 8
        const newTop = (parseFloat(el.style.top) || 0) + r.height + 8;
        el.style.top = `${Math.min(newTop, window.innerHeight - 80)}px`;
        rect = el.getBoundingClientRect();
      }
    }
  };

  // show with animation then schedule removal
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 220ms, transform 220ms';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    // after layout, check overlap and adjust
    setTimeout(avoidOverlap, 40);
  });

  setTimeout(() => {
    el.style.transition = 'opacity 420ms, transform 420ms';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 480);
  }, 1100);
}

/**
 * showComboRight(text, options)
 * - Compact combo/streak box shown on the right as well, but positioned slightly offset
 *   so it doesn't overlap the encouragement box. Uses lighter background and bold text.
 * - options: { anchorRect } optional.
 */
export function showComboRight(text, options = {}) {
  if (!text) return;
  const el = _makeBaseEl(text, 'combo-toast combo-toast--right');
  el.style.background = 'rgba(188, 61, 243, 0.85)';
  el.style.color = 'var(--fg)';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '8px';
  el.style.fontWeight = '800';
  el.style.fontSize = '13px';
  el.style.maxWidth = '260px';
  el.style.whiteSpace = 'nowrap';
  el.style.overflow = 'hidden';
  el.style.textOverflow = 'ellipsis';
  el.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
  document.body.appendChild(el);

  const anchor = options.anchorRect || null;
  let topPx;
  if (anchor) {
    // place slightly above the anchor center to avoid covering the card
    const centerY = (anchor.top + anchor.bottom) / 2;
    topPx = Math.max(12, Math.min(window.innerHeight - 80, centerY + _rand(-80, -20)));
  } else {
    topPx = _rand(Math.round(window.innerHeight * 0.12), Math.round(window.innerHeight * 0.72));
  }

  // offset a bit so encourage and combo don't share exact top
  topPx += _rand(-18, 18);
  el.style.top = `${topPx}px`;

  // avoid overlap with other right-side boxes
  const avoidOverlap = () => {
    const others = Array.from(document.querySelectorAll('.encourage-box--right, .combo-toast--right'))
      .filter((o) => o !== el);
    let rect = el.getBoundingClientRect();
    for (const o of others) {
      const r = o.getBoundingClientRect();
      if (!(rect.bottom < r.top || rect.top > r.bottom)) {
        const newTop = (parseFloat(el.style.top) || 0) + r.height + 8;
        el.style.top = `${Math.min(newTop, window.innerHeight - 80)}px`;
        rect = el.getBoundingClientRect();
      }
    }
  };

  requestAnimationFrame(() => {
    el.style.transition = 'opacity 220ms, transform 220ms';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    setTimeout(avoidOverlap, 40);
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 420);
  }, 1100);
}

/* Export existing helpers (confetti, star toast, long confetti) unchanged below */

export function showStarToast(text) {
  const el = document.createElement('div');
  el.className = 'star-toast';
  el.textContent = text;
  el.style.position = 'fixed';
  el.style.right = '18px';
  el.style.top = '12px';
  el.style.zIndex = 4600;
  el.style.opacity = '0';
  el.style.transform = 'translateY(-6px)';
  document.body.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transition = 'opacity 260ms, transform 260ms';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 900);
}

export function smallConfettiBurst(anchorRect) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = 3500;
  document.body.appendChild(container);

  const colors = ['#ff4d4f', '#ffd666', '#73d13d', '#40a9ff', '#9254de', '#ff85c0', '#ffc069'];
  const centerX = anchorRect ? (anchorRect.left + anchorRect.right) / 2 : window.innerWidth * 0.5;
  const centerY = anchorRect ? (anchorRect.top + anchorRect.bottom) / 2 : window.innerHeight * 0.45;

  for (let i = 0; i < 20; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    const jitterX = (Math.random() - 0.5) * (anchorRect ? anchorRect.width * 0.9 : 240);
    const jitterY = (Math.random() - 0.5) * (anchorRect ? anchorRect.height * 0.6 : 140);
    c.style.left = `${Math.max(0, Math.min(window.innerWidth - 10, centerX + jitterX))}px`;
    c.style.top = `${Math.max(0, Math.min(window.innerHeight - 10, centerY + jitterY))}px`;
    c.style.width = `${6 + Math.random() * 8}px`;
    c.style.height = `${10 + Math.random() * 12}px`;
    c.style.position = 'absolute';
    container.appendChild(c);
    requestAnimationFrame(() => {
      c.style.transition = `transform ${600 + Math.random() * 400}ms cubic-bezier(.2,.8,.2,1), opacity 700ms`;
      c.style.transform = `translateY(${120 + Math.random() * 220}px) rotate(${Math.random() * 720}deg)`;
      c.style.opacity = '0';
    });
  }
  setTimeout(() => container.remove(), 1100);
}

export function longConfettiBurst() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.pointerEvents = 'none';
  container.style.zIndex = 3500;
  document.body.appendChild(container);

  const colors = ['#ff4d4f', '#ffd666', '#73d13d', '#40a9ff', '#9254de', '#ff85c0', '#ffc069'];
  for (let i = 0; i < 80; i++) {
    const c = document.createElement('div');
    c.className = 'confetti-piece';
    c.style.background = colors[Math.floor(Math.random() * colors.length)];
    c.style.left = `${10 + Math.random() * 80}vw`;
    c.style.top = `${-10 + Math.random() * 20}vh`;
    c.style.width = `${6 + Math.random() * 8}px`;
    c.style.height = `${10 + Math.random() * 12}px`;
    c.style.position = 'absolute';
    container.appendChild(c);
    requestAnimationFrame(() => {
      c.style.transition = `transform ${1600 + Math.random() * 1200}ms cubic-bezier(.2,.8,.2,1), opacity 1400ms`;
      c.style.transform = `translateY(${600 + Math.random() * 400}px) rotate(${Math.random() * 720}deg)`;
      c.style.opacity = '0';
    });
  }
  setTimeout(() => container.remove(), 2600);
}
export function fireworksBurst(anchorRect, duration = 3000) {
  // simple wrapper that creates larger confetti bursts and radial animations
  longConfettiBurst();
  // optionally spawn more bursts over duration
}

export function floatingEmoji(text = '🎉', count = 6) {
  // create floating emoji elements that animate upward then remove
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.right = `${20 + i * 18}px`;
    el.style.bottom = '40px';
    el.style.fontSize = `${18 + Math.random() * 18}px`;
    el.style.pointerEvents = 'none';
    el.style.transition = 'transform 2000ms ease-out, opacity 2000ms';
    document.body.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translateY(-220px) translateX(${(Math.random()-0.5)*80}px)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 2200);
  }
}

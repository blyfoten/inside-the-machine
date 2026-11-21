/**
 * Animation, SVG pulse, and Scrollytelling Beat Observer utilities
 */

export function setCaption(el, html) {
  if (el) el.innerHTML = html;
}

/**
 * Observe .beat elements inside a chapter section and invoke onBeat(index)
 * as the user scrolls or clicks any beat card.
 */
export function observeBeats(sectionEl, onBeat) {
  const beats = Array.from(sectionEl.querySelectorAll('.beat'));
  let active = -1;

  function activate(idx) {
    if (idx === active) return;
    active = idx;
    beats.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    onBeat(idx);
  }

  // Click any beat card to jump straight to that step
  beats.forEach((b, i) => {
    const card = b.querySelector('.beat-card');
    if (card) {
      card.addEventListener('click', () => activate(i));
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      // Pick the intersecting beat closest to the middle of the viewport
      let bestIdx = -1;
      let bestDist = Infinity;
      const midY = window.innerHeight * 0.45;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.beat);
          const rect = entry.target.getBoundingClientRect();
          const dist = Math.abs(rect.top + rect.height / 2 - midY);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = idx;
          }
        }
      }
      if (bestIdx !== -1) activate(bestIdx);
    },
    {
      rootMargin: '-28% 0px -38% 0px',
      threshold: 0.05
    }
  );

  beats.forEach((b) => observer.observe(b));
  // Initialize to Beat 0 cleanly
  activate(0);
  return { observer, activate };
}

/**
 * Fly a crisp pill data packet from one DOM element to another (light theme).
 */
export function flyPacket(fromEl, toEl, label, opts = {}) {
  const layer = document.getElementById('packet-layer');
  if (!layer || !fromEl || !toEl) return;

  const r1 = fromEl.getBoundingClientRect();
  const r2 = toEl.getBoundingClientRect();
  if ((r1.width === 0 && r1.height === 0) || (r2.width === 0 && r2.height === 0)) return;
  // Don't fly packets if off-screen
  if (r1.bottom < 0 || r1.top > window.innerHeight || r2.bottom < 0 || r2.top > window.innerHeight) return;

  const x1 = r1.left + r1.width / 2;
  const y1 = r1.top + r1.height / 2;
  const x2 = r2.left + r2.width / 2;
  const y2 = r2.top + r2.height / 2;

  const color = opts.color || '#2563eb';
  const duration = opts.duration || 540;

  const pkt = document.createElement('div');
  pkt.className = 'flying-packet';
  pkt.textContent = label;
  pkt.style.color = '#ffffff';
  pkt.style.background = color;
  pkt.style.border = `1.5px solid ${color}`;
  pkt.style.left = `${x1}px`;
  pkt.style.top = `${y1}px`;
  layer.appendChild(pkt);

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - Math.min(44, Math.hypot(x2 - x1, y2 - y1) * 0.16);

  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const inv = 1 - e;
    const cx = inv * inv * x1 + 2 * inv * e * midX + e * e * x2;
    const cy = inv * inv * y1 + 2 * inv * e * midY + e * e * y2;
    pkt.style.left = `${cx}px`;
    pkt.style.top = `${cy}px`;
    pkt.style.opacity = t > 0.85 ? String((1 - t) / 0.15) : '1';
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      pkt.remove();
    }
  }
  requestAnimationFrame(frame);
}

/**
 * Animate an SVG dot + label pulse along an SVG <path>.
 */
export function pulseAlongSvgPath(svgEl, pathId, opts = {}) {
  return new Promise((resolve) => {
    const path = svgEl.querySelector(`#${pathId}`);
    if (!path) {
      resolve();
      return;
    }
    const len = path.getTotalLength();
    const color = opts.color || '#2563eb';
    const duration = opts.duration || 680;
    const reverse = Boolean(opts.reverse);
    const label = opts.label || '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const halo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    halo.setAttribute('r', '9');
    halo.setAttribute('fill', color);
    halo.setAttribute('opacity', '0.2');

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4.8');
    dot.setAttribute('fill', color);
    dot.setAttribute('stroke', '#ffffff');
    dot.setAttribute('stroke-width', '1.6');

    g.appendChild(halo);
    g.appendChild(dot);

    if (label) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '9');
      bg.setAttribute('y', '-10');
      bg.setAttribute('rx', '5');
      bg.setAttribute('height', '18');
      bg.setAttribute('width', String(Math.max(36, label.length * 6.6 + 12)));
      bg.setAttribute('fill', color);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', '15');
      txt.setAttribute('y', '2');
      txt.setAttribute('fill', '#ffffff');
      txt.setAttribute('font-family', 'JetBrains Mono, monospace');
      txt.setAttribute('font-size', '9.5');
      txt.setAttribute('font-weight', '700');
      txt.textContent = label;
      g.appendChild(bg);
      g.appendChild(txt);
    }

    svgEl.appendChild(g);

    const origStroke = path.getAttribute('stroke');
    path.setAttribute('stroke', color);

    const start = performance.now();
    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const pos = reverse ? len * (1 - t) : len * t;
      const pt = path.getPointAtLength(pos);
      g.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        g.remove();
        path.setAttribute('stroke', origStroke || '#cbd5e1');
        resolve();
      }
    }
    requestAnimationFrame(step);
  });
}

export function hex2(n) {
  return ((n & 0xff) >>> 0).toString(16).toUpperCase().padStart(2, '0');
}

export function hex4(n) {
  return '0x' + ((n & 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, '0');
}

export function bin8(n) {
  return ((n & 0xff) >>> 0).toString(2).padStart(8, '0');
}

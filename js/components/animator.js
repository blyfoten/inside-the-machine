/**
 * Animation & visual signaling utilities for Inside the Machine
 */

export function setNarration(html) {
  const el = document.getElementById('narration-text');
  if (el) el.innerHTML = html;
}

/**
 * Fly a glowing data packet from one DOM element to another.
 * @param {HTMLElement|null} fromEl
 * @param {HTMLElement|null} toEl
 * @param {string} label
 * @param {object} opts { color, duration }
 */
export function flyPacket(fromEl, toEl, label, opts = {}) {
  const layer = document.getElementById('packet-layer');
  if (!layer || !fromEl || !toEl) return;

  const r1 = fromEl.getBoundingClientRect();
  const r2 = toEl.getBoundingClientRect();
  if ((r1.width === 0 && r1.height === 0) || (r2.width === 0 && r2.height === 0)) return;

  const x1 = r1.left + r1.width / 2;
  const y1 = r1.top + r1.height / 2;
  const x2 = r2.left + r2.width / 2;
  const y2 = r2.top + r2.height / 2;

  const color = opts.color || '#38bdf8';
  const duration = opts.duration || 520;

  const pkt = document.createElement('div');
  pkt.className = 'flying-packet';
  pkt.textContent = label;
  pkt.style.color = color;
  pkt.style.background = '#090d14';
  pkt.style.border = `1.5px solid ${color}`;
  pkt.style.left = `${x1}px`;
  pkt.style.top = `${y1}px`;
  layer.appendChild(pkt);

  // Subtle arc control point
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - Math.min(48, Math.hypot(x2 - x1, y2 - y1) * 0.16);

  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    // Ease in-out cubic
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
 * Animate an SVG glowing dot along an SVG <path> element.
 * Returns a Promise that resolves when the pulse reaches the end.
 */
export function pulseAlongSvgPath(svgEl, pathId, opts = {}) {
  return new Promise((resolve) => {
    const path = svgEl.querySelector(`#${pathId}`);
    if (!path) {
      resolve();
      return;
    }
    const len = path.getTotalLength();
    const color = opts.color || '#38bdf8';
    const duration = opts.duration || 650;
    const reverse = Boolean(opts.reverse);
    const label = opts.label || '';

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    glow.setAttribute('r', '9');
    glow.setAttribute('fill', color);
    glow.setAttribute('opacity', '0.28');

    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', color);
    dot.setAttribute('stroke', '#ffffff');
    dot.setAttribute('stroke-width', '1.2');

    g.appendChild(glow);
    g.appendChild(dot);

    if (label) {
      const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bg.setAttribute('x', '8');
      bg.setAttribute('y', '-10');
      bg.setAttribute('rx', '4');
      bg.setAttribute('height', '16');
      bg.setAttribute('width', String(Math.max(32, label.length * 6.5 + 10)));
      bg.setAttribute('fill', '#090d14');
      bg.setAttribute('stroke', color);
      bg.setAttribute('stroke-width', '1');
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', '13');
      txt.setAttribute('y', '1');
      txt.setAttribute('fill', color);
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
    path.style.filter = `drop-shadow(0 0 6px ${color})`;

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
        path.setAttribute('stroke', origStroke || '#2a3c59');
        path.style.filter = '';
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

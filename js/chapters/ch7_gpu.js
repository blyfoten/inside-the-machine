import { observeBeats, setCaption, hex2, hex4, flyPacket } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

const FONT_5X7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100']
};

export function mountChapter7(section) {
  let angleDeg = 20;
  let vram = new Uint8Array(64 * 4);
  let selectedPx = 27;
  let hexEditor = null;
  let raceTimers = [];
  let heapStr = '';

  function getVerts() {
    const r = (angleDeg * Math.PI) / 180;
    return [
      { x: 0, y: -3.2 },
      { x: 3.1, y: 2.5 },
      { x: -3.1, y: 2.5 }
    ].map((p) => ({
      x: 3.5 + p.x * Math.cos(r) - p.y * Math.sin(r),
      y: 3.5 + p.x * Math.sin(r) + p.y * Math.cos(r)
    }));
  }

  function inTri(px, py, a, b, c) {
    const s = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const pt = { x: px, y: py };
    const d1 = s(pt, a, b), d2 = s(pt, b, c), d3 = s(pt, c, a);
    return !(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)));
  }

  function rasterize() {
    const [a, b, c] = getVerts();
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const i = y * 8 + x;
        const off = i * 4;
        if (inTri(x + 0.5, y + 0.5, a, b, c)) {
          vram[off] = Math.min(255, 65 + x * 18);
          vram[off + 1] = Math.min(255, 110 + y * 14);
          vram[off + 2] = 242;
          vram[off + 3] = 0xFF;
        } else {
          vram[off] = 241;
          vram[off + 1] = 245;
          vram[off + 2] = 249;
          vram[off + 3] = 0xFF;
        }
      }
    }
  }

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 07</div>
      <h2 class="chapter-title">CPU ↔ GPU Graphics &amp; The Complete Machine</h2>
      <p class="chapter-lead">A modern 4K display has over 8 million pixels that must be recalculated 60 times every second — nearly half a billion pixel computations per second. Here is how the CPU and GPU team up to draw your screen, followed by the full machine working end-to-end.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · Parallelism</div>
            <div class="beat-title">1 CPU Core vs. 64 GPU Cores</div>
            <p class="beat-body">A <strong>CPU</strong> is built with a few complex, lightning-fast cores optimized for sequential logic, branches, and OS tasks. A <strong>GPU</strong> trades complexity for sheer numbers — packing thousands of simpler cores that execute the exact same math on thousands of pixels at the exact same instant.</p>
            <div class="beat-note"><strong>Watch the race:</strong> Even if each GPU core is slower individually, doing all 64 pixels in <strong>one parallel burst</strong> crushes a sequential loop — the same reason GPUs power modern AI!</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · The Graphics Pipeline</div>
            <div class="beat-title">PCIe → Vertex Shader → Rasterizer</div>
            <p class="beat-body">Your program on the CPU builds triangle coordinates in RAM and sends a draw command across the high-speed <code>PCIe</code> bus. Inside the GPU, <strong>Vertex Shaders</strong> rotate and project the corners, and the hardware <strong>Rasterizer</strong> determines which pixel squares lie inside the triangle.</p>
            <div class="beat-note"><strong>Why triangles?</strong> Every 3D character, button, and font glyph on your screen is broken into flat triangles because testing whether a point is inside a triangle is blazing fast in hardware.</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Complete GPU + VRAM Setup</div>
            <div class="beat-title">Every Pixel Is 4 RGBA Bytes in VRAM</div>
            <p class="beat-body">Finally, parallel <strong>Fragment Shaders</strong> compute a 4-byte color (<code>Red</code>, <code>Green</code>, <code>Blue</code>, <code>Alpha</code>) for every covered pixel and write it into dedicated graphics memory (<code>VRAM</code>). Your monitor simply reads this framebuffer row by row to light up LEDs.</p>
            <div class="beat-note"><strong>Try editing VRAM:</strong> Drag the <strong>Rotate</strong> slider, click any pixel in the 8×8 grid, or flip its hex bytes directly in the VRAM Hex Editor to change its color live!</div>
          </div>
        </div>
      </div>

      <!-- Sticky Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot" style="background:var(--violet)"></span>
            <span id="c7-cap">Step 1: Watch 1 CPU core race 64 parallel GPU cores!</span>
          </div>
          <span class="pill pill-violet">64 Shader Cores</span>
        </div>

        <div class="stage-canvas">
          <!-- Part 1: Race Bars (Beat 0+) -->
          <div class="subcard reveal-part visible">
            <div class="subcard-head">
              <span class="subcard-title">1. Parallelism Race (Shade 64 Pixels)</span>
              <span class="pill pill-blue" id="c7-race-status">Ready</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <strong style="color:var(--blue)">CPU (1 Core, sequential loop)</strong>
                <span class="mono" id="c7-cpu-txt">0 / 64 px</span>
              </div>
              <div class="speed-track"><div class="speed-bar" id="c7-cpu-bar" style="background:var(--blue)"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:12px">
                <strong style="color:var(--violet)">GPU (64 Shader Cores, parallel)</strong>
                <span class="mono" id="c7-gpu-txt">0 / 64 px</span>
              </div>
              <div class="speed-track"><div class="speed-bar" id="c7-gpu-bar" style="background:var(--violet)"></div></div>
            </div>
          </div>

          <!-- Part 2 & 3: Pixel Grid + VRAM Hex -->
          <div class="grid-2" style="align-items:start">
            <div class="subcard reveal-part" id="c7-grid-card">
              <div class="subcard-head">
                <span class="subcard-title">2. Rasterized Display (8×8)</span>
                <span class="mono" style="font-size:11px;color:var(--violet);font-weight:700" id="c7-rot-lbl">20°</span>
              </div>
              <div class="gpu-cores-grid" id="c7-px-grid" style="max-width:250px;width:100%;margin:0 auto"></div>
            </div>

            <div class="subcard reveal-part" id="c7-vram-card">
              <div class="subcard-head">
                <span class="subcard-title">3. VRAM Framebuffer (RGBA)</span>
                <span class="pill pill-rose">4B / pixel</span>
              </div>
              <div id="c7-hex-mount"></div>
            </div>
          </div>
        </div>

        <div class="stage-dock dock-hidden" id="c7-dock">
          <button class="btn btn-violet btn-sm" id="c7-race-btn">🏁 Replay CPU vs GPU Race</button>
          <span style="font-size:12px;color:var(--ink-secondary);margin-left:6px">Rotate:</span>
          <input type="range" id="c7-rot" min="0" max="360" value="20" style="width:120px" />
        </div>
      </div>
    </div>

    <!-- GRAND FINALE: COMPLETE MACHINE END-TO-END -->
    <div class="complete-setup" id="c7-finale">
      <div class="complete-head">
        <div>
          <span class="pill pill-blue" style="margin-right:8px">THE COMPLETE MACHINE</span>
          <strong style="font-size:16px">Press Any Key → Watch Every Layer Fire Together</strong>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap" id="c7-keys">
          ${['C', 'S', 'A', 'B', 'H', 'I', '!'].map((k) => `<button class="btn btn-primary btn-sm mono" data-k="${k}" style="min-width:34px">${k}</button>`).join('')}
        </div>
      </div>

      <div class="stage-caption" style="font-size:13px">
        <span class="live-dot" style="background:var(--emerald)"></span>
        <span id="c7-fin-cap">Click a keycap above to trace a keypress from hardware interrupt all the way to glowing pixels!</span>
      </div>

      <div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px" id="c7-pipe">
        <div class="subcard" id="c7-f1" style="text-align:center">
          <div class="subcard-title" style="color:var(--rose)">1. Keyboard</div>
          <div id="c7-f1-val" class="mono" style="font-size:22px;font-weight:800;color:var(--rose)">—</div>
          <div style="font-size:10.5px;color:var(--ink-muted)">IRQ 1 Pulse</div>
        </div>
        <div class="subcard" id="c7-f2" style="text-align:center">
          <div class="subcard-title" style="color:var(--blue)">2. CPU + Stack</div>
          <div id="c7-f2-val" class="mono" style="font-size:13px;font-weight:800;margin:6px 0">PC:0x1004</div>
          <div style="font-size:10.5px;color:var(--ink-muted)">Push PC → ISR</div>
        </div>
        <div class="subcard" id="c7-f3" style="text-align:center">
          <div class="subcard-title" style="color:var(--violet)">3. RAM Heap</div>
          <div id="c7-f3-val" class="mono" style="font-size:13px;font-weight:800;margin:6px 0;color:var(--violet)">""</div>
          <div style="font-size:10.5px;color:var(--ink-muted)">ASCII Bytes</div>
        </div>
        <div class="subcard" id="c7-f4" style="text-align:center">
          <div class="subcard-title" style="color:var(--amber)">4. SSD Block</div>
          <div id="c7-f4-val" class="mono" style="font-size:13px;font-weight:800;margin:6px 0;color:var(--amber)">0 B</div>
          <div style="font-size:10.5px;color:var(--ink-muted)">notes.txt</div>
        </div>
        <div class="subcard" id="c7-f5" style="text-align:center">
          <div class="subcard-title" style="color:var(--violet)">5. GPU Cores</div>
          <div id="c7-f5-val" class="mono" style="font-size:13px;font-weight:800;margin:6px 0">IDLE</div>
          <div style="font-size:10.5px;color:var(--ink-muted)">PCIe Shader</div>
        </div>
        <div class="subcard" id="c7-f6" style="align-items:center">
          <div class="subcard-title" style="color:var(--emerald)">6. Monitor</div>
          <div id="c7-led" style="display:grid;grid-template-columns:repeat(5,10px);gap:2px;margin-top:2px"></div>
        </div>
      </div>
    </div>
  `;

  const cap = section.querySelector('#c7-cap');
  const dock = section.querySelector('#c7-dock');
  const pxGrid = section.querySelector('#c7-px-grid');
  const pxEls = [];

  for (let i = 0; i < 64; i++) {
    const d = document.createElement('div');
    d.className = 'gpu-core';
    d.style.cursor = 'pointer';
    d.addEventListener('click', () => {
      selectedPx = i;
      renderScreen();
      renderHex();
      const addr = 0xC000 + i * 4;
      hexEditor.select(addr);
      setCaption(cap, `Pixel (${i % 8},${Math.floor(i / 8)}) → VRAM <code>${hex4(addr)}</code>: <code>${hex2(vram[i * 4])} ${hex2(vram[i * 4 + 1])} ${hex2(vram[i * 4 + 2])} FF</code>.`);
    });
    pxGrid.appendChild(d);
    pxEls.push(d);
  }

  function renderScreen() {
    for (let i = 0; i < 64; i++) {
      const o = i * 4;
      pxEls[i].style.background = `rgb(${vram[o]},${vram[o + 1]},${vram[o + 2]})`;
      pxEls[i].style.borderColor = i === selectedPx ? '#0f172a' : '#cbd5e1';
      pxEls[i].style.borderWidth = i === selectedPx ? '2px' : '1px';
    }
  }

  function renderHex() {
    const startRow = Math.max(0, Math.min(6, Math.floor(selectedPx / 8) - 1));
    const byteStart = startRow * 32;
    const slice = vram.subarray(byteStart, byteStart + 48);
    const base = 0xC000 + byteStart;
    if (!hexEditor) {
      hexEditor = new HexEditor(section.querySelector('#c7-hex-mount'), {
        bytes: slice,
        baseAddr: base,
        editable: true,
        legend: [{ label: 'RGBA Framebuffer', color: '#e11d48' }],
        getRegion: (a, v) => (v >= 240 ? 'zero' : 'vram'),
        getRegionLabel: (a) => ['RED', 'GREEN', 'BLUE', 'ALPHA'][(a - 0xC000) % 4],
        onEdit: (a, v) => { vram[a - 0xC000] = v; renderScreen(); }
      });
    } else {
      hexEditor.update({ bytes: slice, baseAddr: base });
    }
  }

  function runRace() {
    raceTimers.forEach((t) => clearTimeout(t));
    raceTimers = [];
    const cpuBar = section.querySelector('#c7-cpu-bar');
    const gpuBar = section.querySelector('#c7-gpu-bar');
    const cpuTxt = section.querySelector('#c7-cpu-txt');
    const gpuTxt = section.querySelector('#c7-gpu-txt');
    const st = section.querySelector('#c7-race-status');
    cpuBar.style.width = '0%';
    gpuBar.style.width = '0%';
    st.textContent = 'Racing...';

    raceTimers.push(setTimeout(() => {
      gpuBar.style.width = '100%';
      gpuTxt.textContent = '64 / 64 px ✓ (1 burst!)';
      rasterize();
      renderScreen();
      renderHex();
    }, 220));

    for (let i = 1; i <= 64; i++) {
      raceTimers.push(setTimeout(() => {
        cpuBar.style.width = `${(i / 64) * 100}%`;
        cpuTxt.textContent = i === 64 ? '64 / 64 px ✓ (64 loops)' : `${i} / 64 px`;
        if (i === 64) st.textContent = 'GPU wins ~12× faster!';
      }, i * 32));
    }
  }

  rasterize();
  renderScreen();
  renderHex();

  section.querySelector('#c7-race-btn').addEventListener('click', runRace);
  section.querySelector('#c7-rot').addEventListener('input', (e) => {
    angleDeg = Number(e.target.value);
    section.querySelector('#c7-rot-lbl').textContent = `${angleDeg}°`;
    rasterize();
    renderScreen();
    renderHex();
    setCaption(cap, `Rotated triangle to <strong>${angleDeg}°</strong> → Vertex Shader, Rasterizer &amp; VRAM Hex updated live!`);
  });

  observeBeats(section, (beatIdx) => {
    section.querySelector('#c7-grid-card').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c7-vram-card').classList.toggle('visible', beatIdx >= 2);
    dock.classList.toggle('dock-hidden', beatIdx < 2);

    if (beatIdx === 0) {
      setCaption(cap, '<strong>Step 1:</strong> Watch 64 GPU shader cores finish in 1 parallel burst while 1 CPU core loops!');
      runRace();
    } else if (beatIdx === 1) {
      setCaption(cap, '<strong>Step 2:</strong> GPU Vertex Shader + Rasterizer map the rotated triangle onto the 8×8 pixel grid.');
    } else {
      setCaption(cap, '<strong>Complete GPU Setup:</strong> Drag Rotate or click any pixel to inspect &amp; edit its RGBA bytes in VRAM!');
    }
  });

  // Grand Finale 6-Stage Keypress-to-Pixel
  const led = section.querySelector('#c7-led');
  const ledCells = [];
  for (let i = 0; i < 35; i++) {
    const d = document.createElement('div');
    d.style.cssText = 'width:10px;height:10px;border-radius:2px;background:#e2e8f0;transition:background 0.2s;';
    led.appendChild(d);
    ledCells.push(d);
  }

  const finCap = section.querySelector('#c7-fin-cap');
  function triggerKey(ch) {
    const ascii = ch.charCodeAt(0);
    const cards = [1, 2, 3, 4, 5, 6].map((n) => section.querySelector(`#c7-f${n}`));
    const hl = (idx) => cards.forEach((c, i) => {
      c.style.borderColor = i === idx ? 'var(--blue)' : 'var(--border)';
      c.style.boxShadow = i === idx ? '0 0 0 3px var(--blue-soft)' : 'none';
    });

    hl(0);
    section.querySelector('#c7-f1-val').textContent = ch;
    setCaption(finCap, `<strong>1/6 Keyboard:</strong> Pressed <code>'${ch}'</code> (<code>0x${hex2(ascii)}</code>) → firing <strong>IRQ 1</strong>!`);

    setTimeout(() => {
      hl(1);
      flyPacket(cards[0], cards[1], `IRQ 1`, { color: '#e11d48' });
      section.querySelector('#c7-f2-val').textContent = `ISR→0x${hex2(ascii)}`;
      setCaption(finCap, `<strong>2/6 CPU &amp; Stack:</strong> Pushed <code>PC</code> to Stack, jumped to ISR, read <code>0x${hex2(ascii)}</code> into <code>R0</code>.`);
    }, 450);

    setTimeout(() => {
      hl(2);
      flyPacket(cards[1], cards[2], `0x${hex2(ascii)}`, { color: '#7c3aed' });
      if (heapStr.length >= 6) heapStr = '';
      heapStr += ch;
      section.querySelector('#c7-f3-val').textContent = `"${heapStr}\\0"`;
      setCaption(finCap, `<strong>3/6 RAM Heap:</strong> Appended byte <code>0x${hex2(ascii)}</code> to dynamic string buffer <code>"${heapStr}\\0"</code>.`);
    }, 950);

    setTimeout(() => {
      hl(3);
      flyPacket(cards[2], cards[3], `${heapStr.length}B`, { color: '#d97706' });
      section.querySelector('#c7-f4-val').textContent = `${heapStr.length} B ✓`;
      setCaption(finCap, `<strong>4/6 SSD Storage:</strong> Flushed <code>notes.txt</code> (${heapStr.length} bytes) to persistent flash block.`);
    }, 1450);

    setTimeout(() => {
      hl(4);
      flyPacket(cards[1], cards[4], `DRAW '${ch}'`, { color: '#7c3aed' });
      section.querySelector('#c7-f5-val').textContent = `SHADE '${ch}'`;
      setCaption(finCap, `<strong>5/6 PCIe → GPU:</strong> GPU shader cores rasterize the font glyph for <code>'${ch}'</code> into VRAM.`);
    }, 1950);

    setTimeout(() => {
      hl(5);
      flyPacket(cards[4], cards[5], `RGBA`, { color: '#059669' });
      const bmp = FONT_5X7[ch] || FONT_5X7['!'];
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          ledCells[r * 5 + c].style.background = bmp[r][c] === '1' ? '#059669' : '#e2e8f0';
        }
      }
      setCaption(finCap, `<strong>6/6 Display ✓:</strong> Monitor scanned VRAM pixels — <strong>'${ch}'</strong> appeared in under 1 millisecond!`);
    }, 2450);
  }

  section.querySelectorAll('#c7-keys button').forEach((btn) => {
    btn.addEventListener('click', () => triggerKey(btn.dataset.k));
  });
}

import { setNarration, hex2, hex4, flyPacket } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

const THEMES = {
  neon: { name: 'Cyan/Violet', r: 56, g: 189, b: 248 },
  solar: { name: 'Solar Amber', r: 245, g: 158, b: 11 },
  cyber: { name: 'Emerald Glow', r: 52, g: 211, b: 153 }
};

export function createModule7() {
  let angleDeg = 18;
  let themeKey = 'neon';
  let pipelineStep = 0; // 0..5
  let timers = [];
  let vram = new Uint8Array(64 * 4); // 8x8 pixels * 4 bytes (RGBA)
  let hexEditor = null;
  let selectedPixel = 27;

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  // Compute 3 rotated triangle vertices in 8x8 pixel space (centered at 3.5, 3.5)
  function getVertices() {
    const rad = (angleDeg * Math.PI) / 180;
    const base = [
      { x: 0, y: -3.2 },
      { x: 3.1, y: 2.5 },
      { x: -3.1, y: 2.5 }
    ];
    return base.map((p) => ({
      x: 3.5 + p.x * Math.cos(rad) - p.y * Math.sin(rad),
      y: 3.5 + p.x * Math.sin(rad) + p.y * Math.cos(rad)
    }));
  }

  function pointInTri(px, py, a, b, c) {
    const sign = (p1, p2, p3) => (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
    const pt = { x: px, y: py };
    const d1 = sign(pt, a, b);
    const d2 = sign(pt, b, c);
    const d3 = sign(pt, c, a);
    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  }

  function rasterizeToVram() {
    const [a, b, c] = getVertices();
    const th = THEMES[themeKey];
    const mask = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = y * 8 + x;
        const inside = pointInTri(x + 0.5, y + 0.5, a, b, c);
        mask.push(inside);
        const off = idx * 4;
        if (inside) {
          // Slight gradient across triangle so each pixel has distinct RGB bytes!
          const shade = 0.6 + (y / 8) * 0.4;
          vram[off] = Math.min(255, Math.round(th.r * shade + x * 6));
          vram[off + 1] = Math.min(255, Math.round(th.g * shade));
          vram[off + 2] = Math.min(255, Math.round(th.b * shade + (7 - x) * 6));
          vram[off + 3] = 0xFF;
        } else {
          vram[off] = 10;
          vram[off + 1] = 15;
          vram[off + 2] = 26;
          vram[off + 3] = 0xFF;
        }
      }
    }
    return mask;
  }

  return {
    init(container) {
      rasterizeToVram();

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <button class="btn btn-primary btn-sm" id="m7-animate">▶ Animate Full GPU Pipeline</button>
            <button class="btn btn-violet btn-sm" id="m7-race">🏁 Race: 1 CPU Core vs 64 GPU Cores</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <span style="font-size:11.5px;color:var(--text-muted)">Rotate Triangle:</span>
            <input type="range" id="m7-rot" min="0" max="360" value="${angleDeg}" style="width:95px" />
            <span class="mono" id="m7-rot-val" style="font-size:11px;color:var(--cyan);min-width:32px">${angleDeg}°</span>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group" id="m7-themes">
            <button class="btn btn-sm active-tab" data-th="neon">Cyan</button>
            <button class="btn btn-sm" data-th="solar">Amber</button>
            <button class="btn btn-sm" data-th="cyber">Emerald</button>
          </div>
        </div>

        <div class="grid-3" style="flex:1">
          <!-- Left: CPU Command Buffer + PCIe Bus -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>1. CPU → PCIe Command Queue</div>
              <span class="pill pill-cyan">Host CPU</span>
            </div>

            <div class="code-pane" id="m7-cpu-code" style="flex:none;max-height:145px">
              <div class="code-line" id="m7-st-1"><span class="code-line-num">1</span><span>// Build Triangle Vertices in RAM</span></div>
              <div class="code-line" id="m7-st-2"><span class="code-line-num">2</span><span>glBufferData(PCIe, verts, 36B);</span></div>
              <div class="code-line" id="m7-st-3"><span class="code-line-num">3</span><span>glUniform1f("angle", ${angleDeg}deg);</span></div>
              <div class="code-line" id="m7-st-4"><span class="code-line-num">4</span><span>glDrawArrays(TRIANGLES, 0, 3);</span></div>
            </div>

            <!-- Vertex coordinates readout -->
            <div style="background:#090e17;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-family:var(--font-mono);font-size:11px" id="m7-verts-box"></div>

            <!-- Race Scorecard -->
            <div style="margin-top:auto;background:#090e17;border:1px solid var(--border);border-radius:8px;padding:9px 10px;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:10.5px;color:var(--text-muted);font-weight:700">CPU vs GPU PARALLELISM RACE (64 PIXELS)</div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px">
                <span style="color:var(--cyan)">CPU (1 Core, sequential)</span>
                <span class="mono" id="m7-cpu-score" style="color:var(--text-secondary)">0 / 64 px</span>
              </div>
              <div class="speed-track"><div class="speed-bar" id="m7-cpu-bar" style="background:var(--cyan)"></div></div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px">
                <span style="color:var(--violet)">GPU (64 Shader Cores, parallel)</span>
                <span class="mono" id="m7-gpu-score" style="color:var(--text-secondary)">0 / 64 px</span>
              </div>
              <div class="speed-track"><div class="speed-bar" id="m7-gpu-bar" style="background:var(--violet)"></div></div>
            </div>
          </div>

          <!-- Center: GPU 64 Parallel Shader Cores + Rasterized Display -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--violet)"></span>2. GPU Shader Grid &amp; Monitor</div>
              <span class="pill pill-violet" id="m7-gpu-pill">64 Parallel Cores</span>
            </div>

            <div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between">
              <span>Click any pixel to inspect its RGBA bytes in VRAM →</span>
              <span class="mono" id="m7-px-coord" style="color:var(--amber)">Pixel (3,3)</span>
            </div>

            <div class="gpu-cores-grid" id="m7-screen-grid" style="max-width:300px;width:100%;margin:0 auto"></div>

            <!-- Pipeline Stage Pills -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:auto" id="m7-pipe-bar">
              <div class="phase-chip" data-s="1">PCIe DMA</div>
              <div class="phase-chip" data-s="2">VERTEX</div>
              <div class="phase-chip" data-s="3">RASTER</div>
              <div class="phase-chip" data-s="4">FRAGMENT</div>
            </div>
          </div>

          <!-- Right: Live VRAM Framebuffer Hex Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--coral)"></span>3. VRAM Framebuffer (RGBA Hex)</div>
              <span class="pill pill-coral">4 bytes / pixel</span>
            </div>
            <div id="m7-hex-mount" style="flex:1;display:flex;flex-direction:column"></div>
            <div style="font-size:11px;color:var(--text-secondary);background:#090e17;border:1px solid var(--border);border-radius:6px;padding:7px 9px">
              Every pixel on your monitor is just 4 bytes in VRAM: <code style="color:var(--coral)">R</code> <code style="color:var(--emerald)">G</code> <code style="color:var(--cyan)">B</code> <code style="color:var(--text-muted)">A</code>!
            </div>
          </div>
        </div>
      `;

      const screenGrid = container.querySelector('#m7-screen-grid');
      const vertsBox = container.querySelector('#m7-verts-box');
      const hexMount = container.querySelector('#m7-hex-mount');
      const pxCoord = container.querySelector('#m7-px-coord');

      // Build 64 pixel cells
      const pixelEls = [];
      for (let i = 0; i < 64; i++) {
        const el = document.createElement('div');
        el.className = 'gpu-core';
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => {
          selectedPixel = i;
          const x = i % 8, y = Math.floor(i / 8);
          const vramAddr = 0xC000 + i * 4;
          pxCoord.textContent = `Pixel (${x},${y}) @ ${hex4(vramAddr)}`;
          renderScreen();
          renderHexWindow();
          hexEditor.select(vramAddr);
          const off = i * 4;
          setNarration(`Inspecting <strong>Pixel (${x},${y})</strong> → stored in VRAM at <code>${hex4(vramAddr)}</code> as RGBA <code>${hex2(vram[off])} ${hex2(vram[off + 1])} ${hex2(vram[off + 2])} FF</code>.`);
        });
        screenGrid.appendChild(el);
        pixelEls.push(el);
      }

      function renderVerts() {
        const vs = getVertices();
        vertsBox.innerHTML = `
          <div style="color:var(--text-muted);font-size:10px;margin-bottom:4px">TRANSFORMED VERTEX BUFFER (Vertex Shader)</div>
          ${vs.map((v, i) => `<div>V${i}: (<span style="color:var(--cyan)">${v.x.toFixed(1)}</span>, <span style="color:var(--emerald)">${v.y.toFixed(1)}</span>)</div>`).join('')}
        `;
        const l3 = container.querySelector('#m7-st-3');
        if (l3) l3.innerHTML = `<span class="code-line-num">3</span><span>glUniform1f("angle", ${angleDeg}deg);</span>`;
      }

      function renderScreen(flashMask = null) {
        for (let i = 0; i < 64; i++) {
          const off = i * 4;
          const r = vram[off], g = vram[off + 1], b = vram[off + 2];
          const el = pixelEls[i];
          el.style.background = `rgb(${r},${g},${b})`;
          el.style.borderColor = i === selectedPixel ? '#fff' : (flashMask && flashMask[i] ? '#f59e0b' : '#22324d');
          el.style.boxShadow = i === selectedPixel ? '0 0 10px #fff' : (flashMask && flashMask[i] ? `0 0 10px rgb(${r},${g},${b})` : 'none');
        }
      }

      function renderHexWindow() {
        // Show 64 bytes (16 pixels) centered around selectedPixel row
        const startRow = Math.max(0, Math.min(6, Math.floor(selectedPixel / 8) - 1));
        const byteStart = startRow * 8 * 4;
        const slice = vram.subarray(byteStart, byteStart + 64);
        const base = 0xC000 + byteStart;

        if (!hexEditor) {
          hexEditor = new HexEditor(hexMount, {
            bytes: slice,
            baseAddr: base,
            editable: true,
            legend: [
              { label: 'RGBA Framebuffer Bytes', color: '#fb7185' }
            ],
            getRegion: (addr, val) => (val <= 26 ? 'zero' : 'vram'),
            getRegionLabel: (addr) => {
              const chan = ['RED', 'GREEN', 'BLUE', 'ALPHA'][(addr - 0xC000) % 4];
              return `VRAM ${chan}`;
            },
            onEdit: (addr, val) => {
              vram[addr - 0xC000] = val;
              renderScreen();
              setNarration(`Edited VRAM byte <code>${hex4(addr)}</code> → monitor pixel changed color instantaneously!`);
            }
          });
        } else {
          hexEditor.update({ bytes: slice, baseAddr: base });
        }
      }

      function setStageHighlight(s) {
        pipelineStep = s;
        container.querySelectorAll('#m7-pipe-bar .phase-chip').forEach((ch) => {
          const n = Number(ch.dataset.s);
          ch.className = 'phase-chip';
          if (n === s) ch.classList.add(n <= 2 ? 'active-fetch' : 'active-execute');
        });
        [1, 2, 3, 4].forEach((n) => {
          const el = container.querySelector(`#m7-st-${n}`);
          if (el) el.classList.toggle('active-c', n === s);
        });
      }

      function refreshTriangle() {
        const mask = rasterizeToVram();
        renderVerts();
        renderScreen(mask);
        renderHexWindow();
      }

      // Rotate slider
      container.querySelector('#m7-rot').addEventListener('input', (e) => {
        angleDeg = Number(e.target.value);
        container.querySelector('#m7-rot-val').textContent = `${angleDeg}°`;
        refreshTriangle();
        setNarration(`Rotated triangle to <strong>${angleDeg}°</strong> → Vertex Shader recomputed corners, Rasterizer updated pixels, and VRAM RGBA bytes changed live!`);
      });

      // Theme buttons
      container.querySelectorAll('#m7-themes button').forEach((btn) => {
        btn.addEventListener('click', () => {
          themeKey = btn.dataset.th;
          container.querySelectorAll('#m7-themes button').forEach((b) => b.classList.toggle('active-tab', b === btn));
          refreshTriangle();
          setNarration(`Fragment Shader color changed to <strong>${THEMES[themeKey].name}</strong> → all 64 shader cores rewrote VRAM RGB bytes!`);
        });
      });

      // Animate Full Pipeline
      container.querySelector('#m7-animate').addEventListener('click', () => {
        clearTimers();
        // Blank screen briefly
        pixelEls.forEach((el) => { el.style.background = '#0a0f1a'; el.style.boxShadow = 'none'; });

        setStageHighlight(1);
        setNarration('<strong>Stage 1/4 (CPU → PCIe DMA):</strong> CPU writes triangle vertices &amp; <code>glDrawArrays()</code> command and bursts them over the PCIe bus to the GPU.');
        flyPacket(container.querySelector('#m7-cpu-code'), screenGrid, '3 VERTICES (PCIe)', { color: '#38bdf8', duration: 650 });

        timers.push(setTimeout(() => {
          setStageHighlight(2);
          angleDeg = (angleDeg + 30) % 360;
          container.querySelector('#m7-rot').value = String(angleDeg);
          container.querySelector('#m7-rot-val').textContent = `${angleDeg}°`;
          renderVerts();
          setNarration(`<strong>Stage 2/4 (Vertex Shader):</strong> GPU rotates all 3 vertices simultaneously to <code>${angleDeg}°</code> using parallel matrix math.`);
        }, 780));

        timers.push(setTimeout(() => {
          setStageHighlight(3);
          const mask = rasterizeToVram();
          mask.forEach((inside, i) => {
            if (inside) pixelEls[i].style.background = 'rgba(167,139,250,0.35)';
          });
          setNarration('<strong>Stage 3/4 (Rasterizer):</strong> GPU hardware tests all 64 pixel centers in parallel to find which fragments fall inside the triangle.');
        }, 1600));

        timers.push(setTimeout(() => {
          setStageHighlight(4);
          const mask = rasterizeToVram();
          renderScreen(mask);
          renderHexWindow();
          flyPacket(screenGrid, hexMount, 'RGBA → VRAM', { color: '#fb7185', duration: 600 });
          setNarration('<strong>Stage 4/4 (Fragment Shaders → VRAM):</strong> All shader cores compute RGBA pixel colors in parallel and write them straight into the VRAM Framebuffer!');
        }, 2450));

        timers.push(setTimeout(() => {
          setStageHighlight(0);
        }, 3400));
      });

      // Race: 1 CPU Core vs 64 GPU Cores
      container.querySelector('#m7-race').addEventListener('click', () => {
        clearTimers();
        const cpuBar = container.querySelector('#m7-cpu-bar');
        const gpuBar = container.querySelector('#m7-gpu-bar');
        const cpuScore = container.querySelector('#m7-cpu-score');
        const gpuScore = container.querySelector('#m7-gpu-score');

        cpuBar.style.width = '0%';
        gpuBar.style.width = '0%';
        cpuScore.textContent = '0 / 64 px';
        gpuScore.textContent = '0 / 64 px';
        pixelEls.forEach((el) => { el.style.background = '#0a0f1a'; el.style.boxShadow = 'none'; });

        setNarration('<strong>🏁 RACE STARTED:</strong> Shading 64 pixels! Watch <strong>GPU (64 parallel cores)</strong> finish in 1 burst while <strong>CPU (1 sequential core)</strong> loops pixel by pixel...');

        // GPU finishes in 1 parallel burst!
        timers.push(setTimeout(() => {
          gpuBar.style.width = '100%';
          gpuScore.textContent = '64 / 64 px ✓ (1 batch!)';
          const mask = rasterizeToVram();
          renderScreen(mask);
          renderHexWindow();
        }, 260));

        // CPU loops sequentially 1..64
        for (let i = 1; i <= 64; i++) {
          timers.push(setTimeout(() => {
            cpuBar.style.width = `${(i / 64) * 100}%`;
            cpuScore.textContent = i === 64 ? '64 / 64 px ✓ (64 loops)' : `${i} / 64 px`;
            if (i === 64) {
              setNarration('<strong>Race Finished!</strong> That is why computers have a separate <strong>GPU</strong>: CPUs excel at complex branching logic; GPUs crush millions of parallel pixel/matrix ops!');
            }
          }, i * 38));
        }
      });

      refreshTriangle();
      setNarration('Drag <strong>Rotate Triangle</strong>, click pixels to inspect <strong>VRAM RGBA Hex</strong>, or run the <strong>CPU vs GPU Parallelism Race</strong>!');
    },

    destroy() {
      clearTimers();
    }
  };
}

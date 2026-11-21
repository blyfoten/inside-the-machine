import { setNarration, hex2, hex4, flyPacket } from '../components/animator.js';

// Crisp 5x7 font bitmaps for capstone monitor
const FONT_5X7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100']
};

const QUICK_KEYS = ['C', 'S', 'A', 'B', 'H', 'I', '!'];

export function createModule8() {
  let timers = [];
  let heapStr = '';
  let activeStage = 0;
  let keyListener = null;

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  return {
    init(container) {
      heapStr = '';
      activeStage = 0;

      container.innerHTML = `
        <div class="toolbar">
          <span style="font-size:12px;color:var(--text-secondary);font-weight:600">Press a key on your keyboard — or click a keycap:</span>
          <div class="toolbar-group" id="m8-keycaps">
            ${QUICK_KEYS.map((k) => `<button class="btn btn-primary btn-sm mono" data-key="${k}" style="min-width:34px;font-size:13px">${k}</button>`).join('')}
          </div>
          <div class="toolbar-divider"></div>
          <button class="btn btn-ghost btn-sm" id="m8-clear">↺ Clear Screen &amp; Buffer</button>
        </div>

        <!-- 6-Stage Interactive Pipeline Grid -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;flex:1;min-height:0">
          <!-- Stage 1: Keyboard Hardware & IRQ -->
          <div class="card" id="m8-s1">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--coral)"></span>1. Keyboard &amp; IRQ 1</div>
              <span class="pill pill-coral">Hardware</span>
            </div>
            <div style="background:#090e17;border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center;font-family:var(--font-mono)">
              <div style="font-size:10px;color:var(--text-muted)">LAST KEYPRESSED</div>
              <div id="m8-key-big" style="font-size:30px;font-weight:800;color:var(--coral);margin:4px 0">—</div>
              <div id="m8-scancode" style="font-size:11px;color:var(--text-secondary)">Waiting for keypress...</div>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto">Electrical switch closes → sends hardware <strong>IRQ 1</strong> signal directly to CPU interrupt pin.</div>
          </div>

          <!-- Stage 2: CPU + Stack + IVT -->
          <div class="card" id="m8-s2">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>2. CPU, Stack &amp; ISR</div>
              <span class="pill pill-cyan">PC &amp; SP</span>
            </div>
            <div class="reg-grid">
              <div class="reg-box"><span class="reg-name" style="color:var(--cyan)">PC</span><span class="reg-val" id="m8-pc">0x1004</span></div>
              <div class="reg-box"><span class="reg-name" style="color:var(--emerald)">SP</span><span class="reg-val" id="m8-sp">0x00F8</span></div>
              <div class="reg-box"><span class="reg-name">R0</span><span class="reg-val" id="m8-r0">0x00</span></div>
              <div class="reg-box"><span class="reg-name" style="color:var(--coral)">MODE</span><span class="reg-val" id="m8-mode" style="font-size:11px">USER</span></div>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto">CPU pushes <code>PC</code> onto <strong>Stack</strong>, jumps to <strong>Keyboard ISR</strong>, reads ASCII byte into <code>R0</code>, then <code>IRET</code>.</div>
          </div>

          <!-- Stage 3: RAM Heap Buffer (Hex!) -->
          <div class="card" id="m8-s3">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--violet)"></span>3. RAM Heap Buffer (Hex)</div>
              <span class="pill pill-violet">0x2000</span>
            </div>
            <div style="background:#090e17;border:1px solid var(--border);border-radius:8px;padding:10px;font-family:var(--font-mono);font-size:12px">
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:5px">HEAP STRING BYTES + NULL TERMINATOR:</div>
              <div id="m8-heap-hex" style="display:flex;flex-wrap:wrap;gap:5px;min-height:30px"></div>
              <div style="margin-top:8px;font-size:11px;color:var(--emerald)">String: <strong id="m8-heap-str">""</strong></div>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto">Editor app appends the ASCII byte to its dynamic text buffer on the <strong>Heap</strong>.</div>
          </div>

          <!-- Stage 4: SSD Storage Block -->
          <div class="card" id="m8-s4">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>4. SSD File Flush (notes.txt)</div>
              <span class="pill pill-amber">Block #4</span>
            </div>
            <div style="background:#090e17;border:1px solid var(--border);border-radius:8px;padding:10px;font-family:var(--font-mono);font-size:11.5px">
              <div style="color:var(--amber)">Inode #19 → SSD Block #4</div>
              <div id="m8-disk-status" style="color:var(--text-secondary);margin-top:6px">Synced: 0 bytes written</div>
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto">OS writes the Heap bytes to non-volatile <strong>Flash Storage</strong> so your file survives power-off.</div>
          </div>

          <!-- Stage 5: PCIe -> GPU Shader Cores -->
          <div class="card" id="m8-s5">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--violet)"></span>5. PCIe → GPU Glyph Shader</div>
              <span class="pill pill-violet">35 Parallel Cores</span>
            </div>
            <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;background:#090e17;border:1px solid var(--border);border-radius:8px;padding:8px" id="m8-gpu-mini">
              ${Array.from({ length: 21 }).map(() => `<div class="gpu-core" style="height:16px"></div>`).join('')}
            </div>
            <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto">CPU sends glyph command over <strong>PCIe</strong>; GPU cores rasterize all font pixels in parallel into VRAM.</div>
          </div>

          <!-- Stage 6: Live Pixel Monitor -->
          <div class="card" id="m8-s6">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--emerald)"></span>6. Display Monitor (VRAM)</div>
              <span class="pill pill-emerald">60 Hz Scanout</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:14px;background:#05080f;border:2px solid #2b3e5c;border-radius:8px;padding:10px">
              <div id="m8-led-matrix" style="display:grid;grid-template-columns:repeat(5,16px);gap:3px"></div>
              <div style="font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)">
                <div style="color:var(--emerald);font-weight:700" id="m8-mon-label">READY</div>
                <div style="font-size:10px;color:var(--text-muted);margin-top:4px">5×7 RGB<br/>Framebuffer</div>
              </div>
            </div>
          </div>
        </div>
      `;

      const ledMatrix = container.querySelector('#m8-led-matrix');
      const ledCells = [];
      for (let i = 0; i < 35; i++) {
        const d = document.createElement('div');
        d.style.cssText = 'width:16px;height:16px;border-radius:3px;background:#0e1624;border:1px solid #1d2b44;transition:all 0.2s;';
        ledMatrix.appendChild(d);
        ledCells.push(d);
      }

      const gpuMiniCores = Array.from(container.querySelectorAll('#m8-gpu-mini .gpu-core'));

      function highlightStage(n) {
        activeStage = n;
        for (let i = 1; i <= 6; i++) {
          const card = container.querySelector(`#m8-s${i}`);
          card.style.borderColor = i === n ? 'var(--cyan)' : 'var(--border)';
          card.style.boxShadow = i === n ? '0 0 18px rgba(56,189,248,0.22)' : 'none';
        }
      }

      function renderHeap() {
        const hexWrap = container.querySelector('#m8-heap-hex');
        const bytes = [];
        for (let i = 0; i < heapStr.length; i++) bytes.push(heapStr.charCodeAt(i));
        bytes.push(0x00);
        hexWrap.innerHTML = bytes.map((b, idx) => `
          <span style="padding:3px 6px;border-radius:4px;background:${b === 0 ? '#141e30' : 'rgba(167,139,250,0.22)'};border:1px solid ${b === 0 ? '#2b3a55' : '#a78bfa'};color:${b === 0 ? '#647a9e' : '#fff'}">
            ${hex2(b)}
          </span>
        `).join('');
        container.querySelector('#m8-heap-str').textContent = `"${heapStr}\\0"`;
      }

      function renderGlyph(ch) {
        const bmp = FONT_5X7[ch] || FONT_5X7['!'];
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 5; c++) {
            const on = bmp[r][c] === '1';
            const el = ledCells[r * 5 + c];
            el.style.background = on ? '#34d399' : '#0e1624';
            el.style.boxShadow = on ? '0 0 10px #34d399' : 'none';
          }
        }
        container.querySelector('#m8-mon-label').textContent = `RENDERED '${ch}'`;
      }

      function triggerKey(ch) {
        clearTimers();
        const ascii = ch.charCodeAt(0);
        const s1 = container.querySelector('#m8-s1');
        const s2 = container.querySelector('#m8-s2');
        const s3 = container.querySelector('#m8-s3');
        const s4 = container.querySelector('#m8-s4');
        const s5 = container.querySelector('#m8-s5');
        const s6 = container.querySelector('#m8-s6');

        // Stage 1: Keyboard IRQ
        highlightStage(1);
        container.querySelector('#m8-key-big').textContent = ch;
        container.querySelector('#m8-scancode').textContent = `ASCII: 0x${hex2(ascii)} (${ascii}) → IRQ 1`;
        setNarration(`<strong>Step 1/6 (Hardware):</strong> You pressed <code>'${ch}'</code> → Keyboard fires hardware interrupt <strong>IRQ 1</strong>!`);

        // Stage 2: CPU + Stack + ISR
        timers.push(setTimeout(() => {
          highlightStage(2);
          flyPacket(s1, s2, `IRQ 1 (0x${hex2(ascii)})`, { color: '#fb7185' });
          container.querySelector('#m8-pc').textContent = '0x8000';
          container.querySelector('#m8-sp').textContent = '0x00F6';
          container.querySelector('#m8-r0').textContent = `0x${hex2(ascii)}`;
          container.querySelector('#m8-mode').textContent = 'KERNEL ISR';
          setNarration(`<strong>Step 2/6 (CPU &amp; Stack):</strong> CPU pushes <code>PC</code> onto the <strong>Stack</strong> (<code>SP↓ 0x00F6</code>), jumps to ISR <code>0x8000</code>, reads <code>0x${hex2(ascii)}</code> into <code>R0</code>.`);
        }, 550));

        // Stage 3: Append to Heap Buffer
        timers.push(setTimeout(() => {
          highlightStage(3);
          flyPacket(s2, s3, `0x${hex2(ascii)} '${ch}'`, { color: '#a78bfa' });
          container.querySelector('#m8-pc').textContent = '0x1008';
          container.querySelector('#m8-sp').textContent = '0x00F8';
          container.querySelector('#m8-mode').textContent = 'USER';
          if (heapStr.length >= 7) heapStr = '';
          heapStr += ch;
          renderHeap();
          setNarration(`<strong>Step 3/6 (RAM Heap):</strong> App writes byte <code>0x${hex2(ascii)}</code> into the dynamic string buffer on the <strong>Heap</strong> (<code>"${heapStr}\\0"</code>).`);
        }, 1250));

        // Stage 4: SSD File Save
        timers.push(setTimeout(() => {
          highlightStage(4);
          flyPacket(s3, s4, `WRITE ${heapStr.length}B`, { color: '#f59e0b' });
          container.querySelector('#m8-disk-status').textContent = `Synced: "${heapStr}" (${heapStr.length} bytes saved ✓)`;
          setNarration(`<strong>Step 4/6 (Storage):</strong> OS flushes the updated buffer to persistent <strong>SSD Block #4</strong> (<code>notes.txt</code>).`);
        }, 1950));

        // Stage 5: PCIe -> GPU Shader Cores
        timers.push(setTimeout(() => {
          highlightStage(5);
          flyPacket(s2, s5, `DRAW '${ch}'`, { color: '#a78bfa' });
          gpuMiniCores.forEach((c) => c.classList.add('active'));
          setNarration(`<strong>Step 5/6 (PCIe → GPU):</strong> CPU sends draw command over <strong>PCIe</strong> → GPU shader cores light up in parallel to rasterize glyph <code>'${ch}'</code>!`);
        }, 2650));

        // Stage 6: Monitor Scanout
        timers.push(setTimeout(() => {
          highlightStage(6);
          flyPacket(s5, s6, `VRAM RGB`, { color: '#34d399' });
          renderGlyph(ch);
          setNarration(`<strong>Step 6/6 (Display ✓):</strong> VRAM Framebuffer scans out RGB pixels — <strong>'${ch}'</strong> appears on your screen in under 1 millisecond!`);
        }, 3350));

        timers.push(setTimeout(() => {
          gpuMiniCores.forEach((c) => c.classList.remove('active'));
          highlightStage(0);
        }, 4200));
      }

      container.querySelectorAll('#m8-keycaps button').forEach((btn) => {
        btn.addEventListener('click', () => triggerKey(btn.dataset.key));
      });

      container.querySelector('#m8-clear').addEventListener('click', () => {
        clearTimers();
        heapStr = '';
        renderHeap();
        ledCells.forEach((el) => { el.style.background = '#0e1624'; el.style.boxShadow = 'none'; });
        container.querySelector('#m8-key-big').textContent = '—';
        container.querySelector('#m8-mon-label').textContent = 'READY';
        container.querySelector('#m8-disk-status').textContent = 'Synced: 0 bytes written';
        highlightStage(0);
        setNarration('Cleared buffer &amp; monitor. Press or click any keycap to trace the full computer stack!');
      });

      // Also listen to real physical keyboard presses!
      keyListener = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const k = e.key.toUpperCase();
        if (FONT_5X7[k]) {
          triggerKey(k);
        }
      };
      window.addEventListener('keydown', keyListener);

      renderHeap();
      setNarration('<strong>Capstone:</strong> Press <code>C</code>, <code>S</code>, <code>A</code>, <code>B</code>, <code>H</code>, <code>I</code>, or <code>!</code> (on your keyboard or above) to watch <strong>all 6 layers</strong> of a computer work together!');
    },

    destroy() {
      clearTimers();
      if (keyListener) {
        window.removeEventListener('keydown', keyListener);
        keyListener = null;
      }
    }
  };
}

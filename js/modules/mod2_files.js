import { setNarration, hex2 } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

const PALETTE = [
  { name: 'Void', rgb: [15, 23, 42] },
  { name: 'Cyan', rgb: [56, 189, 248] },
  { name: 'Amber', rgb: [245, 158, 11] },
  { name: 'Emerald', rgb: [52, 211, 153] },
  { name: 'Coral', rgb: [251, 113, 133] }
];

export function createModule2() {
  let activeFile = 'txt'; // 'txt' | 'bmp'
  let diskType = 'hdd'; // 'hdd' | 'ssd'
  let hexEditor = null;
  let rafId = null;
  let timers = [];

  // Raw file byte buffers (32 bytes for txt, 56 bytes for mini bmp: 8-byte header + 16*3 RGB)
  const txtBytes = new Uint8Array(32);
  const initialStr = 'Hello, CS World!\0';
  for (let i = 0; i < initialStr.length; i++) txtBytes[i] = initialStr.charCodeAt(i);

  const bmpBytes = new Uint8Array(56);
  // Mini BMP-like header (8 bytes): 'B','M', width=4, height=4, bpp=24, 0, 0, 0
  bmpBytes.set([0x42, 0x4D, 0x04, 0x04, 0x18, 0x00, 0x00, 0x00], 0);
  // Draw a cute cyan/amber smiley in 4x4 RGB
  const initPixels = [
    0, 1, 1, 0,
    1, 2, 2, 1,
    1, 0, 0, 1,
    0, 3, 3, 0
  ];
  initPixels.forEach((pIdx, i) => {
    const [r, g, b] = PALETTE[pIdx].rgb;
    bmpBytes[8 + i * 3] = r;
    bmpBytes[8 + i * 3 + 1] = g;
    bmpBytes[8 + i * 3 + 2] = b;
  });

  // Inode table mapping files to fragmented disk blocks (each block = 16 bytes)
  const INODES = {
    txt: { name: 'hello.txt', inode: 42, blocks: [1, 5], color: '#38bdf8' },
    bmp: { name: 'icon.bmp', inode: 87, blocks: [2, 6, 9, 11], color: '#a78bfa' }
  };

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  return {
    init(container) {
      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <span style="font-size:11.5px;color:var(--text-muted)">Open File:</span>
            <button class="btn btn-sm active-tab" id="m2-f-txt">📄 hello.txt (Text)</button>
            <button class="btn btn-sm" id="m2-f-bmp">🖼️ icon.bmp (Image)</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <button class="btn btn-sm active-tab" id="m2-d-hdd">💿 HDD Platter</button>
            <button class="btn btn-sm" id="m2-d-ssd">⚡ SSD Blocks</button>
          </div>
          <div class="toolbar-divider"></div>
          <button class="btn btn-primary btn-sm" id="m2-read">▶ Animate: Read File from Disk</button>
        </div>

        <div class="grid-3">
          <!-- Left: Human View of the File -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>Human View (Editable!)</div>
              <span class="pill pill-cyan" id="m2-file-pill">hello.txt</span>
            </div>

            <div id="m2-human-view" style="display:flex;flex-direction:column;gap:12px;flex:1"></div>

            <div style="background:#0a0f18;border:1px solid var(--border);border-radius:8px;padding:9px;font-size:11.5px;color:var(--text-secondary)">
              <div style="color:var(--amber);font-weight:700;margin-bottom:3px">💡 Try editing EITHER side!</div>
              Type text or click pixels here — OR flip individual <code>0/1</code> bits in the <strong>Hex Editor</strong> on the right. Files have no magic: they are just bytes interpreted by a program!
            </div>
          </div>

          <!-- Center: Disk / Filesystem Visualizer -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>Filesystem &amp; Physical Storage</div>
              <span class="pill pill-amber" id="m2-inode-pill">Inode #42</span>
            </div>

            <!-- Inode table mini box -->
            <div style="background:#0a0f18;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-family:var(--font-mono);font-size:11px">
              <div style="color:var(--text-muted);font-size:10px;margin-bottom:4px">DIRECTORY / INODE TABLE (File → Scattered Disk Blocks)</div>
              <div id="m2-inode-rows" style="display:flex;flex-direction:column;gap:4px"></div>
            </div>

            <!-- Disk SVG / Grid -->
            <div style="flex:1;display:flex;align-items:center;justify-content:center;background:#080d16;border:1px solid var(--border);border-radius:8px;padding:8px;min-height:210px" id="m2-disk-stage">
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono);font-size:11px;color:var(--text-secondary)" id="m2-disk-status">
              <span>Blocks highlighted on disk</span>
              <span class="pill" id="m2-seek-ms">Seek: idle</span>
            </div>
          </div>

          <!-- Right: Live Interactive Hex Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--emerald)"></span>Live Hex Editor (Raw Bytes)</div>
              <span class="pill pill-emerald">Editable</span>
            </div>
            <div id="m2-hex-mount" style="flex:1;display:flex;flex-direction:column"></div>
          </div>
        </div>
      `;

      const humanEl = container.querySelector('#m2-human-view');
      const hexMount = container.querySelector('#m2-hex-mount');
      const inodeRows = container.querySelector('#m2-inode-rows');
      const diskStage = container.querySelector('#m2-disk-stage');
      const filePill = container.querySelector('#m2-file-pill');
      const inodePill = container.querySelector('#m2-inode-pill');
      const seekMs = container.querySelector('#m2-seek-ms');

      let platterAngle = 0;
      let activeBlockHighlight = -1;
      let armTargetTrack = 0.5;

      function currentBytes() {
        return activeFile === 'txt' ? txtBytes : bmpBytes;
      }

      function renderHumanView() {
        filePill.textContent = INODES[activeFile].name;
        inodePill.textContent = `Inode #${INODES[activeFile].inode}`;

        if (activeFile === 'txt') {
          let str = '';
          for (let i = 0; i < txtBytes.length; i++) {
            if (txtBytes[i] === 0) break;
            str += String.fromCharCode(txtBytes[i]);
          }
          humanEl.innerHTML = `
            <div style="font-size:12px;color:var(--text-secondary)">Plain ASCII Text (1 character = 1 byte, ends with <code>0x00</code> null):</div>
            <input type="text" class="text-live-input" id="m2-txt-in" maxlength="31" value="${str.replace(/"/g, '&quot;')}" />
            <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px" id="m2-char-chips"></div>
          `;
          const chips = humanEl.querySelector('#m2-char-chips');
          for (let i = 0; i < Math.min(16, str.length); i++) {
            const code = txtBytes[i];
            const chip = document.createElement('div');
            chip.style.cssText = 'background:#0a0f18;border:1px solid var(--border);border-radius:5px;padding:4px 7px;text-align:center;font-family:var(--font-mono);cursor:pointer;';
            chip.innerHTML = `<div style="font-size:13px;color:#fff;font-weight:700">${str[i] === ' ' ? '␣' : str[i]}</div><div style="font-size:10px;color:var(--amber)">0x${hex2(code)}</div>`;
            chip.addEventListener('click', () => hexEditor.select(i));
            chips.appendChild(chip);
          }

          const inp = humanEl.querySelector('#m2-txt-in');
          inp.addEventListener('input', () => {
            txtBytes.fill(0);
            const v = inp.value;
            for (let i = 0; i < Math.min(31, v.length); i++) {
              txtBytes[i] = v.charCodeAt(i) & 0x7f;
            }
            hexEditor.update({ bytes: txtBytes });
            // Re-render chips only so input keeps focus
            chips.innerHTML = '';
            for (let i = 0; i < Math.min(16, v.length); i++) {
              const code = txtBytes[i];
              const chip = document.createElement('div');
              chip.style.cssText = 'background:#0a0f18;border:1px solid var(--border);border-radius:5px;padding:4px 7px;text-align:center;font-family:var(--font-mono);cursor:pointer;';
              chip.innerHTML = `<div style="font-size:13px;color:#fff;font-weight:700">${v[i] === ' ' ? '␣' : v[i]}</div><div style="font-size:10px;color:var(--amber)">0x${hex2(code)}</div>`;
              chip.addEventListener('click', () => hexEditor.select(i));
              chips.appendChild(chip);
            }
            setNarration(`Updated <code>hello.txt</code> → each typed character maps directly to its <strong>ASCII byte</strong> in the Hex Editor.`);
          });
        } else {
          humanEl.innerHTML = `
            <div style="font-size:12px;color:var(--text-secondary)">4×4 Bitmap Image: <strong>8-byte header</strong> (<code>42 4D</code> = "BM") + <strong>3 bytes (R, G, B) per pixel</strong>. Click any pixel to cycle color!</div>
            <div style="display:flex;align-items:center;gap:14px">
              <div class="pixel-grid-4" id="m2-px-grid"></div>
              <div style="font-family:var(--font-mono);font-size:11px;display:flex;flex-direction:column;gap:5px;color:var(--text-secondary)">
                <div>Magic: <span style="color:var(--amber)">0x42 0x4D ("BM")</span></div>
                <div>Width: <span style="color:var(--cyan)">${bmpBytes[2]} px</span></div>
                <div>Height: <span style="color:var(--cyan)">${bmpBytes[3]} px</span></div>
                <div>Depth: <span style="color:var(--emerald)">${bmpBytes[4]}-bit RGB</span></div>
                <div style="color:var(--text-muted);margin-top:4px">Total: 56 bytes</div>
              </div>
            </div>
          `;
          const grid = humanEl.querySelector('#m2-px-grid');
          for (let i = 0; i < 16; i++) {
            const off = 8 + i * 3;
            const r = bmpBytes[off], g = bmpBytes[off + 1], b = bmpBytes[off + 2];
            const px = document.createElement('div');
            px.className = 'pixel-cell';
            px.style.background = `rgb(${r},${g},${b})`;
            px.title = `Pixel #${i} @ offset 0x${hex2(off)}: RGB(${r},${g},${b})`;
            px.addEventListener('click', () => {
              // Find closest palette & advance
              let idx = PALETTE.findIndex((p) => p.rgb[0] === r && p.rgb[1] === g && p.rgb[2] === b);
              const next = PALETTE[(idx + 1) % PALETTE.length];
              bmpBytes[off] = next.rgb[0];
              bmpBytes[off + 1] = next.rgb[1];
              bmpBytes[off + 2] = next.rgb[2];
              renderHumanView();
              hexEditor.update({ bytes: bmpBytes });
              hexEditor.select(off);
              hexEditor.flash(off, 'write');
              hexEditor.flash(off + 1, 'write');
              hexEditor.flash(off + 2, 'write');
              setNarration(`Pixel #${i} changed to <strong>${next.name}</strong> → wrote 3 RGB bytes <code>${hex2(next.rgb[0])} ${hex2(next.rgb[1])} ${hex2(next.rgb[2])}</code> at offset <code>0x${hex2(off)}</code>.`);
            });
            grid.appendChild(px);
          }
        }
      }

      function renderInodes() {
        inodeRows.innerHTML = Object.entries(INODES).map(([key, info]) => {
          const active = key === activeFile;
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-radius:4px;background:${active ? 'rgba(56,189,248,0.14)' : 'transparent'};border:1px solid ${active ? info.color : 'transparent'}">
              <span style="color:${info.color};font-weight:700">${info.name}</span>
              <span style="color:var(--text-secondary)">Blocks: [${info.blocks.map((b) => '#' + b).join(' → ')}]</span>
            </div>
          `;
        }).join('');
      }

      function renderDisk() {
        const blocksOfActive = INODES[activeFile].blocks;
        const activeColor = INODES[activeFile].color;

        if (diskType === 'ssd') {
          let cells = '';
          for (let i = 0; i < 12; i++) {
            const belongsTxt = INODES.txt.blocks.includes(i);
            const belongsBmp = INODES.bmp.blocks.includes(i);
            const isReading = i === activeBlockHighlight;
            const bg = isReading
              ? '#f59e0b'
              : belongsTxt
                ? 'rgba(56,189,248,0.22)'
                : belongsBmp
                  ? 'rgba(167,139,250,0.22)'
                  : '#111a2b';
            const border = isReading
              ? '#fff'
              : belongsTxt
                ? '#38bdf8'
                : belongsBmp
                  ? '#a78bfa'
                  : '#24324a';
            const tag = belongsTxt ? 'txt' : belongsBmp ? 'bmp' : 'free';
            cells += `
              <div style="background:${bg};border:1.5px solid ${border};border-radius:6px;padding:10px 6px;text-align:center;font-family:var(--font-mono);transition:all 0.2s;${isReading ? 'transform:scale(1.06);box-shadow:0 0 14px #f59e0b;color:#090d14' : ''}">
                <div style="font-size:11px;font-weight:800">BLK #${i}</div>
                <div style="font-size:9.5px;opacity:0.8;margin-top:2px">${tag}</div>
              </div>
            `;
          }
          diskStage.innerHTML = `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%">${cells}</div>`;
          return;
        }

        // HDD SVG Platter with 12 sectors across 2 concentric tracks
        const cx = 130, cy = 105;
        let sectorsSvg = '';
        for (let i = 0; i < 12; i++) {
          const track = i < 6 ? 0 : 1; // 0 = outer, 1 = inner
          const slot = i % 6;
          const rOuter = track === 0 ? 84 : 52;
          const rInner = track === 0 ? 56 : 24;
          const a0 = (slot * 60 + platterAngle) * (Math.PI / 180);
          const a1 = ((slot * 60 + 54) + platterAngle) * (Math.PI / 180);
          const x1 = cx + rOuter * Math.cos(a0), y1 = cy + rOuter * Math.sin(a0);
          const x2 = cx + rOuter * Math.cos(a1), y2 = cy + rOuter * Math.sin(a1);
          const x3 = cx + rInner * Math.cos(a1), y3 = cy + rInner * Math.sin(a1);
          const x4 = cx + rInner * Math.cos(a0), y4 = cy + rInner * Math.sin(a0);

          const isTxt = INODES.txt.blocks.includes(i);
          const isBmp = INODES.bmp.blocks.includes(i);
          const isRead = i === activeBlockHighlight;
          const fill = isRead ? '#f59e0b' : isTxt ? 'rgba(56,189,248,0.32)' : isBmp ? 'rgba(167,139,250,0.32)' : '#121c2e';
          const stroke = isRead ? '#fff' : isTxt ? '#38bdf8' : isBmp ? '#a78bfa' : '#24324a';

          const midA = (a0 + a1) / 2;
          const midR = (rOuter + rInner) / 2;
          const tx = cx + midR * Math.cos(midA);
          const ty = cy + midR * Math.sin(midA);

          sectorsSvg += `
            <path d="M ${x1} ${y1} A ${rOuter} ${rOuter} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 0 0 ${x4} ${y4} Z" fill="${fill}" stroke="${stroke}" stroke-width="${isRead ? 2 : 1.2}"/>
            <text x="${tx}" y="${ty + 3}" text-anchor="middle" fill="${isRead ? '#090d14' : '#cbd5e1'}" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">#${i}</text>
          `;
        }

        // Actuator arm tip based on armTargetTrack (0 outer, 1 inner)
        const tipX = cx + (armTargetTrack === 0 ? 70 : 38);
        const tipY = cy + 6;
        diskStage.innerHTML = `
          <svg viewBox="0 0 280 210" width="100%" height="205">
            <circle cx="${cx}" cy="${cy}" r="90" fill="#0b1220" stroke="#334155" stroke-width="2"/>
            ${sectorsSvg}
            <circle cx="${cx}" cy="${cy}" r="18" fill="#1e293b" stroke="#475569" stroke-width="2"/>
            <circle cx="${cx}" cy="${cy}" r="6" fill="${activeColor}"/>
            <!-- Actuator Arm -->
            <line x1="255" y1="185" x2="${tipX}" y2="${tipY}" stroke="#f59e0b" stroke-width="5" stroke-linecap="round"/>
            <circle cx="255" cy="185" r="10" fill="#334155" stroke="#f59e0b" stroke-width="2"/>
            <circle cx="${tipX}" cy="${tipY}" r="4" fill="#fff"/>
          </svg>
        `;
      }

      function initHex() {
        const bytes = currentBytes();
        hexEditor = new HexEditor(hexMount, {
          bytes,
          baseAddr: 0,
          editable: true,
          legend: activeFile === 'txt'
            ? [{ label: 'ASCII Text', color: '#f59e0b' }, { label: 'Null / Padding', color: '#3d4f6b' }]
            : [{ label: 'BMP Header (Magic)', color: '#f59e0b' }, { label: 'RGB Pixel Data', color: '#a78bfa' }],
          getRegion: (addr, val) => {
            if (activeFile === 'txt') return val === 0 ? 'zero' : 'data';
            return addr < 8 ? 'header' : 'heap';
          },
          getRegionLabel: (addr) => {
            if (activeFile === 'txt') return txtBytes[addr] === 0 ? 'NULL' : 'ASCII';
            return addr < 8 ? 'HEADER' : `PIXEL #${Math.floor((addr - 8) / 3)}`;
          },
          onEdit: (addr, newVal) => {
            renderHumanView();
            setNarration(`Edited byte <code>0x${hex2(addr)}</code> → <code>0x${hex2(newVal)}</code> directly in Hex Editor — Human View updated instantly!`);
          }
        });
      }

      function switchFile(f) {
        activeFile = f;
        container.querySelector('#m2-f-txt').classList.toggle('active-tab', f === 'txt');
        container.querySelector('#m2-f-bmp').classList.toggle('active-tab', f === 'bmp');
        renderHumanView();
        renderInodes();
        initHex();
        renderDisk();
        setNarration(f === 'txt'
          ? 'Viewing <strong>hello.txt</strong>: plain ASCII text stored across scattered disk blocks <code>#1</code> and <code>#5</code>.'
          : 'Viewing <strong>icon.bmp</strong>: starts with magic header <code>42 4D ("BM")</code> followed by 3 RGB bytes per pixel!'
        );
      }

      container.querySelector('#m2-f-txt').addEventListener('click', () => switchFile('txt'));
      container.querySelector('#m2-f-bmp').addEventListener('click', () => switchFile('bmp'));

      container.querySelector('#m2-d-hdd').addEventListener('click', () => {
        diskType = 'hdd';
        container.querySelector('#m2-d-hdd').classList.add('active-tab');
        container.querySelector('#m2-d-ssd').classList.remove('active-tab');
        renderDisk();
        setNarration('<strong>HDD Mode:</strong> Data lives on magnetic tracks. Fragmented blocks force the read/write head to mechanically jump!');
      });

      container.querySelector('#m2-d-ssd').addEventListener('click', () => {
        diskType = 'ssd';
        container.querySelector('#m2-d-ssd').classList.add('active-tab');
        container.querySelector('#m2-d-hdd').classList.remove('active-tab');
        renderDisk();
        setNarration('<strong>SSD Mode:</strong> No moving parts — scattered NAND flash blocks are read electronically at near-instant speed!');
      });

      // Animate reading file blocks in sequence
      container.querySelector('#m2-read').addEventListener('click', () => {
        clearTimers();
        const info = INODES[activeFile];
        const stepDelay = diskType === 'hdd' ? 850 : 300;
        let totalMs = 0;

        info.blocks.forEach((blk, idx) => {
          const id = setTimeout(() => {
            activeBlockHighlight = blk;
            armTargetTrack = blk < 6 ? 0 : 1;
            totalMs += diskType === 'hdd' ? 4.8 : 0.05;
            seekMs.textContent = `${diskType.toUpperCase()}: ${totalMs.toFixed(2)} ms`;
            renderDisk();

            // Flash corresponding bytes in hex editor
            const startByte = idx * 16;
            const maxLen = currentBytes().length;
            for (let b = startByte; b < Math.min(startByte + 16, maxLen); b++) {
              hexEditor.flash(b, 'read');
            }
            setNarration(`Reading <strong>${info.name}</strong>: Inode #${info.inode} points to <strong>Block #${blk}</strong> (${diskType === 'hdd' ? 'seeking platter track...' : 'flash page hit!'}) → streaming bytes <code>0x${hex2(startByte)}–0x${hex2(Math.min(startByte + 15, maxLen - 1))}</code> into RAM.`);
          }, idx * stepDelay);
          timers.push(id);
        });

        timers.push(setTimeout(() => {
          activeBlockHighlight = -1;
          renderDisk();
          setNarration(`Finished reading <strong>${info.name}</strong> (${info.blocks.length} scattered blocks reassembled seamlessly in RAM!).`);
        }, info.blocks.length * stepDelay + 250));
      });

      // Gentle HDD platter rotation
      function tick() {
        if (diskType === 'hdd') {
          platterAngle = (platterAngle + 0.35) % 360;
          renderDisk();
        }
        rafId = requestAnimationFrame(tick);
      }

      switchFile('txt');
      rafId = requestAnimationFrame(tick);
    },

    destroy() {
      clearTimers();
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

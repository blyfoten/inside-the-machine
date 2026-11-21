import { observeBeats, setCaption, hex2 } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

const PALETTE = [
  { name: 'Slate', rgb: [241, 245, 249] },
  { name: 'Blue', rgb: [37, 99, 235] },
  { name: 'Amber', rgb: [217, 119, 6] },
  { name: 'Emerald', rgb: [5, 150, 105] },
  { name: 'Rose', rgb: [225, 29, 72] }
];

export function mountChapter2(section) {
  let activeFile = 'txt';
  let diskType = 'hdd';
  let activeBlock = -1;
  let hexEditor = null;

  const txtBytes = new Uint8Array(24);
  const initStr = 'Hello, CS!\0';
  for (let i = 0; i < initStr.length; i++) txtBytes[i] = initStr.charCodeAt(i);

  const bmpBytes = new Uint8Array(56);
  bmpBytes.set([0x42, 0x4D, 0x04, 0x04, 0x18, 0x00, 0x00, 0x00], 0);
  [0, 1, 1, 0, 1, 2, 2, 1, 1, 0, 0, 1, 0, 3, 3, 0].forEach((p, i) => {
    const [r, g, b] = PALETTE[p].rgb;
    bmpBytes[8 + i * 3] = r;
    bmpBytes[8 + i * 3 + 1] = g;
    bmpBytes[8 + i * 3 + 2] = b;
  });

  const INODES = {
    txt: { name: 'hello.txt', inode: 42, blocks: [1, 5], color: '#2563eb' },
    bmp: { name: 'icon.bmp', inode: 87, blocks: [2, 6, 9, 11], color: '#7c3aed' }
  };

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 02</div>
      <h2 class="chapter-title">What Is a File?</h2>
      <p class="chapter-lead">To a computer, a novel, a photo, an MP3 song, and an executable app are all the exact same thing: a numbered sequence of bytes (0–255). Only the program opening those bytes decides how to interpret them.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · What You See</div>
            <div class="beat-title">Human-Readable Content</div>
            <p class="beat-body">When you open <code>hello.txt</code>, your editor displays letters and punctuation. Under the hood, computers only store electrical switches that are OFF (<code>0</code>) or ON (<code>1</code>), grouped into 8-bit chunks called <strong>bytes</strong>.</p>
            <div class="beat-note"><strong>Try typing:</strong> Change the text inside the input box — each letter immediately maps to a standard <strong>ASCII</strong> code number (for example, capital <code>'H'</code> is always <code>72</code>).</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Peel Back the Curtain</div>
            <div class="beat-title">How a Hex Editor Works</div>
            <p class="beat-body">Binary strings like <code>01001000</code> are hard for humans to scan, so programmers use <strong>Hexadecimal (Base-16)</strong> — digits <code>0–9</code> and <code>A–F</code>. Two hex digits compactly represent 1 full byte (<code>00</code> to <code>FF</code>, i.e., 0 to 255).</p>
            <div class="beat-note"><strong>Reading the 3 columns:</strong> Left = byte address (<code>0x0000</code>), Middle = raw hex bytes (<code>48 65 6C...</code>), Right = printable ASCII preview. Click any byte to inspect or flip its individual <code>0/1</code> bits!</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · How Disks Store It</div>
            <div class="beat-title">Inodes &amp; Scattered Disk Blocks</div>
            <p class="beat-body">Disks are sliced into fixed-size storage chunks called <strong>blocks</strong> (typically 4 KB each). When you save a file, the operating system's filesystem records an <strong>Inode</strong> — an index card listing which blocks belong to that file, even if they are scattered across the disk.</p>
            <div class="beat-note"><strong>Why fragmentation slows HDDs:</strong> A spinning hard drive must physically swing its read head from block <code>#1</code> to <code>#5</code>, whereas an SSD jumps electronically in microseconds.</div>
          </div>
        </div>

        <div class="beat" data-beat="3">
          <div class="beat-card">
            <div class="beat-step">Step 4 · Complete File Lab</div>
            <div class="beat-title">Images Are Just Bytes Too</div>
            <p class="beat-body">Switch to <code>icon.bmp</code> below. Image files start with a <strong>Header</strong> — magic bytes <code>42 4D</code> (ASCII <code>"BM"</code>) plus width and height — followed by 3 bytes (Red, Green, Blue) for every single pixel.</p>
            <div class="beat-note"><strong>Experiment:</strong> Click any pixel in the 4×4 grid to watch its 3 RGB hex bytes flash — or flip a single bit in the Hex Editor to watch the pixel's color shift instantly!</div>
          </div>
        </div>
      </div>

      <!-- Sticky Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot"></span>
            <span id="c2-cap">Step 1: Viewing hello.txt as human text.</span>
          </div>
          <span class="pill pill-blue" id="c2-pill">hello.txt</span>
        </div>

        <div class="stage-canvas">
          <div class="grid-2" style="align-items:start">
            <!-- Part 1: Human View (always visible) -->
            <div class="subcard reveal-part visible" id="c2-human-card">
              <div class="subcard-head">
                <span class="subcard-title">1. Human View (Editable)</span>
                <span class="pill" id="c2-size-pill">24 bytes</span>
              </div>
              <div id="c2-human-body" style="display:flex;flex-direction:column;gap:10px"></div>
            </div>

            <!-- Part 2: Hex Editor (reveals at Beat 1) -->
            <div class="subcard reveal-part" id="c2-hex-card">
              <div class="subcard-head">
                <span class="subcard-title">2. Live Hex Editor (Raw Bytes)</span>
                <span class="pill pill-emerald">Click bits to flip</span>
              </div>
              <div id="c2-hex-mount"></div>
            </div>
          </div>

          <!-- Part 3: Physical Storage Blocks (reveals at Beat 2) -->
          <div class="subcard reveal-part" id="c2-disk-card">
            <div class="subcard-head">
              <span class="subcard-title">3. Physical Disk Blocks &amp; Inode Table</span>
              <span class="pill pill-amber" id="c2-inode-pill">Inode #42 → Blocks [#1 → #5]</span>
            </div>
            <div id="c2-disk-grid" style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px"></div>
          </div>
        </div>

        <div class="stage-dock dock-hidden" id="c2-dock">
          <button class="btn btn-sm active-tab" id="c2-f-txt">📄 hello.txt</button>
          <button class="btn btn-sm" id="c2-f-bmp">🖼️ icon.bmp (4×4)</button>
          <button class="btn btn-sm" id="c2-disk-toggle">Disk: HDD (Seek)</button>
          <button class="btn btn-primary btn-sm" id="c2-read-btn">▶ Animate Disk Read</button>
        </div>
      </div>
    </div>
  `;

  const cap = section.querySelector('#c2-cap');
  const filePill = section.querySelector('#c2-pill');
  const sizePill = section.querySelector('#c2-size-pill');
  const inodePill = section.querySelector('#c2-inode-pill');
  const humanBody = section.querySelector('#c2-human-body');
  const hexMount = section.querySelector('#c2-hex-mount');
  const diskGrid = section.querySelector('#c2-disk-grid');
  const dock = section.querySelector('#c2-dock');

  function currentBytes() {
    return activeFile === 'txt' ? txtBytes : bmpBytes;
  }

  function renderHuman() {
    const info = INODES[activeFile];
    filePill.textContent = info.name;
    sizePill.textContent = `${currentBytes().length} bytes`;
    inodePill.textContent = `Inode #${info.inode} → Blocks [${info.blocks.map((b) => '#' + b).join(' → ')}]`;

    if (activeFile === 'txt') {
      let str = '';
      for (let i = 0; i < txtBytes.length && txtBytes[i] !== 0; i++) str += String.fromCharCode(txtBytes[i]);
      humanBody.innerHTML = `
        <input type="text" class="text-live-input" id="c2-txt-in" maxlength="23" value="${str.replace(/"/g, '&quot;')}" />
        <div id="c2-chips" style="display:flex;flex-wrap:wrap;gap:5px"></div>
      `;
      const chips = humanBody.querySelector('#c2-chips');
      const drawChips = (s) => {
        chips.innerHTML = '';
        for (let i = 0; i < Math.min(12, s.length); i++) {
          const d = document.createElement('div');
          d.style.cssText = 'background:#fff;border:1px solid var(--border);border-radius:6px;padding:4px 7px;text-align:center;font-family:var(--font-mono);cursor:pointer;';
          d.innerHTML = `<div style="font-size:13px;font-weight:700">${s[i] === ' ' ? '␣' : s[i]}</div><div style="font-size:10px;color:var(--amber)">0x${hex2(txtBytes[i])}</div>`;
          d.addEventListener('click', () => hexEditor && hexEditor.select(i));
          chips.appendChild(d);
        }
      };
      drawChips(str);
      const inp = humanBody.querySelector('#c2-txt-in');
      inp.addEventListener('input', () => {
        txtBytes.fill(0);
        for (let i = 0; i < Math.min(23, inp.value.length); i++) txtBytes[i] = inp.value.charCodeAt(i) & 0x7f;
        drawChips(inp.value);
        if (hexEditor) hexEditor.update({ bytes: txtBytes });
        setCaption(cap, `Typed <code>"${inp.value}"</code> → ASCII hex bytes updated live!`);
      });
    } else {
      humanBody.innerHTML = `
        <div style="font-size:12px;color:var(--ink-secondary)">Header: <code>42 4D</code> ("BM") + 3 RGB bytes per pixel. Click a pixel:</div>
        <div class="pixel-grid-4" id="c2-px-grid"></div>
      `;
      const grid = humanBody.querySelector('#c2-px-grid');
      for (let i = 0; i < 16; i++) {
        const off = 8 + i * 3;
        const r = bmpBytes[off], g = bmpBytes[off + 1], b = bmpBytes[off + 2];
        const cell = document.createElement('div');
        cell.className = 'pixel-cell';
        cell.style.background = `rgb(${r},${g},${b})`;
        cell.addEventListener('click', () => {
          const cur = PALETTE.findIndex((p) => p.rgb[0] === r && p.rgb[1] === g && p.rgb[2] === b);
          const next = PALETTE[(cur + 1) % PALETTE.length];
          bmpBytes[off] = next.rgb[0];
          bmpBytes[off + 1] = next.rgb[1];
          bmpBytes[off + 2] = next.rgb[2];
          renderHuman();
          hexEditor.update({ bytes: bmpBytes });
          hexEditor.select(off);
          hexEditor.flash(off, 'write');
          setCaption(cap, `Pixel #${i} → <strong>${next.name}</strong> (wrote RGB <code>${hex2(next.rgb[0])} ${hex2(next.rgb[1])} ${hex2(next.rgb[2])}</code> at <code>0x${hex2(off)}</code>).`);
        });
        grid.appendChild(cell);
      }
    }
  }

  function renderDisk() {
    diskGrid.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const isTxt = INODES.txt.blocks.includes(i);
      const isBmp = INODES.bmp.blocks.includes(i);
      const isReading = i === activeBlock;
      const cell = document.createElement('div');
      cell.style.cssText = `
        padding: 7px 6px; border-radius: 8px; text-align: center; font-family: var(--font-mono);
        border: 1.5px solid ${isReading ? 'var(--amber)' : isTxt ? 'var(--blue-border)' : isBmp ? 'var(--violet-border)' : 'var(--border)'};
        background: ${isReading ? 'var(--amber)' : isTxt ? 'var(--blue-soft)' : isBmp ? 'var(--violet-soft)' : '#ffffff'};
        color: ${isReading ? '#fff' : isTxt ? 'var(--blue)' : isBmp ? 'var(--violet)' : 'var(--ink-muted)'};
        transition: all 0.2s; transform: ${isReading ? 'scale(1.06)' : 'none'};
      `;
      cell.innerHTML = `<div style="font-size:11px;font-weight:800">BLK #${i}</div><div style="font-size:9.5px">${isTxt ? 'hello.txt' : isBmp ? 'icon.bmp' : 'free'}</div>`;
      diskGrid.appendChild(cell);
    }
  }

  function initHex() {
    hexEditor = new HexEditor(hexMount, {
      bytes: currentBytes(),
      baseAddr: 0,
      editable: true,
      legend: activeFile === 'txt'
        ? [{ label: 'ASCII Text', color: '#d97706' }, { label: 'Null', color: '#cbd5e1' }]
        : [{ label: 'BMP Header', color: '#d97706' }, { label: 'RGB Pixels', color: '#7c3aed' }],
      getRegion: (addr, val) => (activeFile === 'txt' ? (val === 0 ? 'zero' : 'data') : (addr < 8 ? 'header' : 'heap')),
      getRegionLabel: (addr) => (activeFile === 'txt' ? (txtBytes[addr] === 0 ? 'NULL' : 'ASCII') : (addr < 8 ? 'HEADER' : `PX #${Math.floor((addr - 8) / 3)}`)),
      onEdit: (addr, val) => {
        renderHuman();
        setCaption(cap, `Flipped hex byte <code>0x${hex2(addr)}</code> → <code>0x${hex2(val)}</code> — Human View updated live!`);
      }
    });
  }

  function animateRead() {
    const blocks = INODES[activeFile].blocks;
    const stepMs = diskType === 'hdd' ? 680 : 240;
    blocks.forEach((blk, i) => {
      setTimeout(() => {
        activeBlock = blk;
        renderDisk();
        if (hexEditor) {
          for (let b = i * 8; b < Math.min(i * 8 + 8, currentBytes().length); b++) hexEditor.flash(b, 'read');
        }
        setCaption(cap, `Reading <strong>${INODES[activeFile].name}</strong>: ${diskType === 'hdd' ? 'HDD arm seeks' : 'SSD jumps'} to <strong>Block #${blk}</strong> → streaming bytes to RAM.`);
      }, i * stepMs);
    });
    setTimeout(() => {
      activeBlock = -1;
      renderDisk();
    }, blocks.length * stepMs + 250);
  }

  function switchFile(f) {
    activeFile = f;
    section.querySelector('#c2-f-txt').classList.toggle('active-tab', f === 'txt');
    section.querySelector('#c2-f-bmp').classList.toggle('active-tab', f === 'bmp');
    renderHuman();
    initHex();
    renderDisk();
  }

  section.querySelector('#c2-f-txt').addEventListener('click', () => switchFile('txt'));
  section.querySelector('#c2-f-bmp').addEventListener('click', () => switchFile('bmp'));
  section.querySelector('#c2-disk-toggle').addEventListener('click', (e) => {
    diskType = diskType === 'hdd' ? 'ssd' : 'hdd';
    e.target.textContent = diskType === 'hdd' ? 'Disk: HDD (Seek)' : 'Disk: SSD (Instant)';
    animateRead();
  });
  section.querySelector('#c2-read-btn').addEventListener('click', animateRead);

  switchFile('txt');

  observeBeats(section, (beatIdx) => {
    section.querySelector('#c2-hex-card').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c2-disk-card').classList.toggle('visible', beatIdx >= 2);
    dock.classList.toggle('dock-hidden', beatIdx < 3);

    if (beatIdx === 0) {
      setCaption(cap, '<strong>Step 1:</strong> Viewing <code>hello.txt</code> as letters — try editing the text.');
    } else if (beatIdx === 1) {
      setCaption(cap, '<strong>Step 2:</strong> Hex Editor revealed! Every character maps to a numeric byte (<code>\'H\' = 0x48</code>).');
      hexEditor.flash(0, 'read');
      hexEditor.flash(1, 'read');
    } else if (beatIdx === 2) {
      setCaption(cap, '<strong>Step 3:</strong> Filesystem Inode maps <code>hello.txt</code> to scattered disk blocks <code>#1 → #5</code>.');
      animateRead();
    } else {
      setCaption(cap, '<strong>Complete File Lab:</strong> Switch to <code>icon.bmp</code> or flip individual bits in the Hex Editor!');
    }
  });
}

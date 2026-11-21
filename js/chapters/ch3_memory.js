import { observeBeats, setCaption, hex4 } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

export function mountChapter3(section) {
  let mem = new Uint8Array(256);
  let stackFrames = [];
  let heapBlocks = [];
  let sp = 0x0100;
  let heapBreak = 0x0020;
  let hexEditor = null;
  let callCounter = 0;

  const WORDS = ['CAT', 'CPU', 'RAM', 'BIT', 'ASM'];

  function resetMem() {
    mem = new Uint8Array(256);
    mem.set([0x55, 0x48, 0x89, 0xE5, 0xB8, 0x2A, 0x00, 0x00, 0xE8, 0x04, 0x00, 0x00, 0x5D, 0xC3, 0x90, 0x90], 0x00);
    const s = 'HELLO!\0';
    for (let i = 0; i < s.length; i++) mem[0x10 + i] = s.charCodeAt(i);
    sp = 0x0100;
    heapBreak = 0x0020;
    stackFrames = [];
    heapBlocks = [];
    callCounter = 0;
  }

  function pushFrame(fnName, varName, val, ptrKind = null) {
    if (sp - 8 < heapBreak + 8) return;
    sp -= 8;
    mem[sp] = 0x00;
    mem[sp + 1] = 0x08;
    mem[sp + 2] = (val >> 8) & 0xff;
    mem[sp + 3] = val & 0xff;
    stackFrames.push({ id: `f-${Math.random().toString(36).slice(2)}`, fnName, varName, val, addr: sp, ptrKind });
  }

  function allocHeap() {
    if (heapBlocks.length >= 4) return null;
    const addr = heapBreak;
    const word = WORDS[heapBlocks.length % WORDS.length];
    for (let i = 0; i < 8; i++) mem[addr + i] = i < word.length ? word.charCodeAt(i) : 0;
    heapBlocks.push({ addr, text: word, freed: false });
    heapBreak += 8;
    pushFrame('alloc()', `ptr_${heapBlocks.length}`, addr, 'heap');
    return { addr, word };
  }

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 03</div>
      <h2 class="chapter-title">Stack, Heap &amp; Pointers</h2>
      <p class="chapter-lead">When you launch a program, the operating system hands it a private virtual address space — organized into distinct regions so code, temporary function variables, and dynamically sized data never collide.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · Static Foundation</div>
            <div class="beat-title">Code &amp; String Literals</div>
            <p class="beat-body">At the bottom (lowest addresses) sit two fixed sections loaded straight from your executable file: <code>.text</code> holds read-only machine instructions (<code>0x0000</code>), and <code>.rodata</code> holds compile-time constants like the null-terminated string <code>"HELLO!\0"</code> (<code>0x0010</code>).</p>
            <div class="beat-note"><strong>Why null-terminated?</strong> C strings end with a zero byte (<code>0x00</code>) so the CPU knows where the text stops in RAM without storing a separate length field.</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Automatic &amp; Fast</div>
            <div class="beat-title">The Stack Grows Downward (↓)</div>
            <p class="beat-body">Every time a function is called, the CPU carves out a neat <strong>Stack Frame</strong> from the top of memory (<code>0x00FF</code>) downward, sliding the <strong>Stack Pointer (<code>SP</code>)</strong> lower to hold its return address and local variables.</p>
            <div class="beat-note"><strong>Why it's effortless:</strong> Returning from a function simply moves <code>SP</code> back up in 1 single clock cycle. If recursion never stops and <code>SP</code> runs out of room, you get a <strong>Stack Overflow</strong>!</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Dynamic Memory</div>
            <div class="beat-title">The Heap Grows Upward (↑) + Pointers</div>
            <p class="beat-body">What if you don't know how much data you'll need until runtime (like loading a user's photo)? You call <code>malloc()</code> to request a block on the <strong>Heap</strong>, which grows upward from the opposite end of memory so both regions share the open space in the middle.</p>
            <div class="beat-note"><strong>What is a Pointer?</strong> Nothing magical — it is literally just a variable on the Stack storing the numeric address (<code>0x0020</code>) of a block on the Heap, shown here by the curved violet arrow.</div>
          </div>
        </div>

        <div class="beat" data-beat="3">
          <div class="beat-card">
            <div class="beat-step">Step 4 · Complete Memory + Hex View</div>
            <div class="beat-title">Inspect Raw RAM &amp; Dangling Pointers</div>
            <p class="beat-body">The <strong>Live RAM Hex Editor</strong> now opens beside the visual map so you can see the exact bytes of Stack frames (emerald), Heap blocks (violet), and strings (amber) in one unified address space.</p>
            <div class="beat-note"><strong>Try a classic C bug:</strong> Click <strong>+ malloc()</strong>, then click <strong>✕ free() Block</strong> — notice how the Stack pointer still holds <code>0x0020</code> and turns red. That is a <strong>Dangling Pointer</strong>!</div>
          </div>
        </div>
      </div>

      <!-- Sticky Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot" style="background:var(--emerald)"></span>
            <span id="c3-cap">Step 1: Static Code &amp; Strings sit at the bottom of RAM.</span>
          </div>
          <div style="display:flex;gap:6px">
            <span class="pill pill-emerald" id="c3-sp-pill">SP: 0x0100</span>
            <span class="pill pill-violet" id="c3-hb-pill">Heap: 0x0020</span>
          </div>
        </div>

        <div class="stage-canvas">
          <div class="grid-2" style="align-items:start;flex:1">
            <!-- Left: Virtual Memory Map -->
            <div style="position:relative" id="c3-map-wrap">
              <svg id="c3-arrows" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5"></svg>
              <div class="mem-stack-layout">
                <!-- Stack (Beat 1+) -->
                <div class="mem-region-box reveal-part" id="c3-reg-stack" style="border-color:var(--emerald-border)">
                  <div style="display:flex;justify-content:space-between;font-size:11px">
                    <strong style="color:var(--emerald)">STACK (Grows ↓)</strong>
                    <span class="mono" style="color:var(--ink-muted)">0x00FF</span>
                  </div>
                  <div id="c3-stack-list"></div>
                </div>

                <!-- Gap -->
                <div id="c3-gap" style="text-align:center;padding:8px;border:1px dashed var(--border-strong);border-radius:8px;font-family:var(--font-mono);font-size:10.5px;color:var(--ink-muted)">
                  ↕ FREE SPACE ↕
                </div>

                <!-- Heap (Beat 2+) -->
                <div class="mem-region-box reveal-part" id="c3-reg-heap" style="border-color:var(--violet-border)">
                  <div style="display:flex;justify-content:space-between;font-size:11px">
                    <strong style="color:var(--violet)">HEAP (Grows ↑)</strong>
                    <span class="mono" style="color:var(--ink-muted)">0x0020+</span>
                  </div>
                  <div id="c3-heap-list" style="display:flex;flex-direction:column-reverse"></div>
                </div>

                <!-- Static Data + Code (Beat 0+) -->
                <div class="mem-region-box" style="border-color:var(--amber-border)">
                  <div style="display:flex;justify-content:space-between;font-size:11px">
                    <strong style="color:var(--amber)">.RODATA (Strings)</strong>
                    <span class="mono" style="color:var(--ink-muted)">0x0010</span>
                  </div>
                  <div class="mem-slot data-slot" id="c3-rodata">
                    <span>0x0010: <strong>"HELLO!\0"</strong></span>
                    <span>7 bytes</span>
                  </div>
                </div>

                <div class="mem-region-box" style="border-color:var(--blue-border)">
                  <div style="display:flex;justify-content:space-between;font-size:11px">
                    <strong style="color:var(--blue)">.TEXT (Machine Code)</strong>
                    <span class="mono" style="color:var(--ink-muted)">0x0000</span>
                  </div>
                  <div class="mono" style="font-size:10px;color:var(--ink-muted);margin-top:2px">55 48 89 E5 B8 2A 00 00 ...</div>
                </div>
              </div>
            </div>

            <!-- Right: Live RAM Hex Editor (reveals at Beat 3) -->
            <div class="subcard reveal-part" id="c3-hex-card">
              <div class="subcard-head">
                <span class="subcard-title">Live RAM Hex Editor</span>
                <span class="pill pill-blue">Synced Live</span>
              </div>
              <div id="c3-hex-mount"></div>
            </div>
          </div>
        </div>

        <div class="stage-dock dock-hidden" id="c3-dock">
          <button class="btn btn-emerald btn-sm" id="c3-call">+ Call Function (Push ↓)</button>
          <button class="btn btn-sm" id="c3-ret">− Return (Pop ↑)</button>
          <button class="btn btn-violet btn-sm" id="c3-malloc">+ malloc() (Heap ↑)</button>
          <button class="btn btn-rose btn-sm" id="c3-free">✕ free() Block</button>
          <button class="btn btn-ghost btn-sm" id="c3-reset">↺ Reset</button>
        </div>
      </div>
    </div>
  `;

  const cap = section.querySelector('#c3-cap');
  const spPill = section.querySelector('#c3-sp-pill');
  const hbPill = section.querySelector('#c3-hb-pill');
  const stackList = section.querySelector('#c3-stack-list');
  const heapList = section.querySelector('#c3-heap-list');
  const gapEl = section.querySelector('#c3-gap');
  const mapWrap = section.querySelector('#c3-map-wrap');
  const arrowsSvg = section.querySelector('#c3-arrows');
  const dock = section.querySelector('#c3-dock');

  function getRows() {
    const rows = new Set([0x00, 0x10, 0x20, 0x28, 0xF0, 0xF8]);
    for (let a = 0x20; a < Math.min(0x50, heapBreak + 8); a += 8) rows.add(a);
    for (let a = Math.max(0xD8, sp - 8); a <= 0xF8; a += 8) rows.add(a);
    return Array.from(rows).sort((a, b) => a - b);
  }

  function getRegion(addr) {
    if (addr < 0x10) return 'code';
    if (addr < 0x20) return 'data';
    if (addr < heapBreak) return 'heap';
    if (addr >= sp) return 'stack';
    return 'zero';
  }

  resetMem();
  hexEditor = new HexEditor(section.querySelector('#c3-hex-mount'), {
    bytes: mem,
    baseAddr: 0,
    rowAddresses: getRows(),
    editable: false,
    spAddr: sp < 0x100 ? sp : null,
    legend: [
      { label: 'Code', color: '#2563eb' },
      { label: 'Strings', color: '#d97706' },
      { label: 'Heap ↑', color: '#7c3aed' },
      { label: 'Stack ↓', color: '#059669' }
    ],
    getRegion,
    getRegionLabel: (a) => (getRegion(a) === 'zero' ? 'FREE' : getRegion(a).toUpperCase())
  });

  function drawArrows() {
    const wr = mapWrap.getBoundingClientRect();
    if (wr.width === 0) return;
    arrowsSvg.setAttribute('viewBox', `0 0 ${wr.width} ${mapWrap.offsetHeight}`);
    arrowsSvg.style.height = `${mapWrap.offsetHeight}px`;
    arrowsSvg.innerHTML = `
      <defs>
        <marker id="c3-arr-v" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#7c3aed"/></marker>
        <marker id="c3-arr-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#d97706"/></marker>
        <marker id="c3-arr-r" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#e11d48"/></marker>
      </defs>
    `;
    let cIdx = 0;
    for (const f of stackFrames) {
      if (!f.ptrKind) continue;
      const src = section.querySelector(`[data-c3-f="${f.id}"]`);
      const dst = f.ptrKind === 'rodata'
        ? section.querySelector('#c3-rodata')
        : section.querySelector(`[data-c3-h="${f.val}"]`);
      if (!src || !dst) continue;
      const blk = heapBlocks.find((b) => b.addr === f.val);
      const freed = blk && blk.freed;
      const color = f.ptrKind === 'rodata' ? '#d97706' : freed ? '#e11d48' : '#7c3aed';
      const marker = f.ptrKind === 'rodata' ? 'c3-arr-a' : freed ? 'c3-arr-r' : 'c3-arr-v';

      const r1 = src.getBoundingClientRect();
      const r2 = dst.getBoundingClientRect();
      const x1 = r1.right - wr.left + 2;
      const y1 = r1.top - wr.top + r1.height / 2;
      const x2 = r2.right - wr.left + 4;
      const y2 = r2.top - wr.top + r2.height / 2;
      const bulge = Math.min(wr.width - 8, Math.max(x1, x2) + 22 + cIdx * 8);
      cIdx++;

      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', `M ${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2} ${y2}`);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', color);
      p.setAttribute('stroke-width', '2');
      if (freed) p.setAttribute('stroke-dasharray', '4 3');
      p.setAttribute('marker-end', `url(#${marker})`);
      arrowsSvg.appendChild(p);
    }
  }

  function renderAll(flashAddrs = []) {
    spPill.textContent = `SP: ${hex4(sp)}`;
    hbPill.textContent = `Heap: ${hex4(heapBreak)}`;

    stackList.innerHTML = stackFrames.length === 0
      ? `<div style="font-size:11px;color:var(--ink-muted);padding:3px 0">Empty stack</div>`
      : stackFrames.map((f, i) => {
          const blk = f.ptrKind === 'heap' ? heapBlocks.find((b) => b.addr === f.val) : null;
          const dang = blk && blk.freed;
          const v = f.ptrKind ? `${hex4(f.val)}${dang ? ' ⚠' : ' ↗'}` : f.val;
          return `
            <div class="mem-slot stack-frame" data-c3-f="${f.id}" style="${dang ? 'border-color:var(--rose);color:var(--rose);background:var(--rose-soft)' : ''}">
              <span>${i === stackFrames.length - 1 ? '<strong>SP→</strong> ' : ''}${hex4(f.addr)} ${f.fnName}</span>
              <span>${f.varName}=<strong>${v}</strong></span>
            </div>
          `;
        }).join('');

    heapList.innerHTML = heapBlocks.length === 0
      ? `<div style="font-size:11px;color:var(--ink-muted);padding:3px 0">No heap blocks yet</div>`
      : heapBlocks.map((b) => `
          <div class="mem-slot ${b.freed ? 'heap-freed' : 'heap-block'}" data-c3-h="${b.addr}">
            <span>${hex4(b.addr)} [8B]</span>
            <span>${b.freed ? 'FREED' : `"${b.text}\\0"`}</span>
          </div>
        `).join('');

    gapEl.textContent = `↕ FREE SPACE (${Math.max(0, sp - heapBreak)} bytes) ↕`;
    hexEditor.update({ bytes: mem, rowAddresses: getRows(), spAddr: sp < 0x100 ? sp : null });
    flashAddrs.forEach((a) => hexEditor.flash(a, 'write'));
    requestAnimationFrame(drawArrows);
  }

  section.querySelector('#c3-call').addEventListener('click', () => {
    if (stackFrames.length >= 5) return;
    callCounter++;
    pushFrame(['compute()', 'parse()', 'draw()'][callCounter % 3], 'x', callCounter * 11, null);
    renderAll([sp, sp + 1, sp + 2, sp + 3]);
    setCaption(cap, `Pushed stack frame → <code>SP</code> decreased to <code>${hex4(sp)}</code> (grows downward ↓).`);
  });

  section.querySelector('#c3-ret').addEventListener('click', () => {
    if (stackFrames.length <= 1) return;
    stackFrames.pop();
    sp += 8;
    renderAll();
    setCaption(cap, `Function returned → <code>SP</code> moved back up to <code>${hex4(sp)}</code>!`);
  });

  section.querySelector('#c3-malloc').addEventListener('click', () => {
    const res = allocHeap();
    if (!res) return;
    renderAll([res.addr, res.addr + 1, res.addr + 2]);
    setCaption(cap, `<code>malloc(8)</code> grew Heap upward to <code>${hex4(res.addr)}</code> (<code>"${res.word}\\0"</code>) + saved pointer on Stack!`);
  });

  section.querySelector('#c3-free').addEventListener('click', () => {
    const live = [...heapBlocks].reverse().find((b) => !b.freed);
    if (!live) return;
    live.freed = true;
    renderAll([live.addr]);
    setCaption(cap, `Freed <code>${hex4(live.addr)}</code> — notice the Stack pointer turned <strong style="color:var(--rose)">red (Dangling Pointer!)</strong>.`);
  });

  section.querySelector('#c3-reset').addEventListener('click', () => {
    resetMem();
    pushFrame('main()', 'msg', 0x0010, 'rodata');
    renderAll();
    setCaption(cap, 'Memory reset to initial state.');
  });

  // Scroll beats build the memory layout progressively!
  observeBeats(section, (beatIdx) => {
    section.querySelector('#c3-reg-stack').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c3-reg-heap').classList.toggle('visible', beatIdx >= 2);
    section.querySelector('#c3-hex-card').classList.toggle('visible', beatIdx >= 3);
    dock.classList.toggle('dock-hidden', beatIdx < 3);

    if (beatIdx === 0) {
      resetMem();
      renderAll();
      setCaption(cap, '<strong>Step 1:</strong> Static Code (<code>0x0000</code>) and String <code>"HELLO!\\0"</code> (<code>0x0010</code>) anchor low memory.');
    } else if (beatIdx === 1) {
      resetMem();
      pushFrame('main()', 'msg', 0x0010, 'rodata');
      pushFrame('compute()', 'x', 42, null);
      renderAll([sp, sp + 2]);
      setCaption(cap, '<strong>Step 2:</strong> Functions push frames <strong>downward (↓)</strong> from <code>0x00FF</code> as <code>SP</code> shrinks.');
    } else if (beatIdx === 2) {
      if (heapBlocks.length === 0) {
        resetMem();
        pushFrame('main()', 'msg', 0x0010, 'rodata');
        allocHeap();
      }
      renderAll([0x20, 0x21, 0x22]);
      setCaption(cap, '<strong>Step 3:</strong> <code>malloc()</code> grows the <strong>Heap upward (↑)</strong> — linked by a curved <strong>Pointer Arrow</strong>!');
    } else {
      if (heapBlocks.length === 0) {
        resetMem();
        pushFrame('main()', 'msg', 0x0010, 'rodata');
        allocHeap();
      }
      renderAll();
      setCaption(cap, '<strong>Complete Memory Setup:</strong> RAM Hex Editor is live beside the map — try pushing, allocating &amp; freeing!');
    }
  });
}

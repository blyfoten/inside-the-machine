import { setNarration, hex4, flyPacket } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

export function createModule3() {
  let mem = new Uint8Array(256);
  let stackFrames = [];
  let heapBlocks = [];
  let sp = 0x0100; // grows downward from 0x0100 -> 0x00F8 -> 0x00F0...
  let heapBreak = 0x0020; // grows upward from 0x0020 -> 0x0028...
  let hexEditor = null;
  let callCounter = 0;

  const SAMPLE_WORDS = ['CAT', 'CPU', 'RAM', 'BIT', 'ASM'];

  function resetState() {
    mem = new Uint8Array(256);
    // Code segment (0x0000 - 0x000F)
    mem.set([0x55, 0x48, 0x89, 0xE5, 0xB8, 0x2A, 0x00, 0x00, 0xE8, 0x04, 0x00, 0x00, 0x5D, 0xC3, 0x90, 0x90], 0x00);
    // .rodata String literal "HELLO!\0" at 0x0010
    const s = 'HELLO!\0';
    for (let i = 0; i < s.length; i++) mem[0x10 + i] = s.charCodeAt(i);
    mem[0x18] = 42; // global int g = 42

    sp = 0x0100;
    heapBreak = 0x0020;
    stackFrames = [];
    heapBlocks = [];
    callCounter = 0;

    // Push main() frame initially
    pushFrame('main()', 'msg_ptr', 0x0010, 'rodata');
  }

  function pushFrame(fnName, varName, val, ptrTargetKind = null) {
    if (sp - 8 < heapBreak + 8) return false;
    sp -= 8;
    // Write fake return addr + local var into memory
    mem[sp] = 0x00;
    mem[sp + 1] = 0x08; // return addr
    mem[sp + 2] = (val >> 8) & 0xff;
    mem[sp + 3] = val & 0xff;
    // Label bytes lightly
    stackFrames.push({
      id: `sf-${Date.now()}-${Math.random()}`,
      fnName,
      varName,
      val,
      addr: sp,
      ptrTargetKind // 'heap' | 'rodata' | null
    });
    return true;
  }

  return {
    init(container) {
      resetState();

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <button class="btn btn-emerald btn-sm" id="m3-call">+ Call Function (Push Stack ↓)</button>
            <button class="btn btn-sm" id="m3-ret">− Return (Pop Stack ↑)</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <button class="btn btn-violet btn-sm" id="m3-malloc">+ malloc() (Grow Heap ↑)</button>
            <button class="btn btn-coral btn-sm" id="m3-free">✕ free() Last Heap Block</button>
          </div>
          <div class="toolbar-divider"></div>
          <button class="btn btn-ghost btn-sm" id="m3-reset">↺ Reset Memory</button>
        </div>

        <div class="grid-main-side">
          <!-- Left: Visual Process Memory Map (High addr top -> Low addr bottom) -->
          <div class="card" style="overflow:hidden">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--emerald)"></span>Virtual Memory Map (Stack ↓ meets Heap ↑)</div>
              <div style="display:flex;gap:6px">
                <span class="pill pill-emerald" id="m3-sp-pill">SP: 0x00F8</span>
                <span class="pill pill-violet" id="m3-hb-pill">Heap Top: 0x0020</span>
              </div>
            </div>

            <div style="position:relative;flex:1;overflow-y:auto" id="m3-map-wrap">
              <svg id="m3-arrows" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5"></svg>

              <div class="mem-stack-layout">
                <!-- HIGH ADDRESS: STACK -->
                <div class="mem-region-box" style="border-color:rgba(52,211,153,0.45);background:rgba(52,211,153,0.05)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--emerald);font-weight:800;font-size:11.5px">STACK (High Memory — Grows DOWNWARD ↓)</span>
                    <span class="mono" style="font-size:10.5px;color:var(--text-muted)">0x00FF</span>
                  </div>
                  <div id="m3-stack-list"></div>
                </div>

                <!-- FREE SPACE GAP -->
                <div style="text-align:center;padding:12px 8px;border:1px dashed #293b57;border-radius:8px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px" id="m3-gap-box">
                  ↕ FREE UNALLOCATED SPACE (216 bytes) ↕
                </div>

                <!-- HEAP -->
                <div class="mem-region-box" style="border-color:rgba(167,139,250,0.45);background:rgba(167,139,250,0.05)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--violet);font-weight:800;font-size:11.5px">HEAP (Dynamic Memory — Grows UPWARD ↑)</span>
                    <span class="mono" style="font-size:10.5px;color:var(--text-muted)">0x0020+</span>
                  </div>
                  <div id="m3-heap-list" style="display:flex;flex-direction:column-reverse"></div>
                </div>

                <!-- STATIC DATA / STRINGS -->
                <div class="mem-region-box" style="border-color:rgba(245,158,11,0.4);background:rgba(245,158,11,0.05)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--amber);font-weight:800;font-size:11.5px">.RODATA / DATA (Strings &amp; Globals)</span>
                    <span class="mono" style="font-size:10.5px;color:var(--text-muted)">0x0010</span>
                  </div>
                  <div class="mem-slot data-slot" id="m3-rodata-slot">
                    <span>0x0010: <strong>"HELLO!\0"</strong></span>
                    <span style="opacity:0.8">7 bytes ASCII</span>
                  </div>
                </div>

                <!-- CODE / TEXT -->
                <div class="mem-region-box" style="border-color:rgba(56,189,248,0.4);background:rgba(56,189,248,0.05)">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="color:var(--cyan);font-weight:800;font-size:11.5px">.TEXT (Compiled Machine Code)</span>
                    <span class="mono" style="font-size:10.5px;color:var(--text-muted)">0x0000</span>
                  </div>
                  <div class="mono" style="font-size:10.5px;color:var(--text-secondary);margin-top:3px">55 48 89 E5 B8 2A 00 00 ... (read-only instructions)</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Live Synchronized Hex Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>Live RAM Hex Editor</div>
              <span class="pill pill-cyan">Click bytes to inspect</span>
            </div>
            <div id="m3-hex-mount" style="flex:1;display:flex;flex-direction:column"></div>
            <div style="background:#0a0f18;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-size:11.5px;color:var(--text-secondary)">
              <strong>Pointer Rule:</strong> A pointer is <em>not</em> magic — it is literally just a number (like <code>0x0020</code>) stored in one memory cell that tells the CPU the <strong>address</strong> of another memory cell!
            </div>
          </div>
        </div>
      `;

      const stackList = container.querySelector('#m3-stack-list');
      const heapList = container.querySelector('#m3-heap-list');
      const gapBox = container.querySelector('#m3-gap-box');
      const spPill = container.querySelector('#m3-sp-pill');
      const hbPill = container.querySelector('#m3-hb-pill');
      const arrowsSvg = container.querySelector('#m3-arrows');
      const mapWrap = container.querySelector('#m3-map-wrap');
      const hexMount = container.querySelector('#m3-hex-mount');

      function getRowAddresses() {
        // Show 0x0000..heapBreak+8 (low memory) AND sp-8..0x00F8 (high memory stack)
        const rows = new Set([0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30]);
        for (let a = 0x20; a < Math.min(0x80, heapBreak + 8); a += 8) rows.add(a);
        for (let a = Math.max(0xC0, sp - 8); a <= 0xF8; a += 8) rows.add(a);
        return Array.from(rows).sort((a, b) => a - b);
      }

      function getRegion(addr) {
        if (addr < 0x10) return 'code';
        if (addr < 0x20) return 'data';
        if (addr < heapBreak) return 'heap';
        if (addr >= sp) return 'stack';
        return 'zero';
      }

      hexEditor = new HexEditor(hexMount, {
        bytes: mem,
        baseAddr: 0,
        rowAddresses: getRowAddresses(),
        editable: true,
        spAddr: sp,
        legend: [
          { label: 'Code', color: '#38bdf8' },
          { label: 'Strings', color: '#f59e0b' },
          { label: 'Heap ↑', color: '#a78bfa' },
          { label: 'Stack ↓', color: '#34d399' }
        ],
        getRegion,
        getRegionLabel: (addr) => {
          const r = getRegion(addr);
          return r === 'zero' ? 'FREE' : r.toUpperCase();
        },
        onEdit: (addr, val) => {
          setNarration(`Directly edited RAM at <code>${hex4(addr)}</code> to <code>0x${val.toString(16).toUpperCase().padStart(2, '0')}</code>!`);
        }
      });

      function drawPointerArrows() {
        const wrapRect = mapWrap.getBoundingClientRect();
        arrowsSvg.setAttribute('viewBox', `0 0 ${wrapRect.width} ${mapWrap.scrollHeight}`);
        arrowsSvg.style.height = `${mapWrap.scrollHeight}px`;
        arrowsSvg.innerHTML = `
          <defs>
            <marker id="arr-violet" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa"/>
            </marker>
            <marker id="arr-amber" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b"/>
            </marker>
            <marker id="arr-coral" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#fb7185"/>
            </marker>
          </defs>
        `;

        let curveIdx = 0;
        for (const frame of stackFrames) {
          if (!frame.ptrTargetKind) continue;
          const srcEl = container.querySelector(`[data-frame-id="${frame.id}"]`);
          let dstEl = null;
          let color = '#a78bfa';
          let marker = 'arr-violet';

          if (frame.ptrTargetKind === 'rodata') {
            dstEl = container.querySelector('#m3-rodata-slot');
            color = '#f59e0b';
            marker = 'arr-amber';
          } else if (frame.ptrTargetKind === 'heap') {
            const blk = heapBlocks.find((b) => b.addr === frame.val);
            dstEl = container.querySelector(`[data-heap-addr="${frame.val}"]`);
            if (blk && blk.freed) {
              color = '#fb7185';
              marker = 'arr-coral';
            }
          }

          if (!srcEl || !dstEl) continue;
          const r1 = srcEl.getBoundingClientRect();
          const r2 = dstEl.getBoundingClientRect();
          const x1 = r1.right - wrapRect.left + 2;
          const y1 = r1.top - wrapRect.top + mapWrap.scrollTop + r1.height / 2;
          const x2 = r2.right - wrapRect.left + 3;
          const y2 = r2.top - wrapRect.top + mapWrap.scrollTop + r2.height / 2;
          const bulge = Math.min(wrapRect.width - 8, Math.max(x1, x2) + 22 + curveIdx * 8);
          curveIdx++;

          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d', `M ${x1} ${y1} C ${bulge} ${y1}, ${bulge} ${y2}, ${x2} ${y2}`);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', color);
          path.setAttribute('stroke-width', '2.2');
          if (marker === 'arr-coral') path.setAttribute('stroke-dasharray', '5 3');
          path.setAttribute('marker-end', `url(#${marker})`);
          arrowsSvg.appendChild(path);
        }
      }

      function renderAll(flashAddrs = [], flashMode = 'write') {
        spPill.textContent = `SP: ${hex4(sp)}`;
        hbPill.textContent = `Heap Top: ${hex4(heapBreak)}`;

        // Stack frames (newest at bottom of stack box so it visually grows DOWN!)
        stackList.innerHTML = stackFrames.map((f, idx) => {
          const isTop = idx === stackFrames.length - 1;
          const blk = f.ptrTargetKind === 'heap' ? heapBlocks.find((b) => b.addr === f.val) : null;
          const dangling = blk && blk.freed;
          const valDisp = f.ptrTargetKind ? `${hex4(f.val)}${dangling ? ' ⚠ DANGLING!' : ' ↗'}` : String(f.val);
          return `
            <div class="mem-slot stack-frame" data-frame-id="${f.id}" style="${dangling ? 'border-color:var(--coral);' : ''}">
              <span>${isTop ? '<strong style="color:var(--emerald)">SP→</strong> ' : ''}${hex4(f.addr)} <strong>${f.fnName}</strong></span>
              <span>${f.varName} = <strong style="color:${dangling ? 'var(--coral)' : f.ptrTargetKind ? '#c4b5fd' : '#fff'}">${valDisp}</strong></span>
            </div>
          `;
        }).join('');

        // Heap blocks (column-reverse so newest grows UP!)
        if (heapBlocks.length === 0) {
          heapList.innerHTML = `<div style="font-size:11px;color:var(--text-muted);padding:4px 2px">No heap allocations yet — click <strong>+ malloc()</strong>!</div>`;
        } else {
          heapList.innerHTML = heapBlocks.map((b) => `
            <div class="mem-slot ${b.freed ? 'heap-freed' : 'heap-block'}" data-heap-addr="${b.addr}">
              <span>${hex4(b.addr)} [8 bytes]</span>
              <span>${b.freed ? 'FREED (stale)' : `"${b.text}\\0"`}</span>
            </div>
          `).join('');
        }

        const freeBytes = Math.max(0, sp - heapBreak);
        gapBox.textContent = `↕ FREE UNALLOCATED SPACE (${freeBytes} bytes between Heap & Stack) ↕`;

        hexEditor.update({
          bytes: mem,
          rowAddresses: getRowAddresses(),
          spAddr: sp
        });
        flashAddrs.forEach((a) => hexEditor.flash(a, flashMode));

        requestAnimationFrame(drawPointerArrows);
      }

      // Push Stack Frame
      container.querySelector('#m3-call').addEventListener('click', () => {
        if (stackFrames.length >= 6) {
          setNarration('<strong style="color:var(--coral)">Stack Limit Reached!</strong> In real programs, infinite recursion causes a <strong>Stack Overflow</strong> when SP collides with the Heap/guard page.');
          return;
        }
        callCounter++;
        const fns = ['compute()', 'parse()', 'helper()', 'draw()', 'recurse()'];
        const fnName = fns[(callCounter - 1) % fns.length];
        const localVal = callCounter * 11;
        pushFrame(fnName, 'x', localVal, null);
        renderAll([sp, sp + 1, sp + 2, sp + 3], 'write');
        const cell = hexEditor.getCellEl(sp);
        flyPacket(container.querySelector('#m3-call'), cell, `PUSH ${fnName}`, { color: '#34d399' });
        setNarration(`Called <code>${fnName}</code>: <strong>SP decreased</strong> to <code>${hex4(sp)}</code> (Stack grows DOWNWARD) and pushed local <code>x = ${localVal}</code>.`);
      });

      // Pop Stack Frame
      container.querySelector('#m3-ret').addEventListener('click', () => {
        if (stackFrames.length <= 1) {
          setNarration('Cannot pop <code>main()</code> — returning from main exits the program!');
          return;
        }
        const popped = stackFrames.pop();
        sp += 8;
        renderAll([popped.addr], 'read');
        setNarration(`Returned from <code>${popped.fnName}</code>: <strong>SP moved back UP</strong> to <code>${hex4(sp)}</code>. Notice the old bytes stay in RAM until overwritten!`);
      });

      // malloc()
      container.querySelector('#m3-malloc').addEventListener('click', () => {
        if (heapBlocks.length >= 5) {
          setNarration('Heap demo full! Try calling <code>free()</code> or resetting memory.');
          return;
        }
        const addr = heapBreak;
        const word = SAMPLE_WORDS[heapBlocks.length % SAMPLE_WORDS.length];
        for (let i = 0; i < 8; i++) mem[addr + i] = i < word.length ? word.charCodeAt(i) : 0;
        heapBlocks.push({ addr, text: word, freed: false });
        heapBreak += 8;

        // Also store a pointer on the Stack pointing to this Heap address!
        pushFrame('alloc()', `ptr_${heapBlocks.length}`, addr, 'heap');
        renderAll([addr, addr + 1, addr + 2, sp + 2, sp + 3], 'write');
        const heapCell = hexEditor.getCellEl(addr);
        flyPacket(container.querySelector('#m3-malloc'), heapCell, `"${word}" @ ${hex4(addr)}`, { color: '#a78bfa' });
        setNarration(`<code>malloc(8)</code> grew the <strong>Heap UPWARD</strong> to <code>${hex4(addr)}</code> (storing <code>"${word}\\0"</code>) and saved pointer <code>${hex4(addr)}</code> on the Stack!`);
      });

      // free()
      container.querySelector('#m3-free').addEventListener('click', () => {
        const live = [...heapBlocks].reverse().find((b) => !b.freed);
        if (!live) {
          setNarration('No allocated Heap blocks left to free! Click <strong>+ malloc()</strong> first.');
          return;
        }
        live.freed = true;
        renderAll([live.addr], 'read');
        setNarration(`Called <code>free(${hex4(live.addr)})</code>! The Heap block is released — notice the Stack pointer now points to freed memory (<strong style="color:var(--coral)">Dangling Pointer!</strong>).`);
      });

      // Reset
      container.querySelector('#m3-reset').addEventListener('click', () => {
        resetState();
        renderAll();
        setNarration('Memory reset. Notice <strong>.rodata</strong> string <code>"HELLO!\\0"</code> at <code>0x0010</code> and <code>main()</code> on the Stack at <code>0x00F8</code>.');
      });

      renderAll();
      setNarration('Watch how the <strong>Stack grows DOWNWARD ↓</strong> from high addresses while the <strong>Heap grows UPWARD ↑</strong> from low addresses — connected by <strong>Pointer</strong> arrows!');
    },

    destroy() {}
  };
}

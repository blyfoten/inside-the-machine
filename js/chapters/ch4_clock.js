import { observeBeats, setCaption, hex4, flyPacket } from '../components/animator.js';

const PROG = [
  { addr: 0x0000, asm: 'MOV R0, #6', op: '0001', dst: '00', src: '00', imm: '00000110', hex: '10 06', type: 'imm', rDst: 0, val: 6 },
  { addr: 0x0002, asm: 'LOAD R1, [0x40]', op: '0010', dst: '01', src: '00', imm: '01000000', hex: '24 40', type: 'load', rDst: 1, val: 9 },
  { addr: 0x0004, asm: 'ADD R2, R0, R1', op: '0011', dst: '10', src: '01', imm: '00000000', hex: '39 00', type: 'add', rDst: 2, rA: 0, rB: 1 },
  { addr: 0x0006, asm: 'JMP 0x0000', op: '1111', dst: '00', src: '00', imm: '00000000', hex: 'F0 00', type: 'jmp', target: 0 }
];

export function mountChapter4(section) {
  let cycle = 0;
  let ip = 0;
  let phase = 0; // 0 Fetch, 1 Decode, 2 Exec, 3 Write
  let stalls = 0;
  let latMode = 'ram';
  let regs = [0, 0, 0, 0];
  let wave = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  let autoTimer = null;

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 04</div>
      <h2 class="chapter-title">Clock Cycles, Registers &amp; Latency</h2>
      <p class="chapter-lead">A crystal oscillator ticks billions of times per second like a metronome. Every rising edge moves an instruction one notch forward through Fetch, Decode, Execute, and Writeback.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · The Heartbeat</div>
            <div class="beat-title">The System Clock</div>
            <p class="beat-body">A 4 GHz CPU receives 4 billion electrical square-wave pulses every single second. Inside the chip, millions of tiny transistors flip in lockstep on every rising edge — keeping electricity synchronized across the whole processor.</p>
            <div class="beat-note"><strong>Key idea:</strong> One full high-to-low pulse is 1 <strong>Clock Cycle</strong> (~0.25 nanoseconds on a modern laptop).</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Fetch &amp; Decode</div>
            <div class="beat-title">Program Counter &amp; Binary Bits</div>
            <p class="beat-body">The <strong>Program Counter (<code>PC</code>)</strong> always holds the memory address of the next instruction. During <strong>FETCH</strong>, the CPU copies those raw bytes from RAM into the <strong>Instruction Register (<code>IR</code>)</strong>; during <strong>DECODE</strong>, hardware wires split the bits into <code>OPCODE</code> (what to do), <code>DST</code>, <code>SRC</code>, and <code>IMM</code> (constant/address).</p>
            <div class="beat-note"><strong>Look right:</strong> Machine code <code>10 06</code> splits cleanly into <code>0001</code> (MOV), <code>00</code> (R0), and <code>00000110</code> (the number 6).</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Execute &amp; Writeback</div>
            <div class="beat-title">Registers &amp; The ALU</div>
            <p class="beat-body">During <strong>EXECUTE</strong>, values flow out of the <strong>Register File</strong> (<code>R0–R3</code>) straight into the <strong>ALU</strong> (Arithmetic Logic Unit) to add, subtract, or compare. On <strong>WRITEBACK</strong>, the result is latched back into the destination register and <code>PC</code> advances to the next instruction.</p>
            <div class="beat-note"><strong>Why registers first?</strong> The ALU can only compute on numbers already sitting inside CPU registers — never directly inside RAM or Disk.</div>
          </div>
        </div>

        <div class="beat" data-beat="3">
          <div class="beat-card">
            <div class="beat-step">Step 4 · Complete CPU Clock Lab</div>
            <div class="beat-title">Feel Memory &amp; Disk Stalls</div>
            <p class="beat-body">When an instruction needs data from outside the CPU (like <code>LOAD R1, [0x40]</code>), the processor has to pause — called a <strong>Memory Stall</strong> — wasting clock cycles waiting for the bytes to arrive across the bus.</p>
            <div class="beat-note"><strong>Experiment:</strong> Toggle <strong>L1 (1 cyc)</strong> vs <strong>RAM (4 cyc)</strong> vs <strong>Disk (8 cyc)</strong> below and click <strong>Auto-Clock</strong> to watch the clock line turn rose red during stalls!</div>
          </div>
        </div>
      </div>

      <!-- Sticky Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot" style="background:var(--amber)"></span>
            <span id="c4-cap">Step 1: Every clock pulse steps the CPU forward.</span>
          </div>
          <span class="pill pill-amber" id="c4-cyc-pill">Cycle #0</span>
        </div>

        <div class="stage-canvas">
          <!-- Part 1: Clock Wave (Beat 0+) -->
          <div class="subcard reveal-part visible" style="flex-direction:row;align-items:center;justify-content:space-between;padding:10px 14px">
            <span class="subcard-title">1. Clock Signal</span>
            <svg id="c4-wave" viewBox="0 0 420 30" width="380" height="28" style="flex:1;max-width:440px"></svg>
            <span class="pill pill-blue" id="c4-phase-pill">READY</span>
          </div>

          <!-- Part 2: RAM + IR Bit Decoder (Beat 1+) -->
          <div class="grid-2 reveal-part" id="c4-part-fd">
            <div class="subcard">
              <div class="subcard-head">
                <span class="subcard-title">2. Program in RAM</span>
                <span class="pill pill-blue" id="c4-pc-pill">PC: 0x0000</span>
              </div>
              <div class="code-pane" id="c4-ram-list"></div>
            </div>

            <div class="subcard" id="c4-ir-card">
              <div class="subcard-head">
                <span class="subcard-title">Instruction Register (IR)</span>
                <span class="mono" style="font-size:11px;color:var(--amber);font-weight:700" id="c4-ir-hex">-- --</span>
              </div>
              <div style="display:grid;grid-template-columns:1.1fr 0.65fr 0.65fr 1.8fr;gap:5px;text-align:center;font-family:var(--font-mono)">
                <div style="background:var(--blue-soft);border:1px solid var(--blue-border);border-radius:6px;padding:6px 4px">
                  <div style="font-size:9px;color:var(--blue);font-weight:700">OPCODE</div>
                  <div id="c4-b-op" style="font-size:12px;font-weight:800">----</div>
                </div>
                <div style="background:var(--emerald-soft);border:1px solid var(--emerald-border);border-radius:6px;padding:6px 4px">
                  <div style="font-size:9px;color:var(--emerald);font-weight:700">DST</div>
                  <div id="c4-b-dst" style="font-size:12px;font-weight:800">--</div>
                </div>
                <div style="background:var(--violet-soft);border:1px solid var(--violet-border);border-radius:6px;padding:6px 4px">
                  <div style="font-size:9px;color:var(--violet);font-weight:700">SRC</div>
                  <div id="c4-b-src" style="font-size:12px;font-weight:800">--</div>
                </div>
                <div style="background:var(--amber-soft);border:1px solid var(--amber-border);border-radius:6px;padding:6px 4px">
                  <div style="font-size:9px;color:var(--amber);font-weight:700">IMM / ADDR</div>
                  <div id="c4-b-imm" style="font-size:12px;font-weight:800">--------</div>
                </div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:4px" id="c4-phases">
                <div class="phase-chip" data-p="0">FETCH</div>
                <div class="phase-chip" data-p="1">DECODE</div>
                <div class="phase-chip" data-p="2">EXEC</div>
                <div class="phase-chip" data-p="3">WRITE</div>
              </div>
            </div>
          </div>

          <!-- Part 3: Registers + ALU (Beat 2+) -->
          <div class="grid-2 reveal-part" id="c4-part-ex">
            <div class="subcard">
              <div class="subcard-head">
                <span class="subcard-title">3. Register File (~0.3 ns)</span>
                <span class="pill pill-emerald">[0x40] = 9</span>
              </div>
              <div class="reg-grid">
                <div class="reg-box" id="c4-r0"><span class="reg-name">R0</span><span class="reg-val">0</span></div>
                <div class="reg-box" id="c4-r1"><span class="reg-name">R1</span><span class="reg-val">0</span></div>
                <div class="reg-box" id="c4-r2"><span class="reg-name">R2</span><span class="reg-val">0</span></div>
                <div class="reg-box" id="c4-r3"><span class="reg-name">R3</span><span class="reg-val">0</span></div>
              </div>
            </div>

            <div class="alu-box" id="c4-alu" style="display:flex;flex-direction:column;justify-content:center">
              <div style="font-size:10px;color:var(--ink-muted);font-weight:700">ALU EXECUTION UNIT</div>
              <div id="c4-alu-expr" style="font-size:18px;font-weight:800;color:var(--blue);margin-top:4px">IDLE</div>
              <div id="c4-alu-sub" style="font-size:11.5px;color:var(--ink-secondary);margin-top:2px">Waiting for clock edge</div>
            </div>
          </div>
        </div>

        <div class="stage-dock dock-hidden" id="c4-dock">
          <button class="btn btn-primary btn-sm" id="c4-tick">⚡ Tick 1 Clock</button>
          <button class="btn btn-emerald btn-sm" id="c4-auto">▶ Auto-Clock</button>
          <button class="btn btn-sm" id="c4-lat-l1">L1 (1 cyc)</button>
          <button class="btn btn-sm active-tab" id="c4-lat-ram">RAM (4 cyc)</button>
          <button class="btn btn-sm" id="c4-lat-disk">Disk (8 cyc)</button>
        </div>
      </div>
    </div>
  `;

  const cap = section.querySelector('#c4-cap');
  const waveSvg = section.querySelector('#c4-wave');
  const cycPill = section.querySelector('#c4-cyc-pill');
  const phasePill = section.querySelector('#c4-phase-pill');
  const pcPill = section.querySelector('#c4-pc-pill');
  const ramList = section.querySelector('#c4-ram-list');
  const aluBox = section.querySelector('#c4-alu');
  const aluExpr = section.querySelector('#c4-alu-expr');
  const aluSub = section.querySelector('#c4-alu-sub');
  const dock = section.querySelector('#c4-dock');
  const autoBtn = section.querySelector('#c4-auto');

  function drawWave() {
    let d = '';
    const w = 34;
    for (let i = 0; i < wave.length; i++) {
      const x = 6 + i * w;
      const y = wave[i] ? 5 : 25;
      d += (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`) + ` L ${x + w} ${y}`;
    }
    waveSvg.innerHTML = `
      <path d="${d}" fill="none" stroke="${stalls > 0 ? '#e11d48' : '#d97706'}" stroke-width="2.2"/>
      <circle cx="${6 + wave.length * w}" cy="${wave[wave.length - 1] ? 5 : 25}" r="4" fill="${stalls > 0 ? '#e11d48' : '#2563eb'}"/>
    `;
  }

  function renderUI(hlReg = -1) {
    const ins = PROG[ip];
    cycPill.textContent = `Cycle #${cycle}`;
    pcPill.textContent = `PC: ${hex4(ins.addr)}`;
    const names = ['FETCH', 'DECODE', 'EXECUTE', 'WRITEBACK'];
    phasePill.textContent = stalls > 0 ? `STALL (${stalls})` : cycle === 0 ? 'READY' : names[(phase + 3) % 4];
    phasePill.className = stalls > 0 ? 'pill pill-rose' : 'pill pill-blue';

    ramList.innerHTML = PROG.map((item, i) => `
      <div class="code-line${i === ip ? ' active-asm' : ''}" id="c4-ins-${i}">
        <span class="code-addr">${hex4(item.addr)}</span>
        <span class="code-bytes">${item.hex}</span>
        <span>${item.asm}</span>
      </div>
    `).join('');

    const activeP = cycle === 0 ? -1 : (phase + 3) % 4;
    section.querySelectorAll('#c4-phases .phase-chip').forEach((ch) => {
      const p = Number(ch.dataset.p);
      ch.className = 'phase-chip';
      if (p === activeP) ch.classList.add(p === 0 ? 'active-fetch' : p === 1 ? 'active-decode' : 'active-execute');
    });

    for (let r = 0; r < 4; r++) {
      const box = section.querySelector(`#c4-r${r}`);
      box.querySelector('.reg-val').textContent = String(regs[r]);
      box.classList.toggle('changed', hlReg === r);
    }
    drawWave();
  }

  function tick(silent = false) {
    cycle++;
    wave.push(wave[wave.length - 1] ? 0 : 1);
    if (wave.length > 12) wave.shift();

    const ins = PROG[ip];
    if (stalls > 0) {
      stalls--;
      aluBox.classList.remove('firing');
      aluExpr.textContent = 'STALLING...';
      aluSub.textContent = `Waiting on ${latMode.toUpperCase()} (${stalls} cycles left)`;
      renderUI();
      if (!silent) setCaption(cap, `<strong>Cycle #${cycle} (MEMORY STALL):</strong> CPU waits idly for slow <strong>${latMode.toUpperCase()}</strong>!`);
      if (stalls === 0) phase = 3;
      return;
    }

    if (phase === 0) {
      section.querySelector('#c4-ir-hex').textContent = ins.hex;
      section.querySelector('#c4-b-op').textContent = '????';
      section.querySelector('#c4-b-dst').textContent = '??';
      section.querySelector('#c4-b-src').textContent = '??';
      section.querySelector('#c4-b-imm').textContent = '????????';
      aluExpr.textContent = `FETCH ${hex4(ins.addr)}`;
      aluSub.textContent = `Loading ${ins.hex} into IR`;
      aluBox.classList.remove('firing');
      phase = 1;
      renderUI();
      if (!silent) {
        flyPacket(section.querySelector(`#c4-ins-${ip}`), section.querySelector('#c4-ir-card'), ins.hex, { color: '#2563eb' });
        setCaption(cap, `<strong>Cycle #${cycle} (FETCH):</strong> Loaded <code>${ins.hex}</code> from <code>${hex4(ins.addr)}</code> into IR.`);
      }
    } else if (phase === 1) {
      section.querySelector('#c4-b-op').textContent = ins.op;
      section.querySelector('#c4-b-dst').textContent = ins.dst;
      section.querySelector('#c4-b-src').textContent = ins.src;
      section.querySelector('#c4-b-imm').textContent = ins.imm;
      aluExpr.textContent = ins.asm;
      aluSub.textContent = 'Control unit decoded instruction bits';
      phase = 2;
      renderUI();
      if (!silent) setCaption(cap, `<strong>Cycle #${cycle} (DECODE):</strong> Binary bits decoded → <code>${ins.asm}</code>.`);
    } else if (phase === 2) {
      aluBox.classList.add('firing');
      if (ins.type === 'load') {
        const s = latMode === 'l1' ? 0 : latMode === 'ram' ? 3 : 7;
        aluExpr.textContent = 'READ [0x0040]';
        aluSub.textContent = s === 0 ? 'L1 Cache Hit! Instant.' : `Cache miss → fetching from ${latMode.toUpperCase()}...`;
        if (s > 0) {
          stalls = s;
          renderUI();
          if (!silent) setCaption(cap, `<strong>Cycle #${cycle} (LOAD):</strong> Fetching from <strong>${latMode.toUpperCase()}</strong> — CPU will stall ${s} cycles!`);
          return;
        }
      } else if (ins.type === 'add') {
        aluExpr.textContent = `${regs[ins.rA]} + ${regs[ins.rB]} = ${regs[ins.rA] + regs[ins.rB]}`;
        aluSub.textContent = 'ALU adder computes sum';
      } else if (ins.type === 'imm') {
        aluExpr.textContent = `CONST #${ins.val}`;
        aluSub.textContent = 'Routing immediate value';
      } else {
        aluExpr.textContent = 'PC ← 0x0000';
        aluSub.textContent = 'Looping back to start';
      }
      phase = 3;
      renderUI();
      if (!silent) setCaption(cap, `<strong>Cycle #${cycle} (EXECUTE):</strong> Running <code>${ins.asm}</code>.`);
    } else {
      aluBox.classList.remove('firing');
      let hl = -1;
      if (ins.type === 'imm' || ins.type === 'load') {
        regs[ins.rDst] = ins.val;
        hl = ins.rDst;
        ip = (ip + 1) % PROG.length;
      } else if (ins.type === 'add') {
        regs[ins.rDst] = regs[ins.rA] + regs[ins.rB];
        hl = ins.rDst;
        ip = (ip + 1) % PROG.length;
      } else {
        ip = ins.target;
      }
      phase = 0;
      aluExpr.textContent = 'WRITEBACK ✓';
      aluSub.textContent = `Next PC → ${hex4(PROG[ip].addr)}`;
      renderUI(hl);
      if (!silent) {
        if (hl >= 0) flyPacket(aluBox, section.querySelector(`#c4-r${hl}`), String(regs[hl]), { color: '#d97706' });
        setCaption(cap, `<strong>Cycle #${cycle} (WRITEBACK):</strong> Latched result &amp; advanced <code>PC</code> to <code>${hex4(PROG[ip].addr)}</code>.`);
      }
    }
  }

  section.querySelector('#c4-tick').addEventListener('click', () => tick(false));
  autoBtn.addEventListener('click', () => {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
      autoBtn.textContent = '▶ Auto-Clock';
    } else {
      autoBtn.textContent = '⏸ Pause';
      tick(false);
      autoTimer = setInterval(() => tick(false), 680);
    }
  });

  ['l1', 'ram', 'disk'].forEach((m) => {
    const btn = section.querySelector(`#c4-lat-${m}`);
    btn.addEventListener('click', () => {
      latMode = m;
      ['l1', 'ram', 'disk'].forEach((x) => section.querySelector(`#c4-lat-${x}`).classList.toggle('active-tab', x === m));
      setCaption(cap, `Switched LOAD memory tier to <strong>${m.toUpperCase()}</strong>.`);
    });
  });

  renderUI();

  observeBeats(section, (beatIdx) => {
    section.querySelector('#c4-part-fd').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c4-part-ex').classList.toggle('visible', beatIdx >= 2);
    dock.classList.toggle('dock-hidden', beatIdx < 3);

    if (beatIdx === 0) {
      setCaption(cap, '<strong>Step 1:</strong> Watch the square-wave clock signal — every rising edge advances the CPU.');
    } else if (beatIdx === 1) {
      if (cycle < 2) { tick(true); tick(false); }
      setCaption(cap, '<strong>Step 2:</strong> <code>PC</code> fetched <code>10 06</code> from RAM and decoded its 16 binary bits!');
    } else if (beatIdx === 2) {
      while (cycle < 4) tick(true);
      setCaption(cap, '<strong>Step 3:</strong> Registers &amp; ALU appeared — <code>R0</code> now holds <strong>6</strong>!');
    } else {
      setCaption(cap, '<strong>Complete Clock Lab:</strong> Tick the clock or switch L1 / RAM / Disk latency to feel stalls!');
    }
  });
}

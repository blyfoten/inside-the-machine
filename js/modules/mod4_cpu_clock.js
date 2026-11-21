import { setNarration, hex2, hex4, flyPacket } from '../components/animator.js';

const MINI_PROGRAM = [
  { addr: 0x0000, asm: 'MOV R0, #6', op: '0001', dst: '00', src: '00', imm: '00000110', hex: '10 06', desc: 'Load constant 6 into R0', type: 'imm', rDst: 0, val: 6 },
  { addr: 0x0002, asm: 'LOAD R1, [0x40]', op: '0010', dst: '01', src: '00', imm: '01000000', hex: '24 40', desc: 'Read value (9) from Memory/Disk [0x40] into R1', type: 'load', rDst: 1, memAddr: 0x40, val: 9 },
  { addr: 0x0004, asm: 'ADD R2, R0, R1', op: '0011', dst: '10', src: '01', imm: '00000000', hex: '39 00', desc: 'ALU adds R0 + R1 and writes sum to R2', type: 'add', rDst: 2, rA: 0, rB: 1 },
  { addr: 0x0006, asm: 'STORE [0x44], R2', op: '0100', dst: '10', src: '00', imm: '01000100', hex: '48 44', desc: 'Store R2 result back to Memory [0x44]', type: 'store', rSrc: 2, memAddr: 0x44 },
  { addr: 0x0008, asm: 'JMP 0x0000', op: '1111', dst: '00', src: '00', imm: '00000000', hex: 'F0 00', desc: 'Reset PC back to 0x0000 to loop', type: 'jmp', target: 0 }
];

const PHASES = ['FETCH', 'DECODE', 'EXECUTE', 'WRITEBACK'];

export function createModule4() {
  let cycleCount = 0;
  let ipIndex = 0;
  let phaseIndex = 0; // 0..3
  let stallRemaining = 0;
  let latencyMode = 'ram'; // 'l1' (0 stall) | 'ram' (3 stalls) | 'disk' (8 stalls)
  let regs = [0, 0, 0, 0];
  let mem40 = 9;
  let mem44 = 0;
  let autoTimer = null;
  let clockHistory = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1];
  let speedMs = 700;

  function stopAuto(btn) {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (btn) btn.textContent = '▶ Auto-Clock';
  }

  function resetState() {
    cycleCount = 0;
    ipIndex = 0;
    phaseIndex = 0;
    stallRemaining = 0;
    regs = [0, 0, 0, 0];
    mem40 = 9;
    mem44 = 0;
  }

  return {
    init(container) {
      resetState();

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <button class="btn btn-primary" id="m4-tick">⚡ Tick 1 Clock Cycle</button>
            <button class="btn btn-emerald" id="m4-auto">▶ Auto-Clock</button>
            <button class="btn btn-ghost" id="m4-reset">↺ Reset</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <span style="font-size:11.5px;color:var(--text-muted)">LOAD Latency:</span>
            <button class="btn btn-sm" id="m4-lat-l1">L1 Cache (1 cyc)</button>
            <button class="btn btn-sm active-tab" id="m4-lat-ram">RAM (4 cyc)</button>
            <button class="btn btn-sm" id="m4-lat-disk">Disk (9 cyc)</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <span style="font-size:11px;color:var(--text-muted)">Clock Speed:</span>
            <input type="range" id="m4-speed" min="220" max="1200" value="700" style="width:90px" />
          </div>
        </div>

        <!-- Clock Oscilloscope Banner -->
        <div class="card" style="padding:8px 14px;flex-direction:row;align-items:center;justify-content:space-between;gap:14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="pill pill-amber" id="m4-cyc-pill">CLOCK CYCLE #0</span>
            <span class="pill pill-cyan" id="m4-phase-pill">READY</span>
          </div>
          <svg id="m4-clock-svg" viewBox="0 0 460 32" width="420" height="30" style="flex:1;max-width:520px"></svg>
          <span class="mono" style="font-size:11px;color:var(--text-muted)">Rising Edge ↑ = Hardware Steps</span>
        </div>

        <div class="grid-3" style="flex:1">
          <!-- Left: Program in RAM -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>RAM (Instructions + Data)</div>
              <span class="pill pill-cyan" id="m4-pc-pill">PC → 0x0000</span>
            </div>
            <div class="code-pane" id="m4-ram-code"></div>

            <div style="border-top:1px solid var(--border);padding-top:8px">
              <div style="font-size:10.5px;color:var(--text-muted);margin-bottom:5px;font-weight:700">DATA MEMORY CELLS</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div class="reg-box" id="m4-mem40">
                  <span class="reg-name">[0x0040]</span>
                  <span class="reg-val" style="color:var(--emerald)">9</span>
                </div>
                <div class="reg-box" id="m4-mem44">
                  <span class="reg-name">[0x0044]</span>
                  <span class="reg-val" style="color:var(--amber)">0</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Center: Inside the CPU (Control Unit, IR Bit Decoder, ALU) -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>CPU Core Internals</div>
              <span class="pill" id="m4-stall-pill" style="display:none">STALLING...</span>
            </div>

            <!-- 4-Phase Pipeline Strip -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px" id="m4-phases">
              <div class="phase-chip" data-p="0">1. FETCH</div>
              <div class="phase-chip" data-p="1">2. DECODE</div>
              <div class="phase-chip" data-p="2">3. EXEC</div>
              <div class="phase-chip" data-p="3">4. WRITE</div>
            </div>

            <!-- Instruction Register (IR) Binary Bit Breakdown -->
            <div style="background:#090e17;border:1px solid var(--border);border-radius:8px;padding:10px" id="m4-ir-box">
              <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--text-muted);margin-bottom:6px">
                <span>INSTRUCTION REGISTER (IR — 16-bit Machine Code)</span>
                <span class="mono" style="color:var(--amber)" id="m4-ir-hex">-- --</span>
              </div>
              <div style="display:grid;grid-template-columns:1.2fr 0.7fr 0.7fr 2fr;gap:5px;text-align:center;font-family:var(--font-mono)" id="m4-ir-bits">
                <div style="background:rgba(56,189,248,0.14);border:1px solid rgba(56,189,248,0.4);border-radius:5px;padding:5px">
                  <div style="font-size:9px;color:var(--cyan)">OPCODE</div>
                  <div id="bit-op" style="font-size:13px;font-weight:800;color:#fff">----</div>
                </div>
                <div style="background:rgba(52,211,153,0.14);border:1px solid rgba(52,211,153,0.4);border-radius:5px;padding:5px">
                  <div style="font-size:9px;color:var(--emerald)">DST</div>
                  <div id="bit-dst" style="font-size:13px;font-weight:800;color:#fff">--</div>
                </div>
                <div style="background:rgba(167,139,250,0.14);border:1px solid rgba(167,139,250,0.4);border-radius:5px;padding:5px">
                  <div style="font-size:9px;color:var(--violet)">SRC</div>
                  <div id="bit-src" style="font-size:13px;font-weight:800;color:#fff">--</div>
                </div>
                <div style="background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.4);border-radius:5px;padding:5px">
                  <div style="font-size:9px;color:var(--amber)">IMMEDIATE / ADDR</div>
                  <div id="bit-imm" style="font-size:13px;font-weight:800;color:#fff">--------</div>
                </div>
              </div>
            </div>

            <!-- ALU -->
            <div class="alu-box" id="m4-alu">
              <div style="font-size:10px;color:var(--text-muted);letter-spacing:0.08em">ARITHMETIC LOGIC UNIT (ALU)</div>
              <div id="m4-alu-expr" style="font-size:18px;font-weight:800;color:var(--cyan);margin-top:4px">IDLE</div>
              <div id="m4-alu-sub" style="font-size:11px;color:var(--text-secondary);margin-top:2px">Waiting for EXECUTE cycle</div>
            </div>
          </div>

          <!-- Right: Register File + Memory Tier Indicator -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--emerald)"></span>CPU Register File</div>
              <span class="pill pill-emerald">0.3 ns access</span>
            </div>

            <div class="reg-grid">
              <div class="reg-box" id="m4-reg-pc">
                <span class="reg-name" style="color:var(--cyan)">PC</span>
                <span class="reg-val">0x0000</span>
              </div>
              <div class="reg-box" id="m4-reg-ir">
                <span class="reg-name" style="color:var(--amber)">IR</span>
                <span class="reg-val">0x0000</span>
              </div>
              <div class="reg-box" id="m4-reg-0">
                <span class="reg-name">R0</span>
                <span class="reg-val">0</span>
              </div>
              <div class="reg-box" id="m4-reg-1">
                <span class="reg-name">R1</span>
                <span class="reg-val">0</span>
              </div>
              <div class="reg-box" id="m4-reg-2">
                <span class="reg-name">R2</span>
                <span class="reg-val">0</span>
              </div>
              <div class="reg-box" id="m4-reg-3">
                <span class="reg-name">R3</span>
                <span class="reg-val">0</span>
              </div>
            </div>

            <!-- Memory Stall Visualizer -->
            <div style="margin-top:auto;background:#0a0f18;border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:10.5px;color:var(--text-muted);font-weight:700">WHY CACHE MATTERS (ON LOAD):</div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px">
                <span style="color:var(--emerald)">L1 Cache Hit</span>
                <span class="mono">0 stall cycles</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px">
                <span style="color:var(--cyan)">RAM Fetch</span>
                <span class="mono">3 stall cycles (demo)</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:11.5px">
                <span style="color:var(--coral)">Disk Fetch</span>
                <span class="mono">8 stall cycles (demo)</span>
              </div>
            </div>
          </div>
        </div>
      `;

      const clockSvg = container.querySelector('#m4-clock-svg');
      const ramCodeEl = container.querySelector('#m4-ram-code');
      const cycPill = container.querySelector('#m4-cyc-pill');
      const phasePill = container.querySelector('#m4-phase-pill');
      const pcPill = container.querySelector('#m4-pc-pill');
      const stallPill = container.querySelector('#m4-stall-pill');
      const aluBox = container.querySelector('#m4-alu');
      const aluExpr = container.querySelector('#m4-alu-expr');
      const aluSub = container.querySelector('#m4-alu-sub');
      const autoBtn = container.querySelector('#m4-auto');

      function drawClockWave() {
        let d = '';
        const stepW = 36;
        for (let i = 0; i < clockHistory.length; i++) {
          const x = 10 + i * stepW;
          const y = clockHistory[i] ? 6 : 26;
          if (i === 0) {
            d += `M ${x} ${y}`;
          } else {
            d += ` L ${x} ${y}`;
          }
          d += ` L ${x + stepW} ${y}`;
        }
        clockSvg.innerHTML = `
          <path d="${d}" fill="none" stroke="${stallRemaining > 0 ? '#fb7185' : '#f59e0b'}" stroke-width="2.2" stroke-linejoin="miter"/>
          <circle cx="${10 + clockHistory.length * stepW}" cy="${clockHistory[clockHistory.length - 1] ? 6 : 26}" r="4" fill="#fff"/>
        `;
      }

      function renderUI(highlight = {}) {
        const instr = MINI_PROGRAM[ipIndex];
        cycPill.textContent = `CLOCK CYCLE #${cycleCount}`;
        pcPill.textContent = `PC → ${hex4(instr.addr)}`;
        phasePill.textContent = stallRemaining > 0
          ? `STALL (waiting ${stallRemaining} cyc)`
          : cycleCount === 0 ? 'READY' : PHASES[(phaseIndex + 3) % 4];

        stallPill.style.display = stallRemaining > 0 ? '' : 'none';
        stallPill.className = 'pill pill-coral';
        stallPill.textContent = `⏳ MEMORY STALL (${stallRemaining})`;

        // Render RAM code list
        ramCodeEl.innerHTML = MINI_PROGRAM.map((ins, i) => `
          <div class="code-line${i === ipIndex ? ' active-asm' : ''}" id="m4-ins-${i}">
            <span class="code-addr">${hex4(ins.addr)}</span>
            <span class="code-bytes">${ins.hex}</span>
            <span style="flex:1">${ins.asm}</span>
          </div>
        `).join('');

        // Phase chips
        const activeP = cycleCount === 0 ? -1 : (phaseIndex + 3) % 4;
        container.querySelectorAll('#m4-phases .phase-chip').forEach((ch) => {
          const p = Number(ch.dataset.p);
          ch.className = 'phase-chip';
          if (p === activeP) {
            ch.classList.add(p === 0 ? 'active-fetch' : p === 1 ? 'active-decode' : 'active-execute');
          }
        });

        // Registers
        container.querySelector('#m4-reg-pc .reg-val').textContent = hex4(instr.addr);
        for (let r = 0; r < 4; r++) {
          const box = container.querySelector(`#m4-reg-${r}`);
          box.querySelector('.reg-val').textContent = String(regs[r]);
          box.classList.toggle('changed', highlight.writeReg === r);
          box.classList.toggle('read-hit', highlight.readRegs && highlight.readRegs.includes(r));
        }

        const m40 = container.querySelector('#m4-mem40');
        const m44 = container.querySelector('#m4-mem44');
        m40.querySelector('.reg-val').textContent = String(mem40);
        m44.querySelector('.reg-val').textContent = String(mem44);
        m40.classList.toggle('read-hit', Boolean(highlight.readMem40));
        m44.classList.toggle('changed', Boolean(highlight.writeMem44));

        drawClockWave();
      }

      function tickCycle() {
        cycleCount++;
        clockHistory.push(clockHistory[clockHistory.length - 1] ? 0 : 1);
        if (clockHistory.length > 12) clockHistory.shift();

        const instr = MINI_PROGRAM[ipIndex];
        const phase = phaseIndex;

        // If stalling during a LOAD EXECUTE
        if (stallRemaining > 0) {
          stallRemaining--;
          aluBox.classList.remove('firing');
          aluExpr.textContent = 'WAIT...';
          aluSub.textContent = `CPU stalled waiting for ${latencyMode.toUpperCase()} bus (${stallRemaining} cycles left)`;
          renderUI({ readMem40: true });
          setNarration(`<strong>Cycle #${cycleCount} (MEMORY STALL):</strong> CPU sits idle waiting for data from <strong>${latencyMode.toUpperCase()}</strong>! ${stallRemaining} stall cycles left.`);
          if (stallRemaining === 0) {
            phaseIndex = 3; // move to writeback next
          }
          return;
        }

        if (phase === 0) {
          // FETCH
          container.querySelector('#m4-ir-hex').textContent = instr.hex;
          container.querySelector('#m4-reg-ir .reg-val').textContent = '0x' + instr.hex.replace(' ', '');
          container.querySelector('#bit-op').textContent = '????';
          container.querySelector('#bit-dst').textContent = '??';
          container.querySelector('#bit-src').textContent = '??';
          container.querySelector('#bit-imm').textContent = '????????';
          aluBox.classList.remove('firing');
          aluExpr.textContent = 'FETCHING';
          aluSub.textContent = `Reading ${hex4(instr.addr)} from RAM → IR`;
          phaseIndex = 1;
          renderUI();
          flyPacket(container.querySelector(`#m4-ins-${ipIndex}`), container.querySelector('#m4-ir-box'), instr.hex, { color: '#38bdf8' });
          setNarration(`<strong>Cycle #${cycleCount} — FETCH:</strong> CPU sends <code>PC = ${hex4(instr.addr)}</code> to RAM and fetches machine code <code>${instr.hex}</code> into <code>IR</code>.`);
        } else if (phase === 1) {
          // DECODE
          container.querySelector('#bit-op').textContent = instr.op;
          container.querySelector('#bit-dst').textContent = instr.dst;
          container.querySelector('#bit-src').textContent = instr.src;
          container.querySelector('#bit-imm').textContent = instr.imm;
          aluBox.classList.remove('firing');
          aluExpr.textContent = instr.asm;
          aluSub.textContent = 'Control Unit decoded bits into control signals';
          phaseIndex = 2;
          renderUI();
          setNarration(`<strong>Cycle #${cycleCount} — DECODE:</strong> Control Unit splits <code>${instr.hex}</code> into Opcode <code>${instr.op}</code> (${instr.asm}).`);
        } else if (phase === 2) {
          // EXECUTE
          aluBox.classList.add('firing');
          if (instr.type === 'load') {
            const stalls = latencyMode === 'l1' ? 0 : latencyMode === 'ram' ? 3 : 8;
            aluExpr.textContent = `READ [0x0040]`;
            aluSub.textContent = stalls === 0 ? 'L1 Cache Hit! Instant 1-cycle fetch.' : `Cache miss! Fetching from ${latencyMode.toUpperCase()}...`;
            flyPacket(container.querySelector('#m4-mem40'), container.querySelector('#m4-alu'), `val=${mem40}`, { color: '#34d399' });
            if (stalls > 0) {
              stallRemaining = stalls;
              renderUI({ readMem40: true });
              setNarration(`<strong>Cycle #${cycleCount} — EXECUTE (LOAD):</strong> Cache miss! Accessing <strong>${latencyMode.toUpperCase()}</strong> stalls CPU for ${stalls} extra clock cycles.`);
              return;
            }
          } else if (instr.type === 'add') {
            const res = regs[instr.rA] + regs[instr.rB];
            aluExpr.textContent = `${regs[instr.rA]} + ${regs[instr.rB]} = ${res}`;
            aluSub.textContent = 'ALU adder circuit fires!';
            flyPacket(container.querySelector('#m4-reg-0'), container.querySelector('#m4-alu'), String(regs[0]), { color: '#38bdf8' });
            flyPacket(container.querySelector('#m4-reg-1'), container.querySelector('#m4-alu'), String(regs[1]), { color: '#a78bfa' });
            renderUI({ readRegs: [0, 1] });
            setNarration(`<strong>Cycle #${cycleCount} — EXECUTE (ALU):</strong> <code>R0 (${regs[0]})</code> and <code>R1 (${regs[1]})</code> flow into the ALU → computes <strong>${res}</strong>!`);
            phaseIndex = 3;
            return;
          } else if (instr.type === 'imm') {
            aluExpr.textContent = `PASS #${instr.val}`;
            aluSub.textContent = 'Routing immediate constant to register bus';
          } else if (instr.type === 'store') {
            aluExpr.textContent = `ADDR 0x0044 ← ${regs[instr.rSrc]}`;
            aluSub.textContent = 'Preparing memory write to RAM';
          } else if (instr.type === 'jmp') {
            aluExpr.textContent = `PC ← 0x0000`;
            aluSub.textContent = 'Jumping back to start of loop';
          }
          phaseIndex = 3;
          renderUI();
          setNarration(`<strong>Cycle #${cycleCount} — EXECUTE:</strong> ${instr.desc}.`);
        } else {
          // WRITEBACK & advance PC
          aluBox.classList.remove('firing');
          let hl = {};
          if (instr.type === 'imm') {
            regs[instr.rDst] = instr.val;
            hl.writeReg = instr.rDst;
            flyPacket(container.querySelector('#m4-alu'), container.querySelector(`#m4-reg-${instr.rDst}`), String(instr.val), { color: '#f59e0b' });
            ipIndex = (ipIndex + 1) % MINI_PROGRAM.length;
          } else if (instr.type === 'load') {
            regs[instr.rDst] = mem40;
            hl.writeReg = instr.rDst;
            flyPacket(container.querySelector('#m4-mem40'), container.querySelector(`#m4-reg-${instr.rDst}`), String(mem40), { color: '#34d399' });
            ipIndex = (ipIndex + 1) % MINI_PROGRAM.length;
          } else if (instr.type === 'add') {
            regs[instr.rDst] = regs[instr.rA] + regs[instr.rB];
            hl.writeReg = instr.rDst;
            flyPacket(container.querySelector('#m4-alu'), container.querySelector(`#m4-reg-${instr.rDst}`), String(regs[instr.rDst]), { color: '#f59e0b' });
            ipIndex = (ipIndex + 1) % MINI_PROGRAM.length;
          } else if (instr.type === 'store') {
            mem44 = regs[instr.rSrc];
            hl.writeMem44 = true;
            flyPacket(container.querySelector(`#m4-reg-${instr.rSrc}`), container.querySelector('#m4-mem44'), String(mem44), { color: '#f59e0b' });
            ipIndex = (ipIndex + 1) % MINI_PROGRAM.length;
          } else if (instr.type === 'jmp') {
            ipIndex = instr.target;
          }
          phaseIndex = 0;
          aluExpr.textContent = 'DONE ✓';
          aluSub.textContent = `PC advanced to ${hex4(MINI_PROGRAM[ipIndex].addr)}`;
          renderUI(hl);
          setNarration(`<strong>Cycle #${cycleCount} — WRITEBACK:</strong> Result latched into destination &amp; <code>PC</code> updated to <code>${hex4(MINI_PROGRAM[ipIndex].addr)}</code>.`);
        }
      }

      container.querySelector('#m4-tick').addEventListener('click', tickCycle);
      autoBtn.addEventListener('click', () => {
        if (autoTimer) {
          stopAuto(autoBtn);
        } else {
          autoBtn.textContent = '⏸ Pause Clock';
          tickCycle();
          autoTimer = setInterval(tickCycle, speedMs);
        }
      });

      container.querySelector('#m4-reset').addEventListener('click', () => {
        stopAuto(autoBtn);
        resetState();
        renderUI();
        setNarration('CPU reset to Cycle #0. Click <strong>Tick 1 Clock Cycle</strong> to walk through Fetch → Decode → Execute → Writeback.');
      });

      container.querySelector('#m4-speed').addEventListener('input', (e) => {
        speedMs = 1420 - Number(e.target.value);
        if (autoTimer) {
          clearInterval(autoTimer);
          autoTimer = setInterval(tickCycle, speedMs);
        }
      });

      const latBtns = {
        l1: container.querySelector('#m4-lat-l1'),
        ram: container.querySelector('#m4-lat-ram'),
        disk: container.querySelector('#m4-lat-disk')
      };
      Object.entries(latBtns).forEach(([mode, btn]) => {
        btn.addEventListener('click', () => {
          latencyMode = mode;
          Object.entries(latBtns).forEach(([m, b]) => b.classList.toggle('active-tab', m === mode));
          setNarration(`Memory latency set to <strong>${mode.toUpperCase()}</strong> — watch what happens when the CPU executes <code>LOAD R1, [0x40]</code>!`);
        });
      });

      renderUI();
      setNarration('Every heartbeat of the square-wave <strong>Clock</strong> drives the CPU one step forward: <strong>Fetch → Decode → Execute → Writeback</strong>.');
    },

    destroy() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
    }
  };
}

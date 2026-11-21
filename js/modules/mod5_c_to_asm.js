import { setNarration, hex2, hex4, flyPacket } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

/**
 * 5 C -> Compiled Assembly -> Machine Code Programs
 * Address map (256-byte mini RAM):
 *   0x0000 - 0x001F : Code (.text)
 *   0x0020 - 0x002F : Static Data / Strings (.rodata)
 *   0x0030 - 0x004F : Heap (grows UPWARD from 0x0030)
 *   0x00E0 - 0x00FF : Stack (grows DOWNWARD from 0x0100)
 */
const PROGRAMS = {
  arith: {
    name: '1. Arithmetic + Stack',
    cLines: [
      'int main() {',
      '  int a = 5;',
      '  int b = 7;',
      '  int c = a + b;',
      '  return c;',
      '}'
    ],
    initData: [],
    asm: [
      { addr: 0x00, bytes: '10 05', text: 'MOV R0, #5', cLine: 1, op: 'MOVI', dst: 'R0', val: 5 },
      { addr: 0x02, bytes: '50 00', text: 'PUSH R0        ; int a', cLine: 1, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '11 07', text: 'MOV R1, #7', cLine: 2, op: 'MOVI', dst: 'R1', val: 7 },
      { addr: 0x06, bytes: '51 00', text: 'PUSH R1        ; int b', cLine: 2, op: 'PUSH', src: 'R1' },
      { addr: 0x08, bytes: '32 01', text: 'ADD R2, R0, R1 ; a + b', cLine: 3, op: 'ADD', dst: 'R2', a: 'R0', b: 'R1' },
      { addr: 0x0A, bytes: '52 00', text: 'PUSH R2        ; int c', cLine: 3, op: 'PUSH', src: 'R2' },
      { addr: 0x0C, bytes: '18 02', text: 'MOV R0, R2     ; return c', cLine: 4, op: 'MOVR', dst: 'R0', src: 'R2' },
      { addr: 0x0E, bytes: 'FF 00', text: 'HALT', cLine: 5, op: 'HALT' }
    ]
  },

  loop: {
    name: '2. For-Loop & Jumps',
    cLines: [
      'int sum = 0;',
      'for (int i = 1; i <= 3; i++) {',
      '  sum = sum + i;',
      '}',
      'return sum; // 6'
    ],
    initData: [],
    asm: [
      { addr: 0x00, bytes: '10 00', text: 'MOV R0, #0     ; sum = 0', cLine: 0, op: 'MOVI', dst: 'R0', val: 0 },
      { addr: 0x02, bytes: '11 01', text: 'MOV R1, #1     ; i = 1', cLine: 1, op: 'MOVI', dst: 'R1', val: 1 },
      { addr: 0x04, bytes: '12 03', text: 'MOV R2, #3     ; limit = 3', cLine: 1, op: 'MOVI', dst: 'R2', val: 3 },
      { addr: 0x06, bytes: '71 02', text: 'CMP R1, R2     ; i <= 3 ?', cLine: 1, op: 'CMP', a: 'R1', b: 'R2' },
      { addr: 0x08, bytes: '82 10', text: 'JG  0x0010     ; exit loop', cLine: 1, op: 'JG', target: 0x10 },
      { addr: 0x0A, bytes: '30 01', text: 'ADD R0, R0, R1 ; sum += i', cLine: 2, op: 'ADD', dst: 'R0', a: 'R0', b: 'R1' },
      { addr: 0x0C, bytes: '35 11', text: 'ADD R1, R1, #1 ; i++', cLine: 1, op: 'ADDI', dst: 'R1', a: 'R1', val: 1 },
      { addr: 0x0E, bytes: '80 06', text: 'JMP 0x0006     ; loop back', cLine: 3, op: 'JMP', target: 0x06 },
      { addr: 0x10, bytes: '50 00', text: 'PUSH R0        ; save sum', cLine: 4, op: 'PUSH', src: 'R0' },
      { addr: 0x12, bytes: 'FF 00', text: 'HALT', cLine: 4, op: 'HALT' }
    ]
  },

  func: {
    name: '3. Function Call & Stack',
    cLines: [
      'int square(int x) {',
      '  return x * x;',
      '}',
      'int main() {',
      '  int r = square(5);',
      '  return r;',
      '}'
    ],
    initData: [],
    asm: [
      { addr: 0x00, bytes: '10 05', text: 'MOV  R0, #5     ; arg x = 5', cLine: 4, op: 'MOVI', dst: 'R0', val: 5 },
      { addr: 0x02, bytes: '90 0A', text: 'CALL 0x000A     ; square(5)', cLine: 4, op: 'CALL', target: 0x0A },
      { addr: 0x04, bytes: '50 00', text: 'PUSH R0         ; int r = 25', cLine: 4, op: 'PUSH', src: 'R0' },
      { addr: 0x06, bytes: 'FF 00', text: 'HALT            ; return 25', cLine: 5, op: 'HALT' },
      { addr: 0x0A, bytes: '53 00', text: 'PUSH FP         ; save frame', cLine: 0, op: 'PUSH', src: 'FP' },
      { addr: 0x0C, bytes: '19 04', text: 'MOV  FP, SP     ; new frame', cLine: 0, op: 'MOVR', dst: 'FP', src: 'SP' },
      { addr: 0x0E, bytes: '40 00', text: 'MUL  R0, R0, R0 ; x * x', cLine: 1, op: 'MUL', dst: 'R0', a: 'R0', b: 'R0' },
      { addr: 0x10, bytes: '63 00', text: 'POP  FP         ; restore FP', cLine: 2, op: 'POP', dst: 'FP' },
      { addr: 0x12, bytes: '91 00', text: 'RET             ; pop -> PC', cLine: 2, op: 'RET' }
    ]
  },

  string: {
    name: '4. Strings & Pointers',
    cLines: [
      'char *s = "HI!"; // @ 0x0020',
      'char c = s[0];   // reads \'H\'',
      's[0] = \'B\';      // "HI!"->"BI!"',
      'return s[0];'
    ],
    initData: [
      { addr: 0x20, bytes: [0x48, 0x49, 0x21, 0x00] } // "HI!\0"
    ],
    asm: [
      { addr: 0x00, bytes: '10 20', text: 'MOV   R0, #0x20  ; s = 0x0020', cLine: 0, op: 'MOVI', dst: 'R0', val: 0x20 },
      { addr: 0x02, bytes: '50 00', text: 'PUSH  R0         ; store ptr s', cLine: 0, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '21 00', text: 'LOAD  R1, [R0]   ; c = *s (\'H\')', cLine: 1, op: 'LOADR', dst: 'R1', ptrReg: 'R0' },
      { addr: 0x06, bytes: '12 42', text: 'MOV   R2, #0x42  ; ASCII \'B\'', cLine: 2, op: 'MOVI', dst: 'R2', val: 0x42 },
      { addr: 0x08, bytes: '28 02', text: 'STORE [R0], R2   ; *s = \'B\'', cLine: 2, op: 'STORER', ptrReg: 'R0', src: 'R2' },
      { addr: 0x0A, bytes: '21 00', text: 'LOAD  R0, [R0]   ; return \'B\'', cLine: 3, op: 'LOADR', dst: 'R0', ptrReg: 'R0' },
      { addr: 0x0C, bytes: 'FF 00', text: 'HALT', cLine: 3, op: 'HALT' }
    ]
  },

  heap: {
    name: '5. Heap malloc() + Ptr',
    cLines: [
      'int *p = malloc(4); // Heap↑',
      'p[0] = 42;          // 0x2A',
      'p[1] = 99;          // 0x63',
      'int x = p[0] + p[1];',
      'return x;           // 141'
    ],
    initData: [],
    asm: [
      { addr: 0x00, bytes: 'A0 04', text: 'MALLOC R0, #4    ; p = 0x0030', cLine: 0, op: 'MALLOC', dst: 'R0', size: 4 },
      { addr: 0x02, bytes: '50 00', text: 'PUSH   R0        ; ptr on Stack', cLine: 0, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '11 2A', text: 'MOV    R1, #42', cLine: 1, op: 'MOVI', dst: 'R1', val: 42 },
      { addr: 0x06, bytes: '28 01', text: 'STORE  [R0], R1  ; p[0] = 42', cLine: 1, op: 'STORER', ptrReg: 'R0', src: 'R1' },
      { addr: 0x08, bytes: '12 63', text: 'MOV    R2, #99', cLine: 2, op: 'MOVI', dst: 'R2', val: 99 },
      { addr: 0x0A, bytes: '29 02', text: 'STORE  [R0+1],R2 ; p[1] = 99', cLine: 2, op: 'STORER', ptrReg: 'R0', offset: 1, src: 'R2' },
      { addr: 0x0C, bytes: '33 12', text: 'ADD    R3, R1,R2 ; 42 + 99', cLine: 3, op: 'ADD', dst: 'R3', a: 'R1', b: 'R2' },
      { addr: 0x0E, bytes: '53 00', text: 'PUSH   R3        ; int x = 141', cLine: 3, op: 'PUSH', src: 'R3' },
      { addr: 0x10, bytes: 'FF 00', text: 'HALT', cLine: 4, op: 'HALT' }
    ]
  }
};

export function createModule5() {
  let activeProgKey = 'arith';
  let state = null;
  let history = [];
  let hexEditor = null;
  let playTimer = null;
  let speedMs = 750;

  function makeInitialState(progKey) {
    const prog = PROGRAMS[progKey];
    const mem = new Uint8Array(256);
    // Load machine code bytes into 0x0000..
    for (const ins of prog.asm) {
      const parts = ins.bytes.split(' ');
      mem[ins.addr] = parseInt(parts[0], 16);
      mem[ins.addr + 1] = parseInt(parts[1], 16);
    }
    // Load static data (.rodata)
    for (const d of prog.initData) {
      d.bytes.forEach((b, i) => { mem[d.addr + i] = b; });
    }
    return {
      progKey,
      cycle: 0,
      phase: 0, // 0=FETCH, 1=DECODE, 2=EXECUTE
      halted: false,
      regs: { PC: 0x00, SP: 0x100, FP: 0x100, R0: 0, R1: 0, R2: 0, R3: 0 },
      flags: { Z: 0, G: 0 },
      ir: '-- --',
      heapTop: 0x30,
      mem,
      aluText: 'IDLE',
      changedReg: null,
      readRegs: [],
      lastNarration: `Loaded <strong>${prog.name}</strong>. Click <strong>Step Cycle</strong> (micro-step) or <strong>Step Instruction</strong> to watch the CPU execute!`
    };
  }

  function cloneState(s) {
    return {
      ...s,
      regs: { ...s.regs },
      flags: { ...s.flags },
      mem: new Uint8Array(s.mem),
      readRegs: [...s.readRegs]
    };
  }

  function stopPlay(btn) {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
    if (btn) btn.textContent = '▶ Play';
  }

  return {
    init(container) {
      state = makeInitialState(activeProgKey);
      history = [];

      const progTabsHtml = Object.entries(PROGRAMS).map(([k, p]) =>
        `<button class="btn btn-sm${k === activeProgKey ? ' active-tab' : ''}" data-prog="${k}">${p.name}</button>`
      ).join('');

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group" id="m5-prog-tabs">
            ${progTabsHtml}
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <button class="btn btn-primary btn-sm" id="m5-step-cyc">⚡ Step Cycle</button>
            <button class="btn btn-amber btn-sm" id="m5-step-ins">⏭ Step Instruction</button>
            <button class="btn btn-sm" id="m5-back">↶ Back</button>
            <button class="btn btn-emerald btn-sm" id="m5-play">▶ Play</button>
            <button class="btn btn-ghost btn-sm" id="m5-reset">↺ Reset</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <span style="font-size:11px;color:var(--text-muted)">Speed:</span>
            <input type="range" id="m5-speed" min="200" max="1200" value="650" style="width:76px"/>
          </div>
        </div>

        <div class="lab-4pane">
          <!-- Pane 1: C Source Code -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>1. C Source Code</div>
              <span class="pill pill-cyan">High-Level</span>
            </div>
            <div class="code-pane" id="m5-c-pane"></div>
            <div style="font-size:11px;color:var(--text-muted);padding-top:4px;border-top:1px solid var(--border)">
              1 C statement compiles into multiple machine instructions →
            </div>
          </div>

          <!-- Pane 2: Compiled Assembly + Machine Code -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>2. Assembly &amp; Machine Code</div>
              <span class="pill pill-amber" id="m5-pc-badge">PC: 0x0000</span>
            </div>
            <div class="code-pane" id="m5-asm-pane"></div>
          </div>

          <!-- Pane 3: Live CPU Registers, Phase & ALU -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--violet)"></span>3. Live CPU Core</div>
              <span class="pill pill-violet" id="m5-cyc-badge">Cycle #0</span>
            </div>

            <div class="phase-stepper" id="m5-phase-bar">
              <div class="phase-chip" data-ph="0">FETCH</div>
              <div class="phase-chip" data-ph="1">DECODE</div>
              <div class="phase-chip" data-ph="2">EXECUTE</div>
            </div>

            <div class="reg-grid" id="m5-regs">
              <div class="reg-box" id="m5-r-PC"><span class="reg-name" style="color:var(--cyan)">PC</span><span class="reg-val">0x0000</span></div>
              <div class="reg-box" id="m5-r-IR"><span class="reg-name" style="color:var(--amber)">IR</span><span class="reg-val">-- --</span></div>
              <div class="reg-box" id="m5-r-SP"><span class="reg-name" style="color:var(--emerald)">SP</span><span class="reg-val">0x0100</span></div>
              <div class="reg-box" id="m5-r-FP"><span class="reg-name" style="color:var(--emerald)">FP</span><span class="reg-val">0x0100</span></div>
              <div class="reg-box" id="m5-r-R0"><span class="reg-name">R0</span><span class="reg-val">0</span></div>
              <div class="reg-box" id="m5-r-R1"><span class="reg-name">R1</span><span class="reg-val">0</span></div>
              <div class="reg-box" id="m5-r-R2"><span class="reg-name">R2</span><span class="reg-val">0</span></div>
              <div class="reg-box" id="m5-r-R3"><span class="reg-name">R3</span><span class="reg-val">0</span></div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:#090e17;border:1px solid var(--border);border-radius:6px;font-family:var(--font-mono);font-size:11px">
              <span style="color:var(--text-muted)">FLAGS:</span>
              <span>Zero (Z): <strong id="m5-fl-z" style="color:var(--cyan)">0</strong></span>
              <span>Greater (G): <strong id="m5-fl-g" style="color:var(--amber)">0</strong></span>
            </div>

            <div class="alu-box" id="m5-alu" style="margin-top:auto">
              <div style="font-size:9.5px;color:var(--text-muted)">ALU / CONTROL DATAFLOW</div>
              <div id="m5-alu-txt" style="font-size:15px;font-weight:800;color:var(--cyan);margin-top:3px">IDLE</div>
            </div>
          </div>

          <!-- Pane 4: Live Memory & Hex Editor -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--emerald)"></span>4. RAM Hex Editor</div>
              <span class="pill pill-emerald">Heap ↑ / Stack ↓</span>
            </div>
            <div id="m5-hex-mount" style="flex:1;display:flex;flex-direction:column"></div>
          </div>
        </div>
      `;

      const cPane = container.querySelector('#m5-c-pane');
      const asmPane = container.querySelector('#m5-asm-pane');
      const hexMount = container.querySelector('#m5-hex-mount');
      const playBtn = container.querySelector('#m5-play');
      const aluBox = container.querySelector('#m5-alu');
      const aluTxt = container.querySelector('#m5-alu-txt');

      function getCurrentInstr() {
        const prog = PROGRAMS[state.progKey];
        return prog.asm.find((i) => i.addr === state.regs.PC) || null;
      }

      function getRegion(addr) {
        if (addr < 0x20) return 'code';
        if (addr < 0x30) return 'data';
        if (addr < state.heapTop) return 'heap';
        if (addr >= state.regs.SP) return 'stack';
        return 'zero';
      }

      hexEditor = new HexEditor(hexMount, {
        bytes: state.mem,
        baseAddr: 0,
        rowAddresses: [0x00, 0x08, 0x10, 0x20, 0x30, 0xF0, 0xF8],
        editable: false,
        spAddr: state.regs.SP < 0x100 ? state.regs.SP : null,
        pcAddr: state.regs.PC,
        legend: [
          { label: 'Code', color: '#38bdf8' },
          { label: 'String', color: '#f59e0b' },
          { label: 'Heap ↑', color: '#a78bfa' },
          { label: 'Stack ↓', color: '#34d399' }
        ],
        getRegion,
        getRegionLabel: (a) => {
          const r = getRegion(a);
          return r === 'zero' ? 'FREE' : r.toUpperCase();
        }
      });

      function render(flashOps = []) {
        const prog = PROGRAMS[state.progKey];
        const curIns = getCurrentInstr();

        // C pane
        cPane.innerHTML = prog.cLines.map((line, idx) => `
          <div class="code-line${curIns && curIns.cLine === idx ? ' active-c' : ''}">
            <span class="code-line-num">${idx + 1}</span>
            <span style="white-space:pre">${line}</span>
          </div>
        `).join('');

        // Assembly pane
        asmPane.innerHTML = prog.asm.map((ins) => {
          const isCur = curIns && curIns.addr === ins.addr;
          return `
            <div class="code-line${isCur ? ' active-asm' : ''}" id="m5-asm-${ins.addr}">
              <span class="code-addr">${isCur ? '▶' : ' '} ${hex4(ins.addr)}</span>
              <span class="code-bytes">${ins.bytes}</span>
              <span style="white-space:pre">${ins.text}</span>
            </div>
          `;
        }).join('');

        // Badges & Phase bar
        container.querySelector('#m5-pc-badge').textContent = `PC: ${hex4(state.regs.PC)}`;
        container.querySelector('#m5-cyc-badge').textContent = `Cycle #${state.cycle}`;
        const activePh = state.cycle === 0 ? -1 : (state.phase + 2) % 3;
        container.querySelectorAll('#m5-phase-bar .phase-chip').forEach((ch) => {
          const p = Number(ch.dataset.ph);
          ch.className = 'phase-chip';
          if (p === activePh && !state.halted) {
            ch.classList.add(p === 0 ? 'active-fetch' : p === 1 ? 'active-decode' : 'active-execute');
          }
        });

        // Registers
        const regIds = ['PC', 'SP', 'FP', 'R0', 'R1', 'R2', 'R3'];
        for (const r of regIds) {
          const box = container.querySelector(`#m5-r-${r}`);
          const val = state.regs[r];
          box.querySelector('.reg-val').textContent = (r === 'PC' || r === 'SP' || r === 'FP') ? hex4(val) : `${val} (0x${hex2(val)})`;
          box.classList.toggle('changed', state.changedReg === r);
          box.classList.toggle('read-hit', state.readRegs.includes(r));
        }
        container.querySelector('#m5-r-IR .reg-val').textContent = state.ir;
        container.querySelector('#m5-fl-z').textContent = String(state.flags.Z);
        container.querySelector('#m5-fl-g').textContent = String(state.flags.G);
        aluTxt.textContent = state.aluText;
        aluBox.classList.toggle('firing', activePh === 2 && !state.halted);

        // Hex Editor
        hexEditor.update({
          bytes: state.mem,
          spAddr: state.regs.SP < 0x100 ? state.regs.SP : null,
          pcAddr: state.regs.PC
        });
        for (const f of flashOps) hexEditor.flash(f.addr, f.mode);

        setNarration(state.lastNarration);
      }

      function executeSingleCycle(animatePackets = true) {
        if (state.halted) {
          stopPlay(playBtn);
          return false;
        }
        history.push(cloneState(state));
        if (history.length > 120) history.shift();

        const ins = getCurrentInstr();
        if (!ins) {
          state.halted = true;
          render();
          return false;
        }

        state.cycle++;
        state.changedReg = null;
        state.readRegs = [];
        const flashOps = [];

        if (state.phase === 0) {
          // FETCH
          state.ir = ins.bytes;
          state.aluText = `FETCH ${hex4(ins.addr)}`;
          state.phase = 1;
          state.lastNarration = `<strong>Cycle #${state.cycle} (FETCH):</strong> PC = <code>${hex4(ins.addr)}</code> fetches machine code <code>${ins.bytes}</code> (<code>${ins.text.trim()}</code>) into <code>IR</code>.`;
          flashOps.push({ addr: ins.addr, mode: 'read' }, { addr: ins.addr + 1, mode: 'read' });
          render(flashOps);
          if (animatePackets) {
            flyPacket(container.querySelector(`#m5-asm-${ins.addr}`), container.querySelector('#m5-r-IR'), ins.bytes, { color: '#38bdf8' });
          }
          return true;
        }

        if (state.phase === 1) {
          // DECODE
          state.aluText = `DECODE: ${ins.op}`;
          state.phase = 2;
          state.lastNarration = `<strong>Cycle #${state.cycle} (DECODE):</strong> Control Unit decodes <code>${ins.bytes}</code> → prepares hardware paths for <code>${ins.text.trim()}</code>.`;
          render();
          return true;
        }

        // EXECUTE (phase === 2)
        const nextSequentialPC = ins.addr + 2;
        let nextPC = nextSequentialPC;
        const regEl = (name) => container.querySelector(`#m5-r-${name}`);

        switch (ins.op) {
          case 'MOVI': {
            state.regs[ins.dst] = ins.val;
            state.changedReg = ins.dst;
            state.aluText = `${ins.dst} ← ${ins.val}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE):</strong> Loaded constant <code>${ins.val}</code> (<code>0x${hex2(ins.val)}</code>) into register <code>${ins.dst}</code>.`;
            if (animatePackets) flyPacket(container.querySelector('#m5-r-IR'), regEl(ins.dst), String(ins.val), { color: '#f59e0b' });
            break;
          }
          case 'MOVR': {
            const v = state.regs[ins.src];
            state.regs[ins.dst] = v;
            state.readRegs = [ins.src];
            state.changedReg = ins.dst;
            state.aluText = `${ins.dst} ← ${ins.src} (${v})`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE):</strong> Copied <code>${ins.src}</code> (${hex4(v)}) into <code>${ins.dst}</code>.`;
            if (animatePackets) flyPacket(regEl(ins.src), regEl(ins.dst), String(v), { color: '#38bdf8' });
            break;
          }
          case 'PUSH': {
            const v = state.regs[ins.src];
            state.regs.SP -= 2;
            state.mem[state.regs.SP] = (v >> 8) & 0xff;
            state.mem[state.regs.SP + 1] = v & 0xff;
            state.readRegs = [ins.src];
            state.changedReg = 'SP';
            state.aluText = `PUSH ${ins.src} → [${hex4(state.regs.SP)}]`;
            flashOps.push({ addr: state.regs.SP, mode: 'write' }, { addr: state.regs.SP + 1, mode: 'write' });
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — PUSH):</strong> Decremented <code>SP</code> ↓ to <code>${hex4(state.regs.SP)}</code> and pushed <code>${ins.src} = ${v}</code> onto the <strong>Stack</strong>!`;
            render(flashOps);
            if (animatePackets) flyPacket(regEl(ins.src), hexEditor.getCellEl(state.regs.SP), `PUSH ${v}`, { color: '#34d399' });
            state.regs.PC = nextPC;
            state.phase = 0;
            return true;
          }
          case 'POP': {
            const addr = state.regs.SP;
            const v = (state.mem[addr] << 8) | state.mem[addr + 1];
            state.regs[ins.dst] = v;
            state.regs.SP += 2;
            state.changedReg = ins.dst;
            state.aluText = `POP [${hex4(addr)}] → ${ins.dst}`;
            flashOps.push({ addr, mode: 'read' }, { addr: addr + 1, mode: 'read' });
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — POP):</strong> Read <code>${hex4(v)}</code> from Stack <code>${hex4(addr)}</code> into <code>${ins.dst}</code> and moved <code>SP</code> ↑ to <code>${hex4(state.regs.SP)}</code>.`;
            if (animatePackets) flyPacket(hexEditor.getCellEl(addr), regEl(ins.dst), `POP`, { color: '#34d399' });
            break;
          }
          case 'ADD': {
            const va = state.regs[ins.a], vb = state.regs[ins.b];
            const res = (va + vb) & 0xff;
            state.regs[ins.dst] = res;
            state.readRegs = [ins.a, ins.b];
            state.changedReg = ins.dst;
            state.aluText = `${va} + ${vb} = ${res}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — ALU):</strong> ALU added <code>${ins.a} (${va}) + ${ins.b} (${vb}) = ${res}</code> → stored in <code>${ins.dst}</code>.`;
            if (animatePackets) {
              flyPacket(regEl(ins.a), aluBox, String(va), { color: '#38bdf8', duration: 380 });
              setTimeout(() => flyPacket(aluBox, regEl(ins.dst), `=${res}`, { color: '#f59e0b', duration: 420 }), 220);
            }
            break;
          }
          case 'ADDI': {
            const va = state.regs[ins.a];
            const res = (va + ins.val) & 0xff;
            state.regs[ins.dst] = res;
            state.readRegs = [ins.a];
            state.changedReg = ins.dst;
            state.aluText = `${va} + ${ins.val} = ${res}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — ALU):</strong> Incremented <code>${ins.dst}</code> from ${va} → <strong>${res}</strong>.`;
            if (animatePackets) flyPacket(aluBox, regEl(ins.dst), String(res), { color: '#f59e0b' });
            break;
          }
          case 'MUL': {
            const va = state.regs[ins.a], vb = state.regs[ins.b];
            const res = (va * vb) & 0xff;
            state.regs[ins.dst] = res;
            state.readRegs = [ins.a, ins.b];
            state.changedReg = ins.dst;
            state.aluText = `${va} × ${vb} = ${res}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — ALU):</strong> Multiplied <code>${va} × ${vb} = ${res}</code> → return value placed in <code>R0</code>!`;
            if (animatePackets) flyPacket(aluBox, regEl(ins.dst), `=${res}`, { color: '#f59e0b' });
            break;
          }
          case 'CMP': {
            const va = state.regs[ins.a], vb = state.regs[ins.b];
            state.flags.Z = va === vb ? 1 : 0;
            state.flags.G = va > vb ? 1 : 0;
            state.readRegs = [ins.a, ins.b];
            state.aluText = `CMP ${va} vs ${vb} → G=${state.flags.G}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — CMP):</strong> Compared <code>${ins.a} (${va})</code> vs <code>${ins.b} (${vb})</code> → updated CPU Flags (<code>Z=${state.flags.Z}, G=${state.flags.G}</code>).`;
            break;
          }
          case 'JG': {
            if (state.flags.G === 1) {
              nextPC = ins.target;
              state.changedReg = 'PC';
              state.aluText = `JUMP TAKEN → ${hex4(nextPC)}`;
              state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — JG):</strong> Flag <code>G=1</code>! Loop finished — <strong>PC jumps</strong> directly to <code>${hex4(nextPC)}</code>!`;
            } else {
              state.aluText = `NOT TAKEN (G=0)`;
              state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — JG):</strong> Flag <code>G=0</code> (i ≤ 3) — jump not taken, continuing into loop body.`;
            }
            break;
          }
          case 'JMP': {
            nextPC = ins.target;
            state.changedReg = 'PC';
            state.aluText = `PC ← ${hex4(nextPC)}`;
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — JMP):</strong> Unconditional jump! <strong>Program Counter (PC)</strong> rewinds back to <code>${hex4(nextPC)}</code>.`;
            break;
          }
          case 'CALL': {
            // Push return address onto stack and jump to function
            state.regs.SP -= 2;
            state.mem[state.regs.SP] = (nextSequentialPC >> 8) & 0xff;
            state.mem[state.regs.SP + 1] = nextSequentialPC & 0xff;
            nextPC = ins.target;
            state.changedReg = 'PC';
            state.aluText = `CALL → PUSH RET ${hex4(nextSequentialPC)}`;
            flashOps.push({ addr: state.regs.SP, mode: 'write' }, { addr: state.regs.SP + 1, mode: 'write' });
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — CALL):</strong> Pushed return address <code>${hex4(nextSequentialPC)}</code> onto the <strong>Stack</strong> (<code>SP=${hex4(state.regs.SP)}</code>) and jumped <code>PC → ${hex4(nextPC)}</code>!`;
            render(flashOps);
            if (animatePackets) flyPacket(regEl('PC'), hexEditor.getCellEl(state.regs.SP), `RET ${hex4(nextSequentialPC)}`, { color: '#34d399' });
            state.regs.PC = nextPC;
            state.phase = 0;
            return true;
          }
          case 'RET': {
            const addr = state.regs.SP;
            const retAddr = (state.mem[addr] << 8) | state.mem[addr + 1];
            state.regs.SP += 2;
            nextPC = retAddr;
            state.changedReg = 'PC';
            state.aluText = `RET → PC ← ${hex4(retAddr)}`;
            flashOps.push({ addr, mode: 'read' }, { addr: addr + 1, mode: 'read' });
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — RET):</strong> Popped return address <code>${hex4(retAddr)}</code> off the <strong>Stack</strong> straight back into <strong>PC</strong> — returning to <code>main()</code>!`;
            if (animatePackets) flyPacket(hexEditor.getCellEl(addr), regEl('PC'), `PC=${hex4(retAddr)}`, { color: '#38bdf8' });
            break;
          }
          case 'LOADR': {
            const addr = state.regs[ins.ptrReg] + (ins.offset || 0);
            const v = state.mem[addr];
            state.regs[ins.dst] = v;
            state.readRegs = [ins.ptrReg];
            state.changedReg = ins.dst;
            state.aluText = `${ins.dst} ← [${hex4(addr)}] (${v})`;
            flashOps.push({ addr, mode: 'read' });
            const ch = v >= 32 && v <= 126 ? ` ('${String.fromCharCode(v)}')` : '';
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — LOAD):</strong> Dereferenced pointer <code>${ins.ptrReg}=${hex4(addr)}</code> → read byte <code>0x${hex2(v)}</code>${ch} from RAM into <code>${ins.dst}</code>!`;
            if (animatePackets) flyPacket(hexEditor.getCellEl(addr), regEl(ins.dst), `0x${hex2(v)}`, { color: '#38bdf8' });
            break;
          }
          case 'STORER': {
            const addr = state.regs[ins.ptrReg] + (ins.offset || 0);
            const v = state.regs[ins.src] & 0xff;
            state.mem[addr] = v;
            state.readRegs = [ins.ptrReg, ins.src];
            state.aluText = `[${hex4(addr)}] ← ${v} (0x${hex2(v)})`;
            flashOps.push({ addr, mode: 'write' });
            const ch = v >= 32 && v <= 126 ? ` ('${String.fromCharCode(v)}')` : '';
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — STORE):</strong> Wrote <code>${ins.src}=0x${hex2(v)}</code>${ch} directly to memory address <code>${hex4(addr)}</code> — look at the Hex Editor update live!`;
            render(flashOps);
            if (animatePackets) flyPacket(regEl(ins.src), hexEditor.getCellEl(addr), `0x${hex2(v)}`, { color: '#f59e0b' });
            state.regs.PC = nextPC;
            state.phase = 0;
            return true;
          }
          case 'MALLOC': {
            const addr = state.heapTop;
            state.heapTop += ins.size;
            state.regs[ins.dst] = addr;
            state.changedReg = ins.dst;
            state.aluText = `HEAP ALLOC → ${hex4(addr)}`;
            for (let i = 0; i < ins.size; i++) flashOps.push({ addr: addr + i, mode: 'write' });
            state.lastNarration = `<strong>Cycle #${state.cycle} (EXECUTE — MALLOC):</strong> Allocated ${ins.size} bytes on the <strong>Heap</strong> at <code>${hex4(addr)}</code> and returned the pointer address in <code>${ins.dst}</code>!`;
            if (animatePackets) flyPacket(hexEditor.getCellEl(addr), regEl(ins.dst), hex4(addr), { color: '#a78bfa' });
            break;
          }
          case 'HALT': {
            state.halted = true;
            state.aluText = `HALT ✓ (R0=${state.regs.R0})`;
            state.lastNarration = `<strong>Program Halted ✓</strong> in ${state.cycle} clock cycles! Final return value in <code>R0 = ${state.regs.R0}</code> (<code>0x${hex2(state.regs.R0)}</code>).`;
            stopPlay(playBtn);
            render();
            return false;
          }
        }

        state.regs.PC = nextPC;
        state.phase = 0;
        render(flashOps);
        return true;
      }

      function stepFullInstruction() {
        if (state.halted) return;
        // Finish current instruction (up to 3 phases)
        const steps = 3 - state.phase;
        for (let i = 0; i < steps; i++) {
          if (!executeSingleCycle(i === steps - 1)) break;
        }
      }

      // Bindings
      container.querySelector('#m5-step-cyc').addEventListener('click', () => {
        stopPlay(playBtn);
        executeSingleCycle(true);
      });

      container.querySelector('#m5-step-ins').addEventListener('click', () => {
        stopPlay(playBtn);
        stepFullInstruction();
      });

      container.querySelector('#m5-back').addEventListener('click', () => {
        stopPlay(playBtn);
        if (history.length === 0) return;
        state = history.pop();
        render();
      });

      playBtn.addEventListener('click', () => {
        if (playTimer) {
          stopPlay(playBtn);
        } else {
          if (state.halted) {
            state = makeInitialState(activeProgKey);
            history = [];
          }
          playBtn.textContent = '⏸ Pause';
          executeSingleCycle(true);
          playTimer = setInterval(() => {
            if (!executeSingleCycle(true)) stopPlay(playBtn);
          }, speedMs);
        }
      });

      container.querySelector('#m5-reset').addEventListener('click', () => {
        stopPlay(playBtn);
        state = makeInitialState(activeProgKey);
        history = [];
        render();
      });

      container.querySelector('#m5-speed').addEventListener('input', (e) => {
        speedMs = 1400 - Number(e.target.value);
        if (playTimer) {
          clearInterval(playTimer);
          playTimer = setInterval(() => {
            if (!executeSingleCycle(true)) stopPlay(playBtn);
          }, speedMs);
        }
      });

      container.querySelectorAll('#m5-prog-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          stopPlay(playBtn);
          activeProgKey = btn.dataset.prog;
          container.querySelectorAll('#m5-prog-tabs button').forEach((b) => b.classList.toggle('active-tab', b === btn));
          state = makeInitialState(activeProgKey);
          history = [];
          render();
        });
      });

      render();
    },

    destroy() {
      if (playTimer) clearInterval(playTimer);
      playTimer = null;
    }
  };
}

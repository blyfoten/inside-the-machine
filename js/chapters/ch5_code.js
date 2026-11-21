import { observeBeats, setCaption, hex2, hex4, flyPacket } from '../components/animator.js';
import { HexEditor } from '../components/hexEditor.js';

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
      { addr: 0x02, bytes: '50 00', text: 'PUSH R0       ; int a', cLine: 1, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '11 07', text: 'MOV R1, #7', cLine: 2, op: 'MOVI', dst: 'R1', val: 7 },
      { addr: 0x06, bytes: '51 00', text: 'PUSH R1       ; int b', cLine: 2, op: 'PUSH', src: 'R1' },
      { addr: 0x08, bytes: '32 01', text: 'ADD R2, R0,R1 ; a+b', cLine: 3, op: 'ADD', dst: 'R2', a: 'R0', b: 'R1' },
      { addr: 0x0A, bytes: '52 00', text: 'PUSH R2       ; int c', cLine: 3, op: 'PUSH', src: 'R2' },
      { addr: 0x0C, bytes: '18 02', text: 'MOV R0, R2    ; ret c', cLine: 4, op: 'MOVR', dst: 'R0', src: 'R2' },
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
      { addr: 0x00, bytes: '10 00', text: 'MOV R0, #0    ; sum=0', cLine: 0, op: 'MOVI', dst: 'R0', val: 0 },
      { addr: 0x02, bytes: '11 01', text: 'MOV R1, #1    ; i=1', cLine: 1, op: 'MOVI', dst: 'R1', val: 1 },
      { addr: 0x04, bytes: '12 03', text: 'MOV R2, #3    ; max=3', cLine: 1, op: 'MOVI', dst: 'R2', val: 3 },
      { addr: 0x06, bytes: '71 02', text: 'CMP R1, R2    ; i<=3?', cLine: 1, op: 'CMP', a: 'R1', b: 'R2' },
      { addr: 0x08, bytes: '82 10', text: 'JG  0x0010    ; exit', cLine: 1, op: 'JG', target: 0x10 },
      { addr: 0x0A, bytes: '30 01', text: 'ADD R0, R0,R1 ; sum+=i', cLine: 2, op: 'ADD', dst: 'R0', a: 'R0', b: 'R1' },
      { addr: 0x0C, bytes: '35 11', text: 'ADD R1, R1,#1 ; i++', cLine: 1, op: 'ADDI', dst: 'R1', a: 'R1', val: 1 },
      { addr: 0x0E, bytes: '80 06', text: 'JMP 0x0006    ; loop', cLine: 3, op: 'JMP', target: 0x06 },
      { addr: 0x10, bytes: '50 00', text: 'PUSH R0       ; save', cLine: 4, op: 'PUSH', src: 'R0' },
      { addr: 0x12, bytes: 'FF 00', text: 'HALT', cLine: 4, op: 'HALT' }
    ]
  },
  func: {
    name: '3. Function Call',
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
      { addr: 0x00, bytes: '10 05', text: 'MOV  R0, #5    ; x=5', cLine: 4, op: 'MOVI', dst: 'R0', val: 5 },
      { addr: 0x02, bytes: '90 0A', text: 'CALL 0x000A    ; sq(5)', cLine: 4, op: 'CALL', target: 0x0A },
      { addr: 0x04, bytes: '50 00', text: 'PUSH R0        ; r=25', cLine: 4, op: 'PUSH', src: 'R0' },
      { addr: 0x06, bytes: 'FF 00', text: 'HALT', cLine: 5, op: 'HALT' },
      { addr: 0x0A, bytes: '53 00', text: 'PUSH FP        ; save', cLine: 0, op: 'PUSH', src: 'FP' },
      { addr: 0x0C, bytes: '19 04', text: 'MOV  FP, SP    ; frame', cLine: 0, op: 'MOVR', dst: 'FP', src: 'SP' },
      { addr: 0x0E, bytes: '40 00', text: 'MUL  R0, R0,R0 ; x*x', cLine: 1, op: 'MUL', dst: 'R0', a: 'R0', b: 'R0' },
      { addr: 0x10, bytes: '63 00', text: 'POP  FP', cLine: 2, op: 'POP', dst: 'FP' },
      { addr: 0x12, bytes: '91 00', text: 'RET            ; ->PC', cLine: 2, op: 'RET' }
    ]
  },
  string: {
    name: '4. Strings & Pointers',
    cLines: [
      'char *s = "HI!";',
      'char c = s[0];',
      's[0] = \'B\';',
      'return s[0];'
    ],
    initData: [{ addr: 0x20, bytes: [0x48, 0x49, 0x21, 0x00] }],
    asm: [
      { addr: 0x00, bytes: '10 20', text: 'MOV   R0,#0x20 ; s', cLine: 0, op: 'MOVI', dst: 'R0', val: 0x20 },
      { addr: 0x02, bytes: '50 00', text: 'PUSH  R0       ; ptr', cLine: 0, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '21 00', text: 'LOAD  R1,[R0]  ; \'H\'', cLine: 1, op: 'LOADR', dst: 'R1', ptrReg: 'R0' },
      { addr: 0x06, bytes: '12 42', text: 'MOV   R2,#0x42 ; \'B\'', cLine: 2, op: 'MOVI', dst: 'R2', val: 0x42 },
      { addr: 0x08, bytes: '28 02', text: 'STORE [R0],R2  ; ->BI!', cLine: 2, op: 'STORER', ptrReg: 'R0', src: 'R2' },
      { addr: 0x0A, bytes: '21 00', text: 'LOAD  R0,[R0]  ; ret', cLine: 3, op: 'LOADR', dst: 'R0', ptrReg: 'R0' },
      { addr: 0x0C, bytes: 'FF 00', text: 'HALT', cLine: 3, op: 'HALT' }
    ]
  },
  heap: {
    name: '5. Heap malloc()',
    cLines: [
      'int *p = malloc(4);',
      'p[0] = 42;',
      'p[1] = 99;',
      'int x = p[0] + p[1];',
      'return x;'
    ],
    initData: [],
    asm: [
      { addr: 0x00, bytes: 'A0 04', text: 'MALLOC R0, #4  ; Heap↑', cLine: 0, op: 'MALLOC', dst: 'R0', size: 4 },
      { addr: 0x02, bytes: '50 00', text: 'PUSH   R0      ; ptr', cLine: 0, op: 'PUSH', src: 'R0' },
      { addr: 0x04, bytes: '11 2A', text: 'MOV    R1, #42', cLine: 1, op: 'MOVI', dst: 'R1', val: 42 },
      { addr: 0x06, bytes: '28 01', text: 'STORE  [R0],R1 ; p[0]', cLine: 1, op: 'STORER', ptrReg: 'R0', src: 'R1' },
      { addr: 0x08, bytes: '12 63', text: 'MOV    R2, #99', cLine: 2, op: 'MOVI', dst: 'R2', val: 99 },
      { addr: 0x0A, bytes: '29 02', text: 'STORE  [R0+1],R2', cLine: 2, op: 'STORER', ptrReg: 'R0', offset: 1, src: 'R2' },
      { addr: 0x0C, bytes: '33 12', text: 'ADD    R3, R1,R2', cLine: 3, op: 'ADD', dst: 'R3', a: 'R1', b: 'R2' },
      { addr: 0x0E, bytes: '53 00', text: 'PUSH   R3      ; x=141', cLine: 3, op: 'PUSH', src: 'R3' },
      { addr: 0x10, bytes: 'FF 00', text: 'HALT', cLine: 4, op: 'HALT' }
    ]
  }
};

export function mountChapter5(section) {
  let activeProgKey = 'arith';
  let state = null;
  let history = [];
  let hexEditor = null;
  let playTimer = null;

  function makeState(progKey) {
    const p = PROGRAMS[progKey];
    const mem = new Uint8Array(256);
    for (const ins of p.asm) {
      const [b0, b1] = ins.bytes.split(' ');
      mem[ins.addr] = parseInt(b0, 16);
      mem[ins.addr + 1] = parseInt(b1, 16);
    }
    for (const d of p.initData) d.bytes.forEach((b, i) => { mem[d.addr + i] = b; });
    return {
      progKey, cycle: 0, phase: 0, halted: false,
      regs: { PC: 0x00, SP: 0x100, FP: 0x100, R0: 0, R1: 0, R2: 0, R3: 0 },
      flags: { Z: 0, G: 0 }, ir: '-- --', heapTop: 0x30, mem,
      aluText: 'IDLE', changedReg: null, readRegs: [],
      caption: `Loaded <strong>${p.name}</strong> — click <strong>Step Cycle</strong> or <strong>Step Instruction</strong>!`
    };
  }

  function cloneState(s) {
    return { ...s, regs: { ...s.regs }, flags: { ...s.flags }, mem: new Uint8Array(s.mem), readRegs: [...s.readRegs] };
  }

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 05</div>
      <h2 class="chapter-title">From C Code to Machine Code</h2>
      <p class="chapter-lead">Programming languages like C are designed for human brains, but silicon only understands raw numbered opcodes. Watch how a compiler bridges the gap — then step through every single clock cycle yourself.</p>
    </div>

    <!-- Progressive 3-Beat Scrollytelling Intro -->
    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · Human Code</div>
            <div class="beat-title">Start with Simple C Code</div>
            <p class="beat-body">In C, you write expressive ideas like <code>int a = 5;</code>, <code>for</code> loops, and function calls without worrying about registers or memory addresses. Before your program can run, a <strong>Compiler</strong> (like GCC or Clang) translates it ahead of time.</p>
            <div class="beat-note"><strong>Remember:</strong> At runtime, variable names like <code>a</code> and <code>b</code> no longer exist — they become register numbers and Stack offsets!</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Compilation</div>
            <div class="beat-title">Assembly &amp; Hex Machine Bytes</div>
            <p class="beat-body">A single C statement often compiles into 2–4 tiny instructions. <strong>Assembly</strong> (<code>MOV R0, #5</code>) is simply a human-readable nickname for the raw <strong>Machine Code</strong> hex bytes (<code>10 05</code>) stored in RAM at <code>0x0000</code>.</p>
            <div class="beat-note"><strong>One-to-one mapping:</strong> Every assembly line maps directly to a fixed sequence of machine bytes — nothing is hidden.</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Execution in Motion</div>
            <div class="beat-title">Registers, PC &amp; Stack Push</div>
            <p class="beat-body">As <code>PC</code> marches forward instruction by instruction, data moves into <code>R0–R3</code>, flows through the <code>ALU</code>, and gets pushed onto the <strong>Stack</strong> (<code>SP ↓</code>). Loops rewind <code>PC</code> backwards; <code>CALL</code> pushes a return address so <code>RET</code> knows where to jump back.</p>
            <div class="beat-note"><strong>Scroll down to the complete lab:</strong> Try all 5 C programs below — especially <strong>4. Strings &amp; Pointers</strong> to watch <code>"HI!"</code> mutate to <code>"BI!"</code> live inside the Hex Editor!</div>
          </div>
        </div>
      </div>

      <div class="sticky-stage" style="min-height:400px">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot"></span>
            <span id="c5-intro-cap">Step 1: High-level C code before compilation.</span>
          </div>
          <span class="pill pill-blue" id="c5-intro-pill">C Source</span>
        </div>

        <div class="stage-canvas" style="justify-content:center">
          <div class="grid-3" style="align-items:stretch">
            <!-- Intro Col 1: C -->
            <div class="subcard reveal-part visible">
              <div class="subcard-title">1. C Source</div>
              <div class="code-pane">
                <div class="code-line active-c"><span class="code-line-num">1</span><span>int a = 5;</span></div>
                <div class="code-line"><span class="code-line-num">2</span><span>int b = 7;</span></div>
                <div class="code-line"><span class="code-line-num">3</span><span>int c = a + b;</span></div>
              </div>
            </div>

            <!-- Intro Col 2: Compiled Assembly (Beat 1+) -->
            <div class="subcard reveal-part" id="c5-intro-asm">
              <div class="subcard-title">2. Compiled Assembly</div>
              <div class="code-pane">
                <div class="code-line active-asm" id="c5-in-a1"><span class="code-bytes">10 05</span><span>MOV R0, #5</span></div>
                <div class="code-line" id="c5-in-a2"><span class="code-bytes">50 00</span><span>PUSH R0</span></div>
                <div class="code-line"><span class="code-bytes">11 07</span><span>MOV R1, #7</span></div>
                <div class="code-line"><span class="code-bytes">32 01</span><span>ADD R2, R0, R1</span></div>
              </div>
            </div>

            <!-- Intro Col 3: Registers & Stack (Beat 2+) -->
            <div class="subcard reveal-part" id="c5-intro-cpu">
              <div class="subcard-title">3. Live CPU + Stack</div>
              <div class="reg-box changed" id="c5-in-r0"><span class="reg-name">R0</span><span class="reg-val">5 (0x05)</span></div>
              <div class="reg-box" id="c5-in-pc"><span class="reg-name" style="color:var(--blue)">PC</span><span class="reg-val">0x0002</span></div>
              <div class="mem-slot stack-frame" id="c5-in-stk"><span>SP→ 0x00FE</span><strong>a = 5</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- COMPLETE INTERACTIVE 4-PANE SETUP AT BOTTOM OF CHAPTER -->
    <div class="complete-setup" id="c5-complete">
      <div class="complete-head">
        <div>
          <span class="pill pill-emerald" style="margin-right:8px">COMPLETE INTERACTIVE LAB</span>
          <strong style="font-size:16px">Step Through C → Assembly → CPU → Live Hex Editor</strong>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px" id="c5-prog-tabs">
          ${Object.entries(PROGRAMS).map(([k, p]) => `<button class="btn btn-sm${k === 'arith' ? ' active-tab' : ''}" data-prog="${k}">${p.name}</button>`).join('')}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:var(--bg-subtle);padding:8px 12px;border-radius:10px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" id="c5-step-cyc">⚡ Step Cycle</button>
          <button class="btn btn-amber btn-sm" id="c5-step-ins">⏭ Step Instruction</button>
          <button class="btn btn-sm" id="c5-back">↶ Back</button>
          <button class="btn btn-emerald btn-sm" id="c5-play">▶ Play</button>
          <button class="btn btn-ghost btn-sm" id="c5-reset">↺ Reset</button>
        </div>
        <div class="stage-caption" style="font-size:12.5px">
          <span class="live-dot"></span>
          <span id="c5-lab-cap">Ready to execute.</span>
        </div>
      </div>

      <div class="lab-4pane">
        <!-- Pane 1: C -->
        <div class="subcard">
          <div class="subcard-head">
            <span class="subcard-title">1. C Code</span>
            <span class="pill pill-blue">Source</span>
          </div>
          <div class="code-pane" id="c5-c-pane"></div>
        </div>

        <!-- Pane 2: Assembly -->
        <div class="subcard">
          <div class="subcard-head">
            <span class="subcard-title">2. Assembly &amp; Hex</span>
            <span class="pill pill-amber" id="c5-pc-badge">PC: 0x0000</span>
          </div>
          <div class="code-pane" id="c5-asm-pane"></div>
        </div>

        <!-- Pane 3: CPU -->
        <div class="subcard">
          <div class="subcard-head">
            <span class="subcard-title">3. CPU Core</span>
            <span class="pill pill-violet" id="c5-cyc-badge">Cycle #0</span>
          </div>
          <div class="phase-stepper" id="c5-phase-bar">
            <div class="phase-chip" data-ph="0">FETCH</div>
            <div class="phase-chip" data-ph="1">DECODE</div>
            <div class="phase-chip" data-ph="2">EXEC</div>
          </div>
          <div class="reg-grid">
            <div class="reg-box" id="c5-r-PC"><span class="reg-name" style="color:var(--blue)">PC</span><span class="reg-val">0x0000</span></div>
            <div class="reg-box" id="c5-r-IR"><span class="reg-name" style="color:var(--amber)">IR</span><span class="reg-val">-- --</span></div>
            <div class="reg-box" id="c5-r-SP"><span class="reg-name" style="color:var(--emerald)">SP</span><span class="reg-val">0x0100</span></div>
            <div class="reg-box" id="c5-r-FP"><span class="reg-name" style="color:var(--emerald)">FP</span><span class="reg-val">0x0100</span></div>
            <div class="reg-box" id="c5-r-R0"><span class="reg-name">R0</span><span class="reg-val">0</span></div>
            <div class="reg-box" id="c5-r-R1"><span class="reg-name">R1</span><span class="reg-val">0</span></div>
            <div class="reg-box" id="c5-r-R2"><span class="reg-name">R2</span><span class="reg-val">0</span></div>
            <div class="reg-box" id="c5-r-R3"><span class="reg-name">R3</span><span class="reg-val">0</span></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:11px;padding:4px 8px;background:#fff;border:1px solid var(--border);border-radius:6px">
            <span style="color:var(--ink-muted)">FLAGS</span>
            <span>Z:<strong id="c5-fz">0</strong></span>
            <span>G:<strong id="c5-fg">0</strong></span>
          </div>
          <div class="alu-box" id="c5-alu">
            <div style="font-size:9.5px;color:var(--ink-muted);font-weight:700">ALU / DATAFLOW</div>
            <div id="c5-alu-txt" style="font-size:14px;font-weight:800;color:var(--blue);margin-top:2px">IDLE</div>
          </div>
        </div>

        <!-- Pane 4: Live Hex Editor -->
        <div class="subcard">
          <div class="subcard-head">
            <span class="subcard-title">4. RAM Hex Editor</span>
            <span class="pill pill-emerald">Heap ↑ · Stack ↓</span>
          </div>
          <div id="c5-hex-mount"></div>
        </div>
      </div>
    </div>
  `;

  // Scrollytelling intro beats
  const introCap = section.querySelector('#c5-intro-cap');
  const introPill = section.querySelector('#c5-intro-pill');
  observeBeats(section, (beatIdx) => {
    section.querySelector('#c5-intro-asm').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c5-intro-cpu').classList.toggle('visible', beatIdx >= 2);
    if (beatIdx === 0) {
      introPill.textContent = '1 / 3 · C Source';
      setCaption(introCap, '<strong>Step 1:</strong> Clean high-level C code — easy for humans, unreadable to silicon.');
    } else if (beatIdx === 1) {
      introPill.textContent = '2 / 3 · Compiled';
      setCaption(introCap, '<strong>Step 2:</strong> Compiler translates <code>int a = 5;</code> into <code>MOV R0, #5</code> (<code>10 05</code>) + <code>PUSH R0</code> (<code>50 00</code>).');
    } else {
      introPill.textContent = '3 / 3 · Executing';
      setCaption(introCap, '<strong>Step 3:</strong> CPU moves <code>5</code> into <code>R0</code> and pushes it onto the Stack — now explore all 5 programs below!');
      flyPacket(section.querySelector('#c5-in-a1'), section.querySelector('#c5-in-r0'), '5', { color: '#2563eb' });
      setTimeout(() => flyPacket(section.querySelector('#c5-in-r0'), section.querySelector('#c5-in-stk'), 'PUSH 5', { color: '#059669' }), 420);
    }
  });

  // Full 4-Pane Interactive Debugger
  state = makeState(activeProgKey);
  const cPane = section.querySelector('#c5-c-pane');
  const asmPane = section.querySelector('#c5-asm-pane');
  const labCap = section.querySelector('#c5-lab-cap');
  const playBtn = section.querySelector('#c5-play');
  const aluBox = section.querySelector('#c5-alu');
  const aluTxt = section.querySelector('#c5-alu-txt');

  function curIns() {
    return PROGRAMS[state.progKey].asm.find((i) => i.addr === state.regs.PC) || null;
  }

  function getRegion(addr) {
    if (addr < 0x20) return 'code';
    if (addr < 0x30) return 'data';
    if (addr < state.heapTop) return 'heap';
    if (addr >= state.regs.SP) return 'stack';
    return 'zero';
  }

  hexEditor = new HexEditor(section.querySelector('#c5-hex-mount'), {
    bytes: state.mem,
    baseAddr: 0,
    rowAddresses: [0x00, 0x08, 0x10, 0x20, 0x30, 0xF0, 0xF8],
    editable: false,
    spAddr: null,
    pcAddr: 0,
    legend: [
      { label: 'Code', color: '#2563eb' },
      { label: 'String', color: '#d97706' },
      { label: 'Heap ↑', color: '#7c3aed' },
      { label: 'Stack ↓', color: '#059669' }
    ],
    getRegion,
    getRegionLabel: (a) => (getRegion(a) === 'zero' ? 'FREE' : getRegion(a).toUpperCase())
  });

  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    playBtn.textContent = '▶ Play';
  }

  function renderLab(flashes = []) {
    const p = PROGRAMS[state.progKey];
    const ins = curIns();
    cPane.innerHTML = p.cLines.map((l, i) => `
      <div class="code-line${ins && ins.cLine === i ? ' active-c' : ''}">
        <span class="code-line-num">${i + 1}</span><span style="white-space:pre">${l}</span>
      </div>
    `).join('');

    asmPane.innerHTML = p.asm.map((a) => {
      const isCur = ins && ins.addr === a.addr;
      return `
        <div class="code-line${isCur ? ' active-asm' : ''}" id="c5-asm-${a.addr}">
          <span class="code-addr">${isCur ? '▶' : ' '} ${hex4(a.addr)}</span>
          <span class="code-bytes">${a.bytes}</span>
          <span style="white-space:pre">${a.text}</span>
        </div>
      `;
    }).join('');

    section.querySelector('#c5-pc-badge').textContent = `PC: ${hex4(state.regs.PC)}`;
    section.querySelector('#c5-cyc-badge').textContent = `Cycle #${state.cycle}`;
    const activePh = state.cycle === 0 ? -1 : (state.phase + 2) % 3;
    section.querySelectorAll('#c5-phase-bar .phase-chip').forEach((ch) => {
      const n = Number(ch.dataset.ph);
      ch.className = 'phase-chip';
      if (n === activePh && !state.halted) ch.classList.add(n === 0 ? 'active-fetch' : n === 1 ? 'active-decode' : 'active-execute');
    });

    ['PC', 'SP', 'FP', 'R0', 'R1', 'R2', 'R3'].forEach((r) => {
      const box = section.querySelector(`#c5-r-${r}`);
      const v = state.regs[r];
      box.querySelector('.reg-val').textContent = (r === 'PC' || r === 'SP' || r === 'FP') ? hex4(v) : `${v} (0x${hex2(v)})`;
      box.classList.toggle('changed', state.changedReg === r);
      box.classList.toggle('read-hit', state.readRegs.includes(r));
    });
    section.querySelector('#c5-r-IR .reg-val').textContent = state.ir;
    section.querySelector('#c5-fz').textContent = String(state.flags.Z);
    section.querySelector('#c5-fg').textContent = String(state.flags.G);
    aluTxt.textContent = state.aluText;
    aluBox.classList.toggle('firing', activePh === 2 && !state.halted);

    hexEditor.update({ bytes: state.mem, spAddr: state.regs.SP < 0x100 ? state.regs.SP : null, pcAddr: state.regs.PC });
    flashes.forEach((f) => hexEditor.flash(f.addr, f.mode));
    setCaption(labCap, state.caption);
  }

  function stepCycle(animate = true) {
    if (state.halted) { stopPlay(); return false; }
    history.push(cloneState(state));
    if (history.length > 100) history.shift();
    const ins = curIns();
    if (!ins) { state.halted = true; renderLab(); return false; }

    state.cycle++;
    state.changedReg = null;
    state.readRegs = [];
    const flashes = [];

    if (state.phase === 0) {
      state.ir = ins.bytes;
      state.aluText = `FETCH ${hex4(ins.addr)}`;
      state.phase = 1;
      state.caption = `<strong>Cycle #${state.cycle} (FETCH):</strong> Loaded <code>${ins.bytes}</code> into <code>IR</code>.`;
      flashes.push({ addr: ins.addr, mode: 'read' });
      renderLab(flashes);
      if (animate) flyPacket(section.querySelector(`#c5-asm-${ins.addr}`), section.querySelector('#c5-r-IR'), ins.bytes, { color: '#2563eb' });
      return true;
    }
    if (state.phase === 1) {
      state.aluText = `DECODE ${ins.op}`;
      state.phase = 2;
      state.caption = `<strong>Cycle #${state.cycle} (DECODE):</strong> Decoded <code>${ins.text.trim()}</code>.`;
      renderLab();
      return true;
    }

    const seqPC = ins.addr + 2;
    let nextPC = seqPC;
    const regEl = (n) => section.querySelector(`#c5-r-${n}`);

    switch (ins.op) {
      case 'MOVI':
        state.regs[ins.dst] = ins.val; state.changedReg = ins.dst;
        state.aluText = `${ins.dst} ← ${ins.val}`;
        state.caption = `<strong>Cycle #${state.cycle}:</strong> Loaded <code>${ins.val}</code> into <code>${ins.dst}</code>.`;
        if (animate) flyPacket(section.querySelector('#c5-r-IR'), regEl(ins.dst), String(ins.val), { color: '#d97706' });
        break;
      case 'MOVR':
        state.regs[ins.dst] = state.regs[ins.src]; state.readRegs = [ins.src]; state.changedReg = ins.dst;
        state.aluText = `${ins.dst} ← ${ins.src}`;
        state.caption = `<strong>Cycle #${state.cycle}:</strong> Copied <code>${ins.src}</code> into <code>${ins.dst}</code>.`;
        break;
      case 'PUSH': {
        const v = state.regs[ins.src];
        state.regs.SP -= 2;
        state.mem[state.regs.SP] = (v >> 8) & 0xff;
        state.mem[state.regs.SP + 1] = v & 0xff;
        state.readRegs = [ins.src]; state.changedReg = 'SP';
        state.aluText = `PUSH ${v} → [${hex4(state.regs.SP)}]`;
        state.caption = `<strong>Cycle #${state.cycle} (PUSH):</strong> Decreased <code>SP</code> ↓ to <code>${hex4(state.regs.SP)}</code> and pushed <code>${v}</code> onto the Stack!`;
        flashes.push({ addr: state.regs.SP, mode: 'write' }, { addr: state.regs.SP + 1, mode: 'write' });
        renderLab(flashes);
        if (animate) flyPacket(regEl(ins.src), hexEditor.getCellEl(state.regs.SP), `PUSH ${v}`, { color: '#059669' });
        state.regs.PC = nextPC; state.phase = 0; return true;
      }
      case 'POP': {
        const a = state.regs.SP;
        state.regs[ins.dst] = (state.mem[a] << 8) | state.mem[a + 1];
        state.regs.SP += 2; state.changedReg = ins.dst;
        state.aluText = `POP → ${ins.dst}`;
        state.caption = `<strong>Cycle #${state.cycle} (POP):</strong> Popped Stack → <code>${ins.dst}</code>, <code>SP</code> ↑ <code>${hex4(state.regs.SP)}</code>.`;
        flashes.push({ addr: a, mode: 'read' });
        break;
      }
      case 'ADD':
      case 'ADDI':
      case 'MUL': {
        const va = state.regs[ins.a];
        const vb = ins.op === 'ADDI' ? ins.val : state.regs[ins.b];
        const res = (ins.op === 'MUL' ? va * vb : va + vb) & 0xff;
        state.regs[ins.dst] = res; state.changedReg = ins.dst;
        state.aluText = `${va} ${ins.op === 'MUL' ? '×' : '+'} ${vb} = ${res}`;
        state.caption = `<strong>Cycle #${state.cycle} (ALU):</strong> Computed <code>${state.aluText}</code> → stored in <code>${ins.dst}</code>.`;
        if (animate) flyPacket(aluBox, regEl(ins.dst), `=${res}`, { color: '#d97706' });
        break;
      }
      case 'CMP':
        state.flags.Z = state.regs[ins.a] === state.regs[ins.b] ? 1 : 0;
        state.flags.G = state.regs[ins.a] > state.regs[ins.b] ? 1 : 0;
        state.aluText = `CMP → G=${state.flags.G}`;
        state.caption = `<strong>Cycle #${state.cycle} (CMP):</strong> Updated CPU Flags (<code>Z=${state.flags.Z}, G=${state.flags.G}</code>).`;
        break;
      case 'JG':
        if (state.flags.G === 1) { nextPC = ins.target; state.changedReg = 'PC'; state.aluText = `JUMP → ${hex4(nextPC)}`; }
        else state.aluText = 'NO JUMP';
        state.caption = `<strong>Cycle #${state.cycle} (JG):</strong> ${state.flags.G ? `Loop done — PC jumped to <code>${hex4(nextPC)}</code>!` : 'Continuing loop.'}`;
        break;
      case 'JMP':
        nextPC = ins.target; state.changedReg = 'PC'; state.aluText = `PC ← ${hex4(nextPC)}`;
        state.caption = `<strong>Cycle #${state.cycle} (JMP):</strong> Rewound <code>PC</code> back to <code>${hex4(nextPC)}</code>.`;
        break;
      case 'CALL':
        state.regs.SP -= 2;
        state.mem[state.regs.SP] = (seqPC >> 8) & 0xff;
        state.mem[state.regs.SP + 1] = seqPC & 0xff;
        nextPC = ins.target; state.changedReg = 'PC';
        state.aluText = `CALL → PUSH RET`;
        state.caption = `<strong>Cycle #${state.cycle} (CALL):</strong> Pushed return addr <code>${hex4(seqPC)}</code> onto Stack &amp; jumped <code>PC → ${hex4(nextPC)}</code>!`;
        flashes.push({ addr: state.regs.SP, mode: 'write' }, { addr: state.regs.SP + 1, mode: 'write' });
        renderLab(flashes);
        if (animate) flyPacket(regEl('PC'), hexEditor.getCellEl(state.regs.SP), `RET ${hex4(seqPC)}`, { color: '#059669' });
        state.regs.PC = nextPC; state.phase = 0; return true;
      case 'RET': {
        const a = state.regs.SP;
        nextPC = (state.mem[a] << 8) | state.mem[a + 1];
        state.regs.SP += 2; state.changedReg = 'PC';
        state.aluText = `RET → ${hex4(nextPC)}`;
        state.caption = `<strong>Cycle #${state.cycle} (RET):</strong> Popped return addr <code>${hex4(nextPC)}</code> straight back into <code>PC</code>!`;
        flashes.push({ addr: a, mode: 'read' });
        if (animate) flyPacket(hexEditor.getCellEl(a), regEl('PC'), hex4(nextPC), { color: '#2563eb' });
        break;
      }
      case 'LOADR': {
        const a = state.regs[ins.ptrReg] + (ins.offset || 0);
        const v = state.mem[a];
        state.regs[ins.dst] = v; state.changedReg = ins.dst;
        state.aluText = `${ins.dst} ← [${hex4(a)}]`;
        state.caption = `<strong>Cycle #${state.cycle} (LOAD):</strong> Read <code>0x${hex2(v)}</code> from <code>${hex4(a)}</code> into <code>${ins.dst}</code>.`;
        flashes.push({ addr: a, mode: 'read' });
        if (animate) flyPacket(hexEditor.getCellEl(a), regEl(ins.dst), `0x${hex2(v)}`, { color: '#2563eb' });
        break;
      }
      case 'STORER': {
        const a = state.regs[ins.ptrReg] + (ins.offset || 0);
        const v = state.regs[ins.src] & 0xff;
        state.mem[a] = v;
        state.aluText = `[${hex4(a)}] ← 0x${hex2(v)}`;
        state.caption = `<strong>Cycle #${state.cycle} (STORE):</strong> Wrote <code>0x${hex2(v)}</code> to <code>${hex4(a)}</code> — watch the Hex Editor update live!`;
        flashes.push({ addr: a, mode: 'write' });
        renderLab(flashes);
        if (animate) flyPacket(regEl(ins.src), hexEditor.getCellEl(a), `0x${hex2(v)}`, { color: '#d97706' });
        state.regs.PC = nextPC; state.phase = 0; return true;
      }
      case 'MALLOC': {
        const a = state.heapTop; state.heapTop += ins.size;
        state.regs[ins.dst] = a; state.changedReg = ins.dst;
        state.aluText = `HEAP → ${hex4(a)}`;
        state.caption = `<strong>Cycle #${state.cycle} (MALLOC):</strong> Allocated ${ins.size}B on Heap at <code>${hex4(a)}</code> → returned pointer in <code>${ins.dst}</code>!`;
        flashes.push({ addr: a, mode: 'write' });
        break;
      }
      case 'HALT':
        state.halted = true;
        state.aluText = `HALT ✓ (R0=${state.regs.R0})`;
        state.caption = `<strong>Program Halted ✓</strong> in ${state.cycle} cycles. Return value: <code>R0 = ${state.regs.R0}</code>.`;
        stopPlay(); renderLab(); return false;
    }

    state.regs.PC = nextPC;
    state.phase = 0;
    renderLab(flashes);
    return true;
  }

  section.querySelector('#c5-step-cyc').addEventListener('click', () => { stopPlay(); stepCycle(true); });
  section.querySelector('#c5-step-ins').addEventListener('click', () => {
    stopPlay();
    const steps = 3 - state.phase;
    for (let i = 0; i < steps; i++) if (!stepCycle(i === steps - 1)) break;
  });
  section.querySelector('#c5-back').addEventListener('click', () => { stopPlay(); if (history.length) { state = history.pop(); renderLab(); } });
  playBtn.addEventListener('click', () => {
    if (playTimer) stopPlay();
    else {
      if (state.halted) { state = makeState(activeProgKey); history = []; }
      playBtn.textContent = '⏸ Pause';
      stepCycle(true);
      playTimer = setInterval(() => { if (!stepCycle(true)) stopPlay(); }, 650);
    }
  });
  section.querySelector('#c5-reset').addEventListener('click', () => { stopPlay(); state = makeState(activeProgKey); history = []; renderLab(); });

  section.querySelectorAll('#c5-prog-tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      stopPlay();
      activeProgKey = btn.dataset.prog;
      section.querySelectorAll('#c5-prog-tabs button').forEach((b) => b.classList.toggle('active-tab', b === btn));
      state = makeState(activeProgKey);
      history = [];
      renderLab();
    });
  });

  renderLab();
}

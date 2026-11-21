import { setNarration, hex4, flyPacket } from '../components/animator.js';

const PROG_A = [
  { addr: 0x1000, text: 'LOAD R0, [audio_buf]' },
  { addr: 0x1004, text: 'ADD  R0, R0, #12  ; mix' },
  { addr: 0x1008, text: 'OUT  DAC, R0      ; play' },
  { addr: 0x100C, text: 'JMP  0x1000       ; loop' }
];

const PROG_B = [
  { addr: 0x2000, text: 'LOAD R0, [player_x]' },
  { addr: 0x2004, text: 'ADD  R0, R0, #4   ; move' },
  { addr: 0x2008, text: 'DRAW R0, SPRITE   ; gpu' },
  { addr: 0x200C, text: 'JMP  0x2000       ; loop' }
];

const ISR_KBD = [
  { addr: 0x8000, text: 'PUSH R0           ; save reg' },
  { addr: 0x8004, text: 'IN   R0, KBD_PORT ; read key' },
  { addr: 0x8008, text: 'POP  R0 & IRET    ; resume!' }
];

const ISR_TIMER = [
  { addr: 0x8100, text: 'SAVE_CTX -> PCB   ; freeze old' },
  { addr: 0x8104, text: 'LOAD_CTX <- PCB   ; swap task' },
  { addr: 0x8108, text: 'IRET              ; jump PC!' }
];

export function createModule6() {
  let activeTask = 'A'; // 'A' | 'B'
  let mode = 'USER'; // 'USER' | 'IRQ_KBD' | 'IRQ_TIMER'
  let cpuPC = 0x1000;
  let cpuR0 = 10;
  let kernelStack = [];
  let pcbA = { PC: 0x1000, R0: 10, SP: 0x3FF0 };
  let pcbB = { PC: 0x2000, R0: 50, SP: 0x4FF0 };
  let isrStep = 0;
  let pendingIrq = null; // null | 'KBD' | 'TIMER'
  let timeline = [];
  let autoTimer = null;
  let autoPreempt = true;
  let ticksSinceSwitch = 0;

  function resetState() {
    activeTask = 'A';
    mode = 'USER';
    cpuPC = 0x1000;
    cpuR0 = 10;
    kernelStack = [];
    pcbA = { PC: 0x1000, R0: 10, SP: 0x3FF0 };
    pcbB = { PC: 0x2000, R0: 50, SP: 0x4FF0 };
    isrStep = 0;
    pendingIrq = null;
    timeline = [];
    ticksSinceSwitch = 0;
  }

  function stopAuto(btn) {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
    if (btn) btn.textContent = '▶ Run CPU';
  }

  return {
    init(container) {
      resetState();

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <button class="btn btn-primary btn-sm" id="m6-step">⚡ Step 1 Instruction</button>
            <button class="btn btn-emerald btn-sm" id="m6-run">▶ Run CPU</button>
            <button class="btn btn-ghost btn-sm" id="m6-reset">↺ Reset</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <button class="btn btn-coral btn-sm" id="m6-irq-kbd">⌨ Trigger Keyboard IRQ 1</button>
            <button class="btn btn-amber btn-sm" id="m6-irq-timer">⏱ Trigger Timer Preemption (IRQ 0)</button>
          </div>
          <div class="toolbar-divider"></div>
          <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-secondary);cursor:pointer">
            <input type="checkbox" id="m6-auto-preempt" checked /> Auto Timer Slice (every 5 ticks)
          </label>
        </div>

        <div class="grid-3" style="flex:1">
          <!-- Left: Two User Programs -->
          <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
            <div class="card" id="m6-card-a" style="flex:1;border-color:rgba(56,189,248,0.5)">
              <div class="card-header">
                <div class="card-title"><span class="dot"></span>Program A: Music Player</div>
                <span class="pill pill-cyan" id="m6-state-a">RUNNING</span>
              </div>
              <div class="code-pane" id="m6-code-a"></div>
              <div class="reg-box" id="m6-pcb-a" style="font-size:11px">
                <span class="reg-name" style="color:var(--cyan)">Saved PCB_A</span>
                <span class="reg-val" style="font-size:11px">PC:0x1000 R0:10</span>
              </div>
            </div>

            <div class="card" id="m6-card-b" style="flex:1">
              <div class="card-header">
                <div class="card-title"><span class="dot" style="background:var(--violet)"></span>Program B: Game Loop</div>
                <span class="pill" id="m6-state-b">PAUSED</span>
              </div>
              <div class="code-pane" id="m6-code-b"></div>
              <div class="reg-box" id="m6-pcb-b" style="font-size:11px">
                <span class="reg-name" style="color:var(--violet)">Saved PCB_B</span>
                <span class="reg-val" style="font-size:11px">PC:0x2000 R0:50</span>
              </div>
            </div>
          </div>

          <!-- Center: The Single Live CPU + Interrupt Pin + Kernel Stack -->
          <div class="card">
            <div class="card-header">
              <div class="card-title"><span class="dot" style="background:var(--amber)"></span>Single Physical CPU Core</div>
              <span class="pill pill-cyan" id="m6-mode-pill">USER MODE (Task A)</span>
            </div>

            <!-- Hardware IRQ Line Banner -->
            <div id="m6-irq-banner" style="padding:8px 10px;border-radius:7px;border:1px solid var(--border);background:#090e17;display:flex;justify-content:space-between;align-items:center;font-family:var(--font-mono);font-size:11px">
              <span>IRQ Hardware Pin:</span>
              <span id="m6-irq-pin" style="color:var(--text-muted)">● LOW (No Interrupt)</span>
            </div>

            <!-- Live CPU Registers -->
            <div class="reg-grid">
              <div class="reg-box" id="m6-cpu-pc">
                <span class="reg-name" style="color:var(--cyan)">Live PC</span>
                <span class="reg-val">0x1000</span>
              </div>
              <div class="reg-box" id="m6-cpu-r0">
                <span class="reg-name">Live R0</span>
                <span class="reg-val">10</span>
              </div>
            </div>

            <!-- Interrupt Vector Table (IVT) -->
            <div style="background:#090e17;border:1px solid var(--border);border-radius:7px;padding:8px 10px;font-family:var(--font-mono);font-size:11px">
              <div style="color:var(--text-muted);font-size:10px;margin-bottom:4px">INTERRUPT VECTOR TABLE (IVT — Hardware Lookup)</div>
              <div id="m6-ivt-0" style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px">
                <span>IRQ 0 (Hardware Timer)</span>
                <span style="color:var(--amber)">→ 0x8100 (Scheduler)</span>
              </div>
              <div id="m6-ivt-1" style="display:flex;justify-content:space-between;padding:3px 6px;border-radius:4px">
                <span>IRQ 1 (Keyboard Press)</span>
                <span style="color:var(--coral)">→ 0x8000 (Kbd ISR)</span>
              </div>
            </div>

            <!-- Kernel Stack (Saves Interrupted PC!) -->
            <div style="flex:1;background:#090e17;border:1px solid rgba(52,211,153,0.35);border-radius:7px;padding:8px 10px;display:flex;flex-direction:column;gap:4px" id="m6-kstack-box">
              <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--emerald);font-weight:700">
                <span>KERNEL INTERRUPT STACK</span>
                <span>LIFO</span>
              </div>
              <div id="m6-kstack-items" style="display:flex;flex-direction:column;gap:4px;margin-top:4px"></div>
            </div>
          </div>

          <!-- Right: OS Kernel ISRs -->
          <div style="display:flex;flex-direction:column;gap:10px;min-height:0">
            <div class="card" id="m6-card-kbd" style="flex:1">
              <div class="card-header">
                <div class="card-title"><span class="dot" style="background:var(--coral)"></span>Kernel ISR: Keyboard (0x8000)</div>
                <span class="pill pill-coral">IRQ 1</span>
              </div>
              <div class="code-pane" id="m6-code-kbd"></div>
            </div>

            <div class="card" id="m6-card-timer" style="flex:1">
              <div class="card-header">
                <div class="card-title"><span class="dot" style="background:var(--amber)"></span>OS Scheduler / Preempt (0x8100)</div>
                <span class="pill pill-amber">IRQ 0</span>
              </div>
              <div class="code-pane" id="m6-code-timer"></div>
            </div>
          </div>
        </div>

        <!-- Bottom: Live Multitasking Timeline -->
        <div class="card" style="padding:8px 12px;gap:6px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.06em">Live CPU Time-Slicing Timeline (How 1 CPU runs 2 programs at once!)</span>
            <div style="display:flex;gap:10px;font-size:10.5px">
              <span style="color:var(--cyan)">■ Prog A</span>
              <span style="color:var(--violet)">■ Prog B</span>
              <span style="color:var(--coral)">■ IRQ / Kernel</span>
            </div>
          </div>
          <div class="timeline-strip" id="m6-timeline"></div>
        </div>
      `;

      const runBtn = container.querySelector('#m6-run');

      function pushTimeline(kind, label) {
        timeline.push({ kind, label });
        if (timeline.length > 26) timeline.shift();
      }

      function renderCodeList(el, list, activeAddr) {
        el.innerHTML = list.map((ins) => `
          <div class="code-line${ins.addr === activeAddr ? ' active-asm' : ''}">
            <span class="code-addr">${ins.addr === activeAddr ? '▶' : ' '} ${hex4(ins.addr)}</span>
            <span style="white-space:pre">${ins.text}</span>
          </div>
        `).join('');
      }

      function render() {
        renderCodeList(container.querySelector('#m6-code-a'), PROG_A, mode === 'USER' && activeTask === 'A' ? cpuPC : -1);
        renderCodeList(container.querySelector('#m6-code-b'), PROG_B, mode === 'USER' && activeTask === 'B' ? cpuPC : -1);
        renderCodeList(container.querySelector('#m6-code-kbd'), ISR_KBD, mode === 'IRQ_KBD' ? cpuPC : -1);
        renderCodeList(container.querySelector('#m6-code-timer'), ISR_TIMER, mode === 'IRQ_TIMER' ? cpuPC : -1);

        // Card highlights
        container.querySelector('#m6-card-a').style.borderColor = mode === 'USER' && activeTask === 'A' ? 'var(--cyan)' : 'var(--border)';
        container.querySelector('#m6-card-b').style.borderColor = mode === 'USER' && activeTask === 'B' ? 'var(--violet)' : 'var(--border)';
        container.querySelector('#m6-card-kbd').style.borderColor = mode === 'IRQ_KBD' ? 'var(--coral)' : 'var(--border)';
        container.querySelector('#m6-card-timer').style.borderColor = mode === 'IRQ_TIMER' ? 'var(--amber)' : 'var(--border)';

        const stA = container.querySelector('#m6-state-a');
        const stB = container.querySelector('#m6-state-b');
        stA.textContent = mode === 'USER' && activeTask === 'A' ? 'RUNNING' : 'PAUSED';
        stA.className = mode === 'USER' && activeTask === 'A' ? 'pill pill-cyan' : 'pill';
        stB.textContent = mode === 'USER' && activeTask === 'B' ? 'RUNNING' : 'PAUSED';
        stB.className = mode === 'USER' && activeTask === 'B' ? 'pill pill-violet' : 'pill';

        container.querySelector('#m6-pcb-a .reg-val').textContent = `PC:${hex4(pcbA.PC)} R0:${pcbA.R0}`;
        container.querySelector('#m6-pcb-b .reg-val').textContent = `PC:${hex4(pcbB.PC)} R0:${pcbB.R0}`;

        container.querySelector('#m6-cpu-pc .reg-val').textContent = hex4(cpuPC);
        container.querySelector('#m6-cpu-r0 .reg-val').textContent = String(cpuR0);

        const modePill = container.querySelector('#m6-mode-pill');
        if (mode === 'USER') {
          modePill.textContent = `USER MODE (Task ${activeTask})`;
          modePill.className = activeTask === 'A' ? 'pill pill-cyan' : 'pill pill-violet';
        } else if (mode === 'IRQ_KBD') {
          modePill.textContent = 'KERNEL MODE (Kbd ISR)';
          modePill.className = 'pill pill-coral';
        } else {
          modePill.textContent = 'KERNEL MODE (Preempt)';
          modePill.className = 'pill pill-amber';
        }

        const irqPin = container.querySelector('#m6-irq-pin');
        if (pendingIrq) {
          irqPin.textContent = `⚡ HIGH (${pendingIrq} IRQ Pending!)`;
          irqPin.style.color = 'var(--coral)';
        } else if (mode !== 'USER') {
          irqPin.textContent = '● SERVICING ISR...';
          irqPin.style.color = 'var(--amber)';
        } else {
          irqPin.textContent = '● LOW (Normal Execution)';
          irqPin.style.color = 'var(--text-muted)';
        }

        container.querySelector('#m6-ivt-0').style.background = mode === 'IRQ_TIMER' ? 'rgba(245,158,11,0.2)' : 'transparent';
        container.querySelector('#m6-ivt-1').style.background = mode === 'IRQ_KBD' ? 'rgba(251,113,133,0.2)' : 'transparent';

        const kItems = container.querySelector('#m6-kstack-items');
        if (kernelStack.length === 0) {
          kItems.innerHTML = `<div style="font-size:11px;color:var(--text-muted)">Empty (no interrupted PC saved)</div>`;
        } else {
          kItems.innerHTML = kernelStack.slice().reverse().map((it) => `
            <div class="mem-slot stack-frame" style="margin-top:0">
              <span>${it.label}</span>
              <strong>${it.val}</strong>
            </div>
          `).join('');
        }

        const tl = container.querySelector('#m6-timeline');
        tl.innerHTML = timeline.map((s) => {
          const bg = s.kind === 'A' ? 'rgba(56,189,248,0.28)' : s.kind === 'B' ? 'rgba(167,139,250,0.28)' : 'rgba(251,113,133,0.38)';
          const col = s.kind === 'A' ? '#7dd3fc' : s.kind === 'B' ? '#ddd6fe' : '#fecdd3';
          return `<div class="tl-slice" style="background:${bg};color:${col}">${s.label}</div>`;
        }).join('');
      }

      function stepCpu() {
        // Check if a hardware interrupt is waiting at instruction boundary!
        if (mode === 'USER' && pendingIrq) {
          const irq = pendingIrq;
          pendingIrq = null;
          // Hardware automatically pushes interrupted PC onto Kernel Stack!
          kernelStack.push({ label: `Saved PC (Task ${activeTask})`, val: hex4(cpuPC) });
          isrStep = 0;

          if (irq === 'KBD') {
            mode = 'IRQ_KBD';
            cpuPC = 0x8000;
            pushTimeline('IRQ', 'KBD');
            flyPacket(container.querySelector('#m6-cpu-pc'), container.querySelector('#m6-kstack-box'), `PUSH ${kernelStack[kernelStack.length - 1].val}`, { color: '#fb7185' });
            setNarration(`<strong>⚡ HARDWARE INTERRUPT (IRQ 1)!</strong> CPU froze Task ${activeTask}, automatically pushed <code>PC</code> onto the <strong>Kernel Stack</strong>, and jumped via IVT to <code>0x8000</code>!`);
          } else {
            mode = 'IRQ_TIMER';
            cpuPC = 0x8100;
            pushTimeline('IRQ', 'TMR');
            flyPacket(container.querySelector('#m6-cpu-pc'), container.querySelector('#m6-kstack-box'), `PUSH ${kernelStack[kernelStack.length - 1].val}`, { color: '#f59e0b' });
            setNarration(`<strong>⏱ TIMER PREEMPTION (IRQ 0)!</strong> Task ${activeTask}'s time slice expired! Hardware pushed <code>PC</code> onto Stack and jumped to OS Scheduler <code>0x8100</code>.`);
          }
          render();
          return;
        }

        if (mode === 'IRQ_KBD') {
          if (isrStep === 0) {
            kernelStack.push({ label: `Saved R0`, val: String(cpuR0) });
            cpuPC = 0x8004;
            isrStep = 1;
            pushTimeline('IRQ', 'ISR');
            setNarration('<strong>Keyboard ISR (1/3):</strong> Saved <code>R0</code> onto Kernel Stack so we do not corrupt the interrupted program.');
          } else if (isrStep === 1) {
            cpuR0 = 0x41; // ASCII 'A'
            cpuPC = 0x8008;
            isrStep = 2;
            pushTimeline('IRQ', 'KEY');
            setNarration('<strong>Keyboard ISR (2/3):</strong> Read keystroke scan code (<code>\'A\'</code>) from Keyboard Controller port into <code>R0</code>.');
          } else {
            const savedR0 = kernelStack.pop();
            const savedPC = kernelStack.pop();
            cpuR0 = Number(savedR0.val);
            cpuPC = parseInt(savedPC.val, 16);
            mode = 'USER';
            isrStep = 0;
            flyPacket(container.querySelector('#m6-kstack-box'), container.querySelector('#m6-cpu-pc'), `IRET ${savedPC.val}`, { color: '#34d399' });
            setNarration(`<strong>IRET (Interrupt Return):</strong> Restored <code>R0=${cpuR0}</code> and popped <code>PC=${hex4(cpuPC)}</code>! Program ${activeTask} resumes seamlessly.`);
          }
          render();
          return;
        }

        if (mode === 'IRQ_TIMER') {
          if (isrStep === 0) {
            // Save outgoing task's PCB
            const savedPC = parseInt(kernelStack[kernelStack.length - 1].val, 16);
            if (activeTask === 'A') {
              pcbA.PC = savedPC;
              pcbA.R0 = cpuR0;
              flyPacket(container.querySelector('#m6-cpu-pc'), container.querySelector('#m6-pcb-a'), `SAVE A`, { color: '#38bdf8' });
            } else {
              pcbB.PC = savedPC;
              pcbB.R0 = cpuR0;
              flyPacket(container.querySelector('#m6-cpu-pc'), container.querySelector('#m6-pcb-b'), `SAVE B`, { color: '#a78bfa' });
            }
            cpuPC = 0x8104;
            isrStep = 1;
            pushTimeline('IRQ', 'CTX');
            setNarration(`<strong>Context Switch (1/3):</strong> OS saved Program ${activeTask}'s entire register state (<code>PC=${hex4(savedPC)}, R0=${cpuR0}</code>) into <strong>PCB_${activeTask}</strong>.`);
          } else if (isrStep === 1) {
            // Swap activeTask and load incoming PCB
            activeTask = activeTask === 'A' ? 'B' : 'A';
            const nextPcb = activeTask === 'A' ? pcbA : pcbB;
            kernelStack[kernelStack.length - 1] = { label: `Next PC (Task ${activeTask})`, val: hex4(nextPcb.PC) };
            cpuR0 = nextPcb.R0;
            flyPacket(container.querySelector(activeTask === 'A' ? '#m6-pcb-a' : '#m6-pcb-b'), container.querySelector('#m6-cpu-r0'), `LOAD ${activeTask}`, { color: activeTask === 'A' ? '#38bdf8' : '#a78bfa' });
            cpuPC = 0x8108;
            isrStep = 2;
            pushTimeline('IRQ', 'SWP');
            setNarration(`<strong>Context Switch (2/3):</strong> OS loaded Program ${activeTask}'s frozen registers (<code>PC=${hex4(nextPcb.PC)}, R0=${nextPcb.R0}</code>) from <strong>PCB_${activeTask}</strong>!`);
          } else {
            const nextPCEntry = kernelStack.pop();
            cpuPC = parseInt(nextPCEntry.val, 16);
            mode = 'USER';
            isrStep = 0;
            ticksSinceSwitch = 0;
            flyPacket(container.querySelector('#m6-kstack-box'), container.querySelector('#m6-cpu-pc'), `RESUME ${activeTask}`, { color: '#34d399' });
            setNarration(`<strong>Context Switch Complete (IRET)!</strong> CPU is now running <strong>Program ${activeTask}</strong> right where it left off (<code>PC=${hex4(cpuPC)}</code>)!`);
          }
          render();
          return;
        }

        // Normal USER execution
        ticksSinceSwitch++;
        const prog = activeTask === 'A' ? PROG_A : PROG_B;
        const idx = prog.findIndex((i) => i.addr === cpuPC);
        const ins = prog[idx] || prog[0];
        if (ins.text.includes('ADD')) cpuR0 += activeTask === 'A' ? 12 : 4;
        cpuPC = idx === prog.length - 1 ? prog[0].addr : prog[idx + 1].addr;

        if (activeTask === 'A') { pcbA.PC = cpuPC; pcbA.R0 = cpuR0; }
        else { pcbB.PC = cpuPC; pcbB.R0 = cpuR0; }

        pushTimeline(activeTask, activeTask);

        if (autoPreempt && ticksSinceSwitch >= 5) {
          pendingIrq = 'TIMER';
          setNarration(`Program ${activeTask} executed <code>${ins.text.trim()}</code> — <strong>Timer IRQ 0 just fired!</strong> Next step will preempt Task ${activeTask}.`);
        } else {
          setNarration(`<strong>Program ${activeTask}</strong> executed <code>${ins.text.trim()}</code> → <code>PC</code> moved to <code>${hex4(cpuPC)}</code> (<code>R0=${cpuR0}</code>).`);
        }
        render();
      }

      container.querySelector('#m6-step').addEventListener('click', () => {
        stopAuto(runBtn);
        stepCpu();
      });

      runBtn.addEventListener('click', () => {
        if (autoTimer) {
          stopAuto(runBtn);
        } else {
          runBtn.textContent = '⏸ Pause CPU';
          stepCpu();
          autoTimer = setInterval(stepCpu, 820);
        }
      });

      container.querySelector('#m6-reset').addEventListener('click', () => {
        stopAuto(runBtn);
        resetState();
        render();
        setNarration('Reset multitasking simulator. Click <strong>Run CPU</strong> or trigger a <strong>Keyboard / Timer Interrupt</strong>!');
      });

      container.querySelector('#m6-irq-kbd').addEventListener('click', () => {
        pendingIrq = 'KBD';
        render();
        setNarration('<strong>⌨ Keyboard IRQ 1 Armed!</strong> The CPU will check its Interrupt Pin on the very next cycle and jump to <code>0x8000</code>.');
      });

      container.querySelector('#m6-irq-timer').addEventListener('click', () => {
        pendingIrq = 'TIMER';
        render();
        setNarration('<strong>⏱ Timer IRQ 0 Armed!</strong> On the next step, the OS will preempt the running task and context-switch to the other program.');
      });

      container.querySelector('#m6-auto-preempt').addEventListener('change', (e) => {
        autoPreempt = e.target.checked;
      });

      render();
      setNarration('One CPU runs <strong>Program A</strong> and <strong>Program B</strong> by freezing <code>PC</code> on Hardware Timer Interrupts and swapping saved registers!');
    },

    destroy() {
      if (autoTimer) clearInterval(autoTimer);
      autoTimer = null;
    }
  };
}

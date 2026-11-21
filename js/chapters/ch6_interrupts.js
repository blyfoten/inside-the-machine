import { observeBeats, setCaption, hex4, flyPacket } from '../components/animator.js';

const PROG_A = [
  { addr: 0x1000, text: 'LOAD R0, [audio]' },
  { addr: 0x1004, text: 'ADD  R0, R0, #12' },
  { addr: 0x1008, text: 'OUT  DAC, R0' },
  { addr: 0x100C, text: 'JMP  0x1000' }
];
const PROG_B = [
  { addr: 0x2000, text: 'LOAD R0, [player]' },
  { addr: 0x2004, text: 'ADD  R0, R0, #4' },
  { addr: 0x2008, text: 'DRAW R0, SPRITE' },
  { addr: 0x200C, text: 'JMP  0x2000' }
];

export function mountChapter6(section) {
  let activeTask = 'A';
  let mode = 'USER'; // 'USER' | 'IRQ_KBD' | 'IRQ_TIMER'
  let cpuPC = 0x1000;
  let cpuR0 = 10;
  let kStack = [];
  let pcbA = { PC: 0x1000, R0: 10 };
  let pcbB = { PC: 0x2000, R0: 50 };
  let isrStep = 0;
  let pendingIrq = null;
  let timeline = [];
  let runTimer = null;
  let ticks = 0;

  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 06</div>
      <h2 class="chapter-title">Interrupts, Preemption &amp; Multitasking</h2>
      <p class="chapter-lead">A single CPU core can only execute one instruction at a time — yet your laptop plays music, runs a game, and reacts the instant you touch a key. The secret is hardware interrupts and rapid context switching.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · Normal Execution</div>
            <div class="beat-title">One CPU, One Program</div>
            <p class="beat-body">Left alone, a CPU core simply follows its <strong>Program Counter (<code>PC</code>)</strong> forever. Right now it is stuck inside <strong>Program A (Music Player)</strong> — without help from hardware, Program A could monopolize the computer indefinitely.</p>
            <div class="beat-note"><strong>Notice:</strong> Checking the keyboard manually after every line ("polling") would waste huge amounts of CPU time. Instead, hardware taps the CPU on the shoulder!</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Hardware Interrupt</div>
            <div class="beat-title">Freeze PC → Push Stack → Jump via IVT</div>
            <p class="beat-body">When you press a key, the keyboard controller sends a voltage pulse to the CPU's <code>IRQ</code> pin. At the end of the current instruction, the CPU automatically pushes <code>PC</code> onto the <strong>Kernel Stack</strong>, looks up <code>IRQ 1</code> in the <strong>Interrupt Vector Table (IVT)</strong>, and jumps to the OS Keyboard Handler (<code>0x8000</code>).</p>
            <div class="beat-note"><strong>Seamless return:</strong> When the handler finishes with <code>IRET</code>, hardware pops the saved <code>PC</code> back — Program A never even knows it was paused!</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Preemption &amp; Context Switch</div>
            <div class="beat-title">Timer IRQ Swaps Programs!</div>
            <p class="beat-body">To multitask, a hardware <strong>Timer (<code>IRQ 0</code>)</strong> fires every few milliseconds and forcibly pauses ("preempts") the active program. The OS Scheduler saves Program A's registers into a snapshot called <code>PCB_A</code>, loads <code>PCB_B</code> into the CPU, and jumps straight into <strong>Program B</strong>.</p>
            <div class="beat-note"><strong>The illusion of simultaneity:</strong> Switching hundreds of times per second feels instantaneous to human eyes — look at the live <strong>Time-Slicing Timeline</strong> below!</div>
          </div>
        </div>

        <div class="beat" data-beat="3">
          <div class="beat-card">
            <div class="beat-step">Step 4 · Complete Multitasking Lab</div>
            <div class="beat-title">Trigger Interrupts Yourself</div>
            <p class="beat-body">Click <strong>Run CPU</strong> below to watch automatic time-slicing between the Music Player and Game Loop, or fire a manual <strong>Keyboard IRQ 1</strong> / <strong>Timer Preempt IRQ 0</strong> at any exact instruction.</p>
            <div class="beat-note"><strong>Watch closely:</strong> Every time Task A or Task B resumes, its <code>PC</code> and <code>R0</code> pick up at the exact values preserved in its PCB.</div>
          </div>
        </div>
      </div>

      <!-- Sticky Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot" style="background:var(--rose)"></span>
            <span id="c6-cap">Step 1: Single CPU executing Program A.</span>
          </div>
          <span class="pill pill-blue" id="c6-mode-pill">USER (Task A)</span>
        </div>

        <div class="stage-canvas">
          <div class="grid-3" style="align-items:stretch">
            <!-- Col 1: Program A (Beat 0+) -->
            <div class="subcard reveal-part visible" id="c6-card-a" style="border-color:var(--blue-border)">
              <div class="subcard-head">
                <span class="subcard-title" style="color:var(--blue)">Program A (Music)</span>
                <span class="pill pill-blue" id="c6-st-a">RUN</span>
              </div>
              <div class="code-pane" id="c6-code-a"></div>
              <div class="reg-box" id="c6-pcb-a"><span class="reg-name">PCB_A</span><span class="reg-val">0x1000 · R0:10</span></div>
            </div>

            <!-- Col 2: Live Single CPU + IRQ + Kernel Stack -->
            <div class="subcard reveal-part visible">
              <div class="subcard-head">
                <span class="subcard-title">Single CPU Core</span>
                <span class="pill" id="c6-irq-pill">IRQ: LOW</span>
              </div>
              <div class="reg-grid">
                <div class="reg-box" id="c6-pc"><span class="reg-name" style="color:var(--blue)">PC</span><span class="reg-val">0x1000</span></div>
                <div class="reg-box" id="c6-r0"><span class="reg-name">R0</span><span class="reg-val">10</span></div>
              </div>

              <div class="reveal-part" id="c6-ivt-box" style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-family:var(--font-mono);font-size:10.5px">
                <div style="color:var(--ink-muted);font-size:9.5px;font-weight:700;margin-bottom:3px">INTERRUPT VECTOR TABLE (IVT)</div>
                <div id="c6-ivt-0">IRQ 0 (Timer) → <strong style="color:var(--amber)">0x8100</strong></div>
                <div id="c6-ivt-1">IRQ 1 (Kbd)   → <strong style="color:var(--rose)">0x8000</strong></div>
              </div>

              <div class="reveal-part" id="c6-kstack" style="background:var(--emerald-soft);border:1px solid var(--emerald-border);border-radius:8px;padding:7px 9px;flex:1">
                <div style="font-size:9.5px;font-weight:800;color:var(--emerald)">KERNEL STACK (Saved PC)</div>
                <div id="c6-kstack-list" style="margin-top:4px"></div>
              </div>
            </div>

            <!-- Col 3: Program B (Beat 2+) -->
            <div class="subcard reveal-part" id="c6-card-b">
              <div class="subcard-head">
                <span class="subcard-title" style="color:var(--violet)">Program B (Game)</span>
                <span class="pill" id="c6-st-b">WAIT</span>
              </div>
              <div class="code-pane" id="c6-code-b"></div>
              <div class="reg-box" id="c6-pcb-b"><span class="reg-name">PCB_B</span><span class="reg-val">0x2000 · R0:50</span></div>
            </div>
          </div>

          <!-- Timeline Strip (Beat 2+) -->
          <div class="subcard reveal-part" id="c6-tl-card" style="padding:9px 12px">
            <div class="subcard-head">
              <span class="subcard-title">Live CPU Time-Slicing Timeline</span>
              <span style="font-size:11px;color:var(--ink-secondary)">
                <strong style="color:var(--blue)">■ A</strong> &nbsp;
                <strong style="color:var(--violet)">■ B</strong> &nbsp;
                <strong style="color:var(--rose)">■ IRQ</strong>
              </span>
            </div>
            <div class="timeline-strip" id="c6-tl"></div>
          </div>
        </div>

        <div class="stage-dock dock-hidden" id="c6-dock">
          <button class="btn btn-primary btn-sm" id="c6-step">⚡ Step</button>
          <button class="btn btn-emerald btn-sm" id="c6-run">▶ Run CPU</button>
          <button class="btn btn-rose btn-sm" id="c6-kbd">⌨ Keyboard IRQ 1</button>
          <button class="btn btn-amber btn-sm" id="c6-tmr">⏱ Timer Preempt (IRQ 0)</button>
        </div>
      </div>
    </div>
  `;

  const cap = section.querySelector('#c6-cap');
  const dock = section.querySelector('#c6-dock');
  const runBtn = section.querySelector('#c6-run');

  function pushTl(kind, label) {
    timeline.push({ kind, label });
    if (timeline.length > 22) timeline.shift();
  }

  function render() {
    const drawList = (el, list, activeAddr) => {
      el.innerHTML = list.map((ins) => `
        <div class="code-line${ins.addr === activeAddr ? ' active-asm' : ''}">
          <span class="code-addr">${ins.addr === activeAddr ? '▶' : ' '} ${hex4(ins.addr)}</span>
          <span>${ins.text}</span>
        </div>
      `).join('');
    };
    drawList(section.querySelector('#c6-code-a'), PROG_A, mode === 'USER' && activeTask === 'A' ? cpuPC : -1);
    drawList(section.querySelector('#c6-code-b'), PROG_B, mode === 'USER' && activeTask === 'B' ? cpuPC : -1);

    section.querySelector('#c6-card-a').style.borderColor = mode === 'USER' && activeTask === 'A' ? 'var(--blue)' : 'var(--border)';
    section.querySelector('#c6-card-b').style.borderColor = mode === 'USER' && activeTask === 'B' ? 'var(--violet)' : 'var(--border)';
    section.querySelector('#c6-st-a').textContent = mode === 'USER' && activeTask === 'A' ? 'RUNNING' : 'PAUSED';
    section.querySelector('#c6-st-a').className = mode === 'USER' && activeTask === 'A' ? 'pill pill-blue' : 'pill';
    section.querySelector('#c6-st-b').textContent = mode === 'USER' && activeTask === 'B' ? 'RUNNING' : 'PAUSED';
    section.querySelector('#c6-st-b').className = mode === 'USER' && activeTask === 'B' ? 'pill pill-violet' : 'pill';

    section.querySelector('#c6-pcb-a .reg-val').textContent = `${hex4(pcbA.PC)} · R0:${pcbA.R0}`;
    section.querySelector('#c6-pcb-b .reg-val').textContent = `${hex4(pcbB.PC)} · R0:${pcbB.R0}`;
    section.querySelector('#c6-pc .reg-val').textContent = hex4(cpuPC);
    section.querySelector('#c6-r0 .reg-val').textContent = String(cpuR0);

    const mp = section.querySelector('#c6-mode-pill');
    if (mode === 'USER') {
      mp.textContent = `USER (Task ${activeTask})`;
      mp.className = activeTask === 'A' ? 'pill pill-blue' : 'pill pill-violet';
    } else if (mode === 'IRQ_KBD') {
      mp.textContent = 'KERNEL (Kbd ISR)';
      mp.className = 'pill pill-rose';
    } else {
      mp.textContent = 'KERNEL (Preempt)';
      mp.className = 'pill pill-amber';
    }

    const ip = section.querySelector('#c6-irq-pill');
    ip.textContent = pendingIrq ? `⚡ ${pendingIrq} IRQ` : mode !== 'USER' ? 'SERVICING ISR' : 'IRQ: LOW';
    ip.className = pendingIrq ? 'pill pill-rose' : mode !== 'USER' ? 'pill pill-amber' : 'pill';

    const ks = section.querySelector('#c6-kstack-list');
    ks.innerHTML = kStack.length === 0
      ? `<div style="font-size:10.5px;color:var(--ink-muted)">Empty</div>`
      : kStack.slice().reverse().map((it) => `<div class="mem-slot stack-frame" style="margin-top:2px;padding:3px 6px"><span>${it.label}</span><strong>${it.val}</strong></div>`).join('');

    section.querySelector('#c6-tl').innerHTML = timeline.map((s) => {
      const bg = s.kind === 'A' ? 'var(--blue-soft)' : s.kind === 'B' ? 'var(--violet-soft)' : 'var(--rose-soft)';
      const col = s.kind === 'A' ? 'var(--blue)' : s.kind === 'B' ? 'var(--violet)' : 'var(--rose)';
      return `<div class="tl-slice" style="background:${bg};color:${col}">${s.label}</div>`;
    }).join('');
  }

  function stepCpu(silent = false) {
    if (mode === 'USER' && pendingIrq) {
      const irq = pendingIrq;
      pendingIrq = null;
      kStack.push({ label: `PC (${activeTask})`, val: hex4(cpuPC) });
      isrStep = 0;
      if (irq === 'KBD') {
        mode = 'IRQ_KBD'; cpuPC = 0x8000; pushTl('IRQ', 'KBD');
        if (!silent) {
          flyPacket(section.querySelector('#c6-pc'), section.querySelector('#c6-kstack'), `PUSH ${kStack[kStack.length - 1].val}`, { color: '#e11d48' });
          setCaption(cap, `<strong>⚡ Keyboard IRQ 1!</strong> Hardware pushed <code>PC</code> to Kernel Stack and jumped via IVT to <code>0x8000</code>.`);
        }
      } else {
        mode = 'IRQ_TIMER'; cpuPC = 0x8100; pushTl('IRQ', 'TMR');
        if (!silent) {
          flyPacket(section.querySelector('#c6-pc'), section.querySelector('#c6-kstack'), `PREEMPT`, { color: '#d97706' });
          setCaption(cap, `<strong>⏱ Timer IRQ 0!</strong> Preempting Task ${activeTask} → jumping to OS Scheduler <code>0x8100</code>.`);
        }
      }
      render(); return;
    }

    if (mode === 'IRQ_KBD') {
      if (isrStep === 0) {
        isrStep = 1; cpuPC = 0x8004; pushTl('IRQ', 'KEY');
        if (!silent) setCaption(cap, '<strong>Kbd ISR:</strong> Read keystroke from keyboard hardware port.');
      } else {
        const saved = kStack.pop();
        cpuPC = parseInt(saved.val, 16); mode = 'USER'; isrStep = 0;
        if (!silent) {
          flyPacket(section.querySelector('#c6-kstack'), section.querySelector('#c6-pc'), `IRET ${saved.val}`, { color: '#059669' });
          setCaption(cap, `<strong>IRET:</strong> Restored <code>PC=${saved.val}</code> — Program ${activeTask} resumes seamlessly!`);
        }
      }
      render(); return;
    }

    if (mode === 'IRQ_TIMER') {
      if (isrStep === 0) {
        const savedPC = parseInt(kStack[kStack.length - 1].val, 16);
        if (activeTask === 'A') { pcbA = { PC: savedPC, R0: cpuR0 }; }
        else { pcbB = { PC: savedPC, R0: cpuR0 }; }
        activeTask = activeTask === 'A' ? 'B' : 'A';
        const next = activeTask === 'A' ? pcbA : pcbB;
        kStack[kStack.length - 1] = { label: `Next (${activeTask})`, val: hex4(next.PC) };
        cpuR0 = next.R0;
        isrStep = 1; cpuPC = 0x8104; pushTl('IRQ', 'SWP');
        if (!silent) setCaption(cap, `<strong>Context Switch:</strong> Saved outgoing PCB and loaded <strong>PCB_${activeTask}</strong> (<code>PC=${hex4(next.PC)}</code>)!`);
      } else {
        const nextEntry = kStack.pop();
        cpuPC = parseInt(nextEntry.val, 16); mode = 'USER'; isrStep = 0; ticks = 0;
        if (!silent) {
          flyPacket(section.querySelector('#c6-kstack'), section.querySelector('#c6-pc'), `TASK ${activeTask}`, { color: activeTask === 'A' ? '#2563eb' : '#7c3aed' });
          setCaption(cap, `<strong>IRET → Task ${activeTask} Running!</strong> Resumed right at <code>${hex4(cpuPC)}</code>.`);
        }
      }
      render(); return;
    }

    ticks++;
    const prog = activeTask === 'A' ? PROG_A : PROG_B;
    const idx = prog.findIndex((i) => i.addr === cpuPC);
    const ins = prog[idx] || prog[0];
    if (ins.text.includes('ADD')) cpuR0 += activeTask === 'A' ? 12 : 4;
    cpuPC = idx === prog.length - 1 ? prog[0].addr : prog[idx + 1].addr;
    if (activeTask === 'A') pcbA = { PC: cpuPC, R0: cpuR0 };
    else pcbB = { PC: cpuPC, R0: cpuR0 };
    pushTl(activeTask, activeTask);
    if (ticks >= 4) pendingIrq = 'TIMER';
    if (!silent) setCaption(cap, `Task ${activeTask} executed <code>${ins.text}</code> → <code>PC=${hex4(cpuPC)}</code>.`);
    render();
  }

  section.querySelector('#c6-step').addEventListener('click', () => stepCpu(false));
  runBtn.addEventListener('click', () => {
    if (runTimer) { clearInterval(runTimer); runTimer = null; runBtn.textContent = '▶ Run CPU'; }
    else { runBtn.textContent = '⏸ Pause'; stepCpu(false); runTimer = setInterval(() => stepCpu(false), 780); }
  });
  section.querySelector('#c6-kbd').addEventListener('click', () => { pendingIrq = 'KBD'; render(); setCaption(cap, '<strong>⌨ Keyboard IRQ 1 Armed!</strong> Click Step or wait 1 tick.'); });
  section.querySelector('#c6-tmr').addEventListener('click', () => { pendingIrq = 'TIMER'; render(); setCaption(cap, '<strong>⏱ Timer Preemption Armed!</strong> Next step swaps tasks.'); });

  render();

  observeBeats(section, (beatIdx) => {
    section.querySelector('#c6-ivt-box').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c6-kstack').classList.toggle('visible', beatIdx >= 1);
    section.querySelector('#c6-card-b').classList.toggle('visible', beatIdx >= 2);
    section.querySelector('#c6-tl-card').classList.toggle('visible', beatIdx >= 2);
    dock.classList.toggle('dock-hidden', beatIdx < 3);

    if (beatIdx === 0) {
      setCaption(cap, '<strong>Step 1:</strong> Single CPU smoothly stepping through Program A.');
    } else if (beatIdx === 1) {
      if (mode === 'USER') { pendingIrq = 'KBD'; stepCpu(false); }
    } else if (beatIdx === 2) {
      if (mode !== 'USER') { stepCpu(true); stepCpu(true); }
      pendingIrq = 'TIMER';
      stepCpu(true);
      stepCpu(true);
      stepCpu(false);
    } else {
      setCaption(cap, '<strong>Complete Multitasking Lab:</strong> Run the CPU and trigger Keyboard or Timer interrupts live!');
    }
  });
}

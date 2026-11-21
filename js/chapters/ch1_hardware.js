import { observeBeats, pulseAlongSvgPath, setCaption } from '../components/animator.js';

export function mountChapter1(section) {
  section.innerHTML = `
    <div class="chapter-head">
      <div class="chapter-num">Chapter 01</div>
      <h2 class="chapter-title">Anatomy of a Computer</h2>
      <p class="chapter-lead">Every computer — from a phone to a supercomputer — is built from the same five core building blocks connected by copper data highways called buses. Scroll to assemble one piece by piece.</p>
    </div>

    <div class="scrolly-grid">
      <div class="story-beats">
        <div class="beat" data-beat="0">
          <div class="beat-card">
            <div class="beat-step">Step 1 · The Brain</div>
            <div class="beat-title">Start with the CPU</div>
            <p class="beat-body">The <strong>CPU (Central Processing Unit)</strong> is the decision-maker. Inside it live a handful of tiny scratchpad slots called <code>Registers</code>, an <code>ALU</code> that does arithmetic and comparisons, a <code>Control Unit</code> that orchestrates each step, and a tiny <code>L1 Cache</code>.</p>
            <div class="beat-note"><strong>Why it's fast:</strong> Registers sit right inside the silicon core (~0.3 nanoseconds), so the CPU can do billions of simple operations per second — but it can only hold a few numbers at a time.</div>
          </div>
        </div>

        <div class="beat" data-beat="1">
          <div class="beat-card">
            <div class="beat-step">Step 2 · Working Desk</div>
            <div class="beat-title">Connect RAM via the Memory Bus</div>
            <p class="beat-body"><strong>RAM (Random Access Memory)</strong> is a giant grid of numbered byte slots holding every currently running program, variable, and open tab. The CPU asks for bytes by sending an address across the <code>Memory Bus</code> and receiving data back.</p>
            <div class="beat-note"><strong>Trade-off:</strong> RAM holds gigabytes instead of bytes, but it is ~200× slower than a register (~60 ns) and is <strong>volatile</strong> — everything in RAM vanishes the instant power turns off.</div>
          </div>
        </div>

        <div class="beat" data-beat="2">
          <div class="beat-card">
            <div class="beat-step">Step 3 · Permanent Library</div>
            <div class="beat-title">Add Storage (HDD or SSD)</div>
            <p class="beat-body"><strong>Storage</strong> keeps your operating system, apps, and documents safely saved without power. Hard drives (<code>HDD</code>) spin magnetic platters under a moving mechanical arm, while <code>SSD</code>s store electrical charges in NAND flash chips with no moving parts.</p>
            <div class="beat-note"><strong>Analogy:</strong> If a CPU register takes 1 second to reach, RAM takes 3 minutes, an SSD takes 2 days, and a spinning HDD takes 6 months — which is why programs must be copied from disk into RAM before the CPU can run them.</div>
          </div>
        </div>

        <div class="beat" data-beat="3">
          <div class="beat-card">
            <div class="beat-step">Step 4 · Complete Computer</div>
            <div class="beat-title">Add the GPU &amp; Display</div>
            <p class="beat-body">Modern screens contain millions of pixels that must be recalculated 60+ times every second. The <strong>GPU</strong> plugs into the fast <code>PCIe</code> bus with thousands of smaller parallel cores dedicated to computing pixel colors in <code>VRAM</code> and scanning them out to your <strong>Display</strong>.</p>
            <div class="beat-note"><strong>Try it now:</strong> Use the buttons below the motherboard to animate a full <strong>Boot</strong>, <strong>Launch App</strong>, or <strong>Render Frame</strong> — and toggle <strong>HDD / SSD</strong> to compare transfer speed!</div>
          </div>
        </div>
      </div>

      <!-- Sticky Light Motherboard Stage -->
      <div class="sticky-stage">
        <div class="stage-top">
          <div class="stage-caption">
            <span class="live-dot"></span>
            <span id="c1-cap">Step 1: The CPU sits ready on the motherboard.</span>
          </div>
          <span class="pill pill-blue" id="c1-badge">1 / 4 Parts</span>
        </div>

        <div class="stage-canvas" style="justify-content:center;align-items:center">
          <svg id="c1-svg" viewBox="0 0 740 420" width="100%" style="max-height:380px">
            <defs>
              <pattern id="lightGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#edf2f7" stroke-width="1"/>
              </pattern>
            </defs>

            <!-- Clean Light PCB -->
            <rect x="8" y="8" width="724" height="404" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
            <rect x="8" y="8" width="724" height="404" rx="16" fill="url(#lightGrid)"/>

            <!-- BUS TRACES (revealed progressively) -->
            <g class="svg-reveal" id="c1-bus-ram-g">
              <path id="c1-bus-ram-cpu" d="M 410 120 L 250 120" fill="none" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round"/>
              <text x="330" y="108" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">MEMORY BUS</text>
            </g>

            <g class="svg-reveal" id="c1-bus-disk-g">
              <path id="c1-bus-storage-ram" d="M 190 322 L 328 322 L 328 205 L 410 205" fill="none" stroke="#cbd5e1" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
              <text x="255" y="340" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">SATA / NVMe</text>
            </g>

            <g class="svg-reveal" id="c1-bus-gpu-g">
              <path id="c1-bus-cpu-gpu" d="M 180 188 L 180 242 L 470 242 L 470 266" fill="none" stroke="#cbd5e1" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path id="c1-bus-gpu-mon" d="M 580 326 L 616 326" fill="none" stroke="#cbd5e1" stroke-width="5" stroke-linecap="round"/>
              <text x="310" y="234" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">PCIe x16 BUS</text>
            </g>

            <!-- 1. CPU -->
            <g class="svg-reveal visible" id="c1-node-cpu">
              <rect x="42" y="42" width="208" height="146" rx="14" fill="#ffffff" stroke="#2563eb" stroke-width="2"/>
              <text x="58" y="67" fill="#2563eb" font-family="JetBrains Mono,monospace" font-size="13" font-weight="800">CPU</text>
              <text x="95" y="67" fill="#64748b" font-family="Inter,sans-serif" font-size="10">~0.3 ns / cycle</text>

              <rect x="56" y="79" width="84" height="44" rx="7" fill="#eff6ff" stroke="#bfdbfe"/>
              <text x="98" y="98" text-anchor="middle" fill="#1e40af" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">Control Unit</text>
              <text x="98" y="112" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="8.5">PC · IR</text>

              <rect id="c1-alu-box" x="148" y="79" width="88" height="44" rx="7" fill="#eff6ff" stroke="#bfdbfe"/>
              <text x="192" y="98" text-anchor="middle" fill="#2563eb" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">ALU</text>
              <text x="192" y="112" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="8.5">+ − × CMP</text>

              <rect x="56" y="131" width="84" height="44" rx="7" fill="#fffbeb" stroke="#fde68a"/>
              <text x="98" y="150" text-anchor="middle" fill="#b45309" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">Registers</text>
              <text x="98" y="164" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="8.5">R0 R1 SP</text>

              <rect x="148" y="131" width="88" height="44" rx="7" fill="#ecfdf5" stroke="#a7f3d0"/>
              <text x="192" y="150" text-anchor="middle" fill="#047857" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">L1 Cache</text>
              <text x="192" y="164" text-anchor="middle" fill="#64748b" font-family="JetBrains Mono,monospace" font-size="8.5">~1 ns</text>
            </g>

            <!-- 2. RAM -->
            <g class="svg-reveal" id="c1-node-ram">
              <rect x="410" y="42" width="298" height="176" rx="14" fill="#ffffff" stroke="#059669" stroke-width="2"/>
              <text x="426" y="67" fill="#059669" font-family="JetBrains Mono,monospace" font-size="13" font-weight="800">RAM</text>
              <text x="464" y="67" fill="#64748b" font-family="Inter,sans-serif" font-size="10">Working Memory · ~60 ns</text>

              <rect x="426" y="80" width="60" height="28" rx="6" fill="#ecfdf5" stroke="#a7f3d0"/>
              <text x="456" y="98" text-anchor="middle" fill="#047857" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">Kernel</text>
              <rect x="494" y="80" width="60" height="28" rx="6" fill="#eff6ff" stroke="#bfdbfe"/>
              <text x="524" y="98" text-anchor="middle" fill="#1d4ed8" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">Code</text>
              <rect x="562" y="80" width="60" height="28" rx="6" fill="#f5f3ff" stroke="#ddd6fe"/>
              <text x="592" y="98" text-anchor="middle" fill="#6d28d9" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">Heap ↑</text>
              <rect x="630" y="80" width="62" height="28" rx="6" fill="#ecfdf5" stroke="#a7f3d0"/>
              <text x="661" y="98" text-anchor="middle" fill="#047857" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">Stack ↓</text>

              <rect x="426" y="118" width="266" height="84" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
              <text x="438" y="138" fill="#475569" font-family="JetBrains Mono,monospace" font-size="9.5">0x0010:  B8 05 00 00  01 D8 C3 00</text>
              <text x="438" y="156" fill="#475569" font-family="JetBrains Mono,monospace" font-size="9.5">0x2000:  48 65 6C 6C  6F 21 00 00  "Hello!"</text>
              <text x="438" y="174" fill="#475569" font-family="JetBrains Mono,monospace" font-size="9.5">0xFFF8:  00 00 00 2A  00 00 00 14  [Stack]</text>
              <text id="c1-ram-status" x="438" y="192" fill="#059669" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">● Ready</text>
            </g>

            <!-- 3. STORAGE -->
            <g class="svg-reveal" id="c1-node-storage">
              <rect x="42" y="266" width="148" height="128" rx="14" fill="#ffffff" stroke="#d97706" stroke-width="2"/>
              <text id="c1-st-title" x="56" y="288" fill="#d97706" font-family="JetBrains Mono,monospace" font-size="11.5" font-weight="800">HDD Storage</text>
              <g id="c1-hdd-g">
                <circle cx="116" cy="338" r="36" fill="#fffbeb" stroke="#f59e0b" stroke-width="1.8"/>
                <circle cx="116" cy="338" r="24" fill="none" stroke="#fcd34d" stroke-dasharray="4 3"/>
                <circle cx="116" cy="338" r="12" fill="none" stroke="#fcd34d" stroke-dasharray="3 3"/>
                <circle cx="116" cy="338" r="5" fill="#d97706"/>
                <line id="c1-arm" x1="166" y1="376" x2="128" y2="342" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>
              </g>
              <g id="c1-ssd-g" style="display:none">
                <rect x="60" y="302" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <rect x="98" y="302" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <rect x="136" y="302" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <rect x="60" y="338" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <rect x="98" y="338" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <rect x="136" y="338" width="32" height="30" rx="5" fill="#fffbeb" stroke="#d97706"/>
                <text x="116" y="384" text-anchor="middle" fill="#b45309" font-family="JetBrains Mono,monospace" font-size="8.5" font-weight="700">NVMe NAND FLASH</text>
              </g>
            </g>

            <!-- 4. GPU + MONITOR -->
            <g class="svg-reveal" id="c1-node-gpu">
              <rect x="384" y="266" width="196" height="128" rx="14" fill="#ffffff" stroke="#7c3aed" stroke-width="2"/>
              <text x="398" y="288" fill="#7c3aed" font-family="JetBrains Mono,monospace" font-size="12" font-weight="800">GPU</text>
              <text x="432" y="288" fill="#64748b" font-family="Inter,sans-serif" font-size="9.5">Parallel Cores + VRAM</text>
              <g id="c1-gpu-cores"></g>
              <rect x="398" y="362" width="168" height="20" rx="5" fill="#f5f3ff" stroke="#ddd6fe"/>
              <text x="482" y="376" text-anchor="middle" fill="#6d28d9" font-family="JetBrains Mono,monospace" font-size="8.5" font-weight="700">VRAM Framebuffer</text>

              <!-- Display -->
              <rect x="616" y="266" width="98" height="104" rx="12" fill="#ffffff" stroke="#e11d48" stroke-width="2"/>
              <rect id="c1-screen" x="624" y="275" width="82" height="66" rx="6" fill="#f1f5f9" stroke="#cbd5e1"/>
              <text id="c1-screen-txt" x="665" y="312" text-anchor="middle" fill="#94a3b8" font-family="JetBrains Mono,monospace" font-size="9.5" font-weight="700">STANDBY</text>
              <rect x="655" y="370" width="20" height="14" fill="#cbd5e1"/>
              <rect x="640" y="384" width="50" height="6" rx="3" fill="#94a3b8"/>
              <text x="665" y="361" text-anchor="middle" fill="#e11d48" font-family="JetBrains Mono,monospace" font-size="8.5" font-weight="800">DISPLAY</text>
            </g>
          </svg>
        </div>

        <!-- Interactive Playground Dock (unlocks smoothly at Beat 3) -->
        <div class="stage-dock dock-hidden" id="c1-dock">
          <button class="btn btn-primary btn-sm" id="c1-boot">⚡ Animate Boot</button>
          <button class="btn btn-emerald btn-sm" id="c1-app">▶ Launch App</button>
          <button class="btn btn-violet btn-sm" id="c1-render">🎨 Render Frame</button>
          <button class="btn btn-sm" id="c1-toggle-disk">Toggle HDD / SSD</button>
        </div>
      </div>
    </div>
  `;

  const svg = section.querySelector('#c1-svg');
  const cap = section.querySelector('#c1-cap');
  const badge = section.querySelector('#c1-badge');
  const dock = section.querySelector('#c1-dock');
  const ramStatus = svg.querySelector('#c1-ram-status');
  const screen = svg.querySelector('#c1-screen');
  const screenTxt = svg.querySelector('#c1-screen-txt');
  const aluBox = svg.querySelector('#c1-alu-box');
  let storageMode = 'hdd';
  let busy = false;

  // Build 24 tiny GPU cores
  const gpuGroup = svg.querySelector('#c1-gpu-cores');
  const gpuRects = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 8; c++) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(398 + c * 21.5));
      rect.setAttribute('y', String(298 + r * 20));
      rect.setAttribute('width', '16');
      rect.setAttribute('height', '14');
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', '#ede9fe');
      rect.setAttribute('stroke', '#c4b5fd');
      gpuGroup.appendChild(rect);
      gpuRects.push(rect);
    }
  }

  function flashGpu(on) {
    gpuRects.forEach((r, i) => {
      r.setAttribute('fill', on ? (i % 2 === 0 ? '#7c3aed' : '#2563eb') : '#ede9fe');
    });
  }

  async function animateBoot() {
    if (busy) return;
    busy = true;
    screen.setAttribute('fill', '#f1f5f9');
    screenTxt.textContent = 'BOOT...';
    screenTxt.setAttribute('fill', '#64748b');

    setCaption(cap, `Booting: <strong>${storageMode.toUpperCase()}</strong> copies OS Kernel into <strong>RAM</strong>.`);
    ramStatus.textContent = '● Loading OS...';
    await pulseAlongSvgPath(svg, 'c1-bus-storage-ram', { color: '#d97706', duration: storageMode === 'hdd' ? 850 : 400, label: 'OS Kernel' });

    setCaption(cap, '<strong>CPU</strong> fetches instructions from <strong>RAM</strong> across the Memory Bus.');
    await pulseAlongSvgPath(svg, 'c1-bus-ram-cpu', { color: '#2563eb', duration: 550, label: 'FETCH' });

    setCaption(cap, '<strong>CPU</strong> sends display init to <strong>GPU</strong> over PCIe → Monitor turns on!');
    await pulseAlongSvgPath(svg, 'c1-bus-cpu-gpu', { color: '#7c3aed', duration: 600, label: 'INIT_GFX' });
    flashGpu(true);
    await pulseAlongSvgPath(svg, 'c1-bus-gpu-mon', { color: '#e11d48', duration: 400, label: 'RGB' });
    screen.setAttribute('fill', '#ecfdf5');
    screenTxt.textContent = 'READY ✓';
    screenTxt.setAttribute('fill', '#059669');
    ramStatus.textContent = '● OS Active in RAM';
    setTimeout(() => { flashGpu(false); busy = false; }, 500);
  }

  async function animateApp() {
    if (busy) return;
    busy = true;
    setCaption(cap, `Copying <code>app.exe</code> from <strong>${storageMode.toUpperCase()}</strong> into <strong>RAM</strong>...`);
    await pulseAlongSvgPath(svg, 'c1-bus-storage-ram', { color: '#059669', duration: storageMode === 'hdd' ? 800 : 380, label: 'app.exe' });
    await pulseAlongSvgPath(svg, 'c1-bus-ram-cpu', { color: '#2563eb', duration: 500, label: 'INSTR' });
    aluBox.setAttribute('fill', '#fde68a');
    setTimeout(() => aluBox.setAttribute('fill', '#eff6ff'), 350);
    await pulseAlongSvgPath(svg, 'c1-bus-ram-cpu', { color: '#d97706', duration: 500, reverse: true, label: 'SAVE 42' });
    setCaption(cap, 'CPU executed the app and wrote the result back into <strong>RAM</strong>!');
    busy = false;
  }

  async function animateRender() {
    if (busy) return;
    busy = true;
    setCaption(cap, 'CPU sends 3D triangles over <strong>PCIe</strong> → GPU cores shade pixels in parallel!');
    await pulseAlongSvgPath(svg, 'c1-bus-cpu-gpu', { color: '#7c3aed', duration: 580, label: 'TRIANGLES' });
    flashGpu(true);
    await pulseAlongSvgPath(svg, 'c1-bus-gpu-mon', { color: '#e11d48', duration: 400, label: '60 FPS' });
    screen.setAttribute('fill', '#f5f3ff');
    screenTxt.textContent = '▲ 3D FRAME';
    screenTxt.setAttribute('fill', '#7c3aed');
    setTimeout(() => { flashGpu(false); busy = false; }, 550);
  }

  section.querySelector('#c1-boot').addEventListener('click', animateBoot);
  section.querySelector('#c1-app').addEventListener('click', animateApp);
  section.querySelector('#c1-render').addEventListener('click', animateRender);
  section.querySelector('#c1-toggle-disk').addEventListener('click', () => {
    storageMode = storageMode === 'hdd' ? 'ssd' : 'hdd';
    svg.querySelector('#c1-hdd-g').style.display = storageMode === 'hdd' ? '' : 'none';
    svg.querySelector('#c1-ssd-g').style.display = storageMode === 'ssd' ? '' : 'none';
    svg.querySelector('#c1-st-title').textContent = storageMode === 'hdd' ? 'HDD Storage' : 'NVMe SSD';
    setCaption(cap, storageMode === 'hdd'
      ? 'Switched to <strong>HDD</strong> (spinning magnetic platter, mechanical seek ~5 ms).'
      : 'Switched to <strong>NVMe SSD</strong> (electronic NAND flash, ~100× faster random access!).'
    );
  });

  // Progressive reveal driven by scroll!
  observeBeats(section, (beatIdx) => {
    svg.querySelector('#c1-node-ram').classList.toggle('visible', beatIdx >= 1);
    svg.querySelector('#c1-bus-ram-g').classList.toggle('visible', beatIdx >= 1);
    svg.querySelector('#c1-node-storage').classList.toggle('visible', beatIdx >= 2);
    svg.querySelector('#c1-bus-disk-g').classList.toggle('visible', beatIdx >= 2);
    svg.querySelector('#c1-node-gpu').classList.toggle('visible', beatIdx >= 3);
    svg.querySelector('#c1-bus-gpu-g').classList.toggle('visible', beatIdx >= 3);

    dock.classList.toggle('dock-hidden', beatIdx < 3);
    badge.textContent = `${beatIdx + 1} / 4 Parts`;

    if (beatIdx === 0) {
      setCaption(cap, '<strong>Step 1:</strong> Only the <strong>CPU</strong> is on the board — fast registers &amp; ALU ready for instructions.');
    } else if (beatIdx === 1) {
      setCaption(cap, '<strong>Step 2:</strong> <strong>RAM</strong> connects via the Memory Bus — watch data flow to the CPU!');
      pulseAlongSvgPath(svg, 'c1-bus-ram-cpu', { color: '#2563eb', duration: 680, label: '0xB8 0x05' });
    } else if (beatIdx === 2) {
      setCaption(cap, '<strong>Step 3:</strong> <strong>Storage</strong> joins — streaming permanent files into fast working RAM.');
      pulseAlongSvgPath(svg, 'c1-bus-storage-ram', { color: '#d97706', duration: 750, label: 'app.exe' });
    } else {
      setCaption(cap, '<strong>Complete Setup!</strong> GPU &amp; Display are live — try any animation button below.');
      animateRender();
    }
  });
}

import { setNarration, pulseAlongSvgPath } from '../components/animator.js';

const COMPONENT_INFO = {
  cpu: {
    name: 'CPU (Central Processing Unit)',
    role: 'Fetches & executes instructions one clock cycle at a time.',
    speed: '~0.3 ns / cycle (3–5 GHz)',
    volatile: 'Registers & Cache: Volatile',
    color: 'var(--cyan)',
    pills: ['Control Unit', 'ALU', 'Registers', 'L1/L2 Cache']
  },
  ram: {
    name: 'RAM (Random Access Memory)',
    role: 'Fast working desk holding active programs, stack, heap & variables.',
    speed: '~60 ns access (~200x slower than registers)',
    volatile: 'Volatile — erased on power off',
    color: 'var(--emerald)',
    pills: ['Byte-Addressable', 'Code + Data', 'Stack & Heap']
  },
  storage: {
    name: 'Storage (HDD / SSD)',
    role: 'Long-term permanent library storing OS, apps, and files as blocks.',
    speed: 'SSD: ~50 µs | HDD: ~5,000 µs (spinning disk)',
    volatile: 'Non-Volatile — keeps data without power',
    color: 'var(--amber)',
    pills: ['Files & Blocks', 'Persistent', 'Magnetic or Flash']
  },
  gpu: {
    name: 'GPU (Graphics Processing Unit)',
    role: 'Thousands of tiny parallel cores specialized for pixels, 3D & AI math.',
    speed: 'Massive throughput (parallel shaders)',
    volatile: 'VRAM: Volatile framebuffer',
    color: 'var(--violet)',
    pills: ['Shader Cores', 'VRAM', 'PCIe x16 Bus']
  },
  monitor: {
    name: 'Display Monitor',
    role: 'Scans out RGB pixel colors from GPU VRAM 60–240 times per second.',
    speed: '60 Hz = 1 frame every 16.6 ms',
    volatile: 'Refreshed continuously',
    color: 'var(--coral)',
    pills: ['Pixels (RGB)', 'Scanout', 'HDMI / DisplayPort']
  }
};

export function createModule1() {
  let timers = [];
  let running = false;
  let storageMode = 'hdd';

  function clearTimers() {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
  }

  function wait(ms) {
    return new Promise((res) => {
      const id = setTimeout(res, ms);
      timers.push(id);
    });
  }

  return {
    init(container) {
      running = false;
      storageMode = 'hdd';

      container.innerHTML = `
        <div class="toolbar">
          <div class="toolbar-group">
            <button class="btn btn-primary" id="m1-boot">⚡ Animate: Boot Up</button>
            <button class="btn btn-emerald" id="m1-app">▶ Animate: Launch App</button>
            <button class="btn btn-violet" id="m1-render">🎨 Animate: Render Frame</button>
            <button class="btn btn-amber" id="m1-race">🏁 Speed Race</button>
          </div>
          <div class="toolbar-divider"></div>
          <div class="toolbar-group">
            <span style="font-size:11.5px;color:var(--text-muted)">Storage:</span>
            <button class="btn btn-sm active-tab" id="m1-hdd">HDD (Platter)</button>
            <button class="btn btn-sm" id="m1-ssd">SSD (Flash)</button>
          </div>
        </div>

        <div class="grid-main-side">
          <!-- Interactive Motherboard SVG -->
          <div class="card" style="padding:10px">
            <div class="card-header">
              <div class="card-title"><span class="dot"></span>System Motherboard &amp; Data Buses</div>
              <span class="pill pill-cyan">Click any component to inspect</span>
            </div>
            <div class="mobo-svg-wrap" style="flex:1;display:flex;align-items:center;justify-content:center">
              <svg id="m1-svg" viewBox="0 0 760 440" width="100%" height="100%" style="max-height:420px">
                <defs>
                  <pattern id="pcbGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#132035" stroke-width="0.8"/>
                  </pattern>
                </defs>
                <!-- PCB Board -->
                <rect x="10" y="10" width="740" height="420" rx="14" fill="#0b1220" stroke="#1e2d47" stroke-width="2"/>
                <rect x="10" y="10" width="740" height="420" rx="14" fill="url(#pcbGrid)"/>

                <!-- BUS TRACES -->
                <!-- Storage to RAM / Chipset -->
                <path id="bus-storage-ram" d="M 190 325 L 330 325 L 330 220 L 420 220" fill="none" stroke="#283b5a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <!-- RAM to CPU -->
                <path id="bus-ram-cpu" d="M 420 125 L 250 125" fill="none" stroke="#283b5a" stroke-width="7" stroke-linecap="round"/>
                <!-- CPU to GPU (PCIe) -->
                <path id="bus-cpu-gpu" d="M 185 190 L 185 245 L 475 245 L 475 270" fill="none" stroke="#283b5a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
                <!-- GPU to Monitor -->
                <path id="bus-gpu-mon" d="M 590 330 L 628 330" fill="none" stroke="#283b5a" stroke-width="5" stroke-linecap="round"/>

                <!-- Bus labels -->
                <text x="295" y="113" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">MEMORY BUS (Addr + Data)</text>
                <text x="260" y="238" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">PCIe x16 BUS</text>
                <text x="210" y="343" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">SATA / NVMe</text>

                <!-- CPU NODE -->
                <g class="mobo-node selected" id="node-cpu" data-comp="cpu">
                  <rect class="frame" x="45" y="45" width="205" height="145" rx="12" fill="#111c2e" stroke="#38bdf8" stroke-width="2"/>
                  <text x="60" y="70" fill="#38bdf8" font-family="JetBrains Mono,monospace" font-size="13" font-weight="800">CPU</text>
                  <text x="102" y="70" fill="#647a9e" font-family="Inter,sans-serif" font-size="10">Brain • 4.2 GHz</text>
                  <!-- Sub-blocks inside CPU -->
                  <rect x="58" y="82" width="84" height="42" rx="6" fill="#0b1322" stroke="#2c4466"/>
                  <text x="100" y="100" text-anchor="middle" fill="#9bb0cf" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">Control Unit</text>
                  <text x="100" y="114" text-anchor="middle" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="8.5">PC • IR</text>

                  <rect id="m1-alu" x="150" y="82" width="86" height="42" rx="6" fill="#0b1322" stroke="#2c4466"/>
                  <text x="193" y="100" text-anchor="middle" fill="#38bdf8" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">ALU</text>
                  <text x="193" y="114" text-anchor="middle" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="8.5">+  −  ×  CMP</text>

                  <rect x="58" y="132" width="84" height="44" rx="6" fill="#0b1322" stroke="#2c4466"/>
                  <text x="100" y="150" text-anchor="middle" fill="#f59e0b" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">Registers</text>
                  <text x="100" y="164" text-anchor="middle" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="8.5">R0 R1 R2 SP</text>

                  <rect x="150" y="132" width="86" height="44" rx="6" fill="#0b1322" stroke="#2c4466"/>
                  <text x="193" y="150" text-anchor="middle" fill="#34d399" font-family="JetBrains Mono,monospace" font-size="10" font-weight="700">L1 Cache</text>
                  <text x="193" y="164" text-anchor="middle" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="8.5">64 KB • ~1ns</text>
                </g>

                <!-- RAM NODE -->
                <g class="mobo-node" id="node-ram" data-comp="ram">
                  <rect class="frame" x="420" y="45" width="300" height="175" rx="12" fill="#111c2e" stroke="#34d399" stroke-width="1.8"/>
                  <text x="436" y="70" fill="#34d399" font-family="JetBrains Mono,monospace" font-size="13" font-weight="800">RAM</text>
                  <text x="480" y="70" fill="#647a9e" font-family="Inter,sans-serif" font-size="10">Working Memory • 16 GB</text>
                  <!-- RAM cells -->
                  <g id="m1-ram-cells">
                    <rect x="436" y="84" width="60" height="28" rx="4" fill="#0b1520" stroke="#224a42"/>
                    <text x="466" y="102" text-anchor="middle" fill="#6ee7b7" font-family="JetBrains Mono,monospace" font-size="9">OS Kernel</text>
                    <rect x="504" y="84" width="60" height="28" rx="4" fill="#0b1520" stroke="#224a42"/>
                    <text x="534" y="102" text-anchor="middle" fill="#7dd3fc" font-family="JetBrains Mono,monospace" font-size="9">App Code</text>
                    <rect x="572" y="84" width="60" height="28" rx="4" fill="#0b1520" stroke="#224a42"/>
                    <text x="602" y="102" text-anchor="middle" fill="#c4b5fd" font-family="JetBrains Mono,monospace" font-size="9">Heap ↑</text>
                    <rect x="640" y="84" width="64" height="28" rx="4" fill="#0b1520" stroke="#224a42"/>
                    <text x="672" y="102" text-anchor="middle" fill="#6ee7b7" font-family="JetBrains Mono,monospace" font-size="9">Stack ↓</text>

                    <rect x="436" y="122" width="268" height="82" rx="6" fill="#09101a" stroke="#1c2f44"/>
                    <text x="448" y="142" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="9.5">0x0010:  B8 05 00 00  01 D8 C3 00</text>
                    <text x="448" y="160" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="9.5">0x2000:  48 65 6C 6C  6F 21 00 00  "Hello!"</text>
                    <text x="448" y="178" fill="#647a9e" font-family="JetBrains Mono,monospace" font-size="9.5">0xFFF8:  00 00 00 2A  00 00 00 14  [Stack]</text>
                    <text id="m1-ram-status" x="448" y="195" fill="#34d399" font-family="JetBrains Mono,monospace" font-size="9.5">● Idle — waiting for read/write</text>
                  </g>
                </g>

                <!-- STORAGE NODE -->
                <g class="mobo-node" id="node-storage" data-comp="storage">
                  <rect class="frame" x="45" y="268" width="145" height="132" rx="12" fill="#111c2e" stroke="#f59e0b" stroke-width="1.8"/>
                  <text id="m1-storage-title" x="60" y="290" fill="#f59e0b" font-family="JetBrains Mono,monospace" font-size="12" font-weight="800">HDD Storage</text>
                  <!-- HDD Platter visual -->
                  <g id="m1-hdd-vis">
                    <circle cx="117" cy="342" r="38" fill="#090e18" stroke="#475569" stroke-width="2"/>
                    <circle cx="117" cy="342" r="26" fill="none" stroke="#334155" stroke-dasharray="4 3"/>
                    <circle cx="117" cy="342" r="14" fill="none" stroke="#334155" stroke-dasharray="3 3"/>
                    <circle cx="117" cy="342" r="6" fill="#f59e0b"/>
                    <line id="m1-hdd-arm" x1="168" y1="382" x2="128" y2="346" stroke="#fbbf24" stroke-width="3" stroke-linecap="round"/>
                  </g>
                  <!-- SSD Grid visual (hidden initially) -->
                  <g id="m1-ssd-vis" style="display:none">
                    <rect x="64" y="305" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <rect x="102" y="305" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <rect x="140" y="305" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <rect x="64" y="344" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <rect x="102" y="344" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <rect x="140" y="344" width="32" height="32" rx="4" fill="#1d2b44" stroke="#f59e0b"/>
                    <text x="117" y="392" text-anchor="middle" fill="#fbbf24" font-family="JetBrains Mono,monospace" font-size="8.5">NAND FLASH CHIPS</text>
                  </g>
                </g>

                <!-- GPU NODE -->
                <g class="mobo-node" id="node-gpu" data-comp="gpu">
                  <rect class="frame" x="390" y="268" width="200" height="132" rx="12" fill="#111c2e" stroke="#a78bfa" stroke-width="1.8"/>
                  <text x="406" y="290" fill="#a78bfa" font-family="JetBrains Mono,monospace" font-size="12" font-weight="800">GPU</text>
                  <text x="442" y="290" fill="#647a9e" font-family="Inter,sans-serif" font-size="9.5">Parallel Cores + VRAM</text>
                  <!-- Tiny core grid -->
                  <g id="m1-gpu-cores"></g>
                  <rect x="406" y="366" width="168" height="22" rx="4" fill="#090e18" stroke="#4c3d7a"/>
                  <text x="490" y="381" text-anchor="middle" fill="#c4b5fd" font-family="JetBrains Mono,monospace" font-size="9">VRAM Framebuffer</text>
                </g>

                <!-- MONITOR NODE -->
                <g class="mobo-node" id="node-monitor" data-comp="monitor">
                  <rect class="frame" x="628" y="268" width="102" height="106" rx="10" fill="#111c2e" stroke="#fb7185" stroke-width="1.8"/>
                  <rect id="m1-screen" x="636" y="278" width="86" height="68" rx="4" fill="#05080f" stroke="#2b3a55"/>
                  <text id="m1-screen-txt" x="679" y="316" text-anchor="middle" fill="#334155" font-family="JetBrains Mono,monospace" font-size="10">OFF</text>
                  <rect x="668" y="374" width="22" height="14" fill="#24324a"/>
                  <rect x="652" y="388" width="54" height="6" rx="3" fill="#364b6e"/>
                  <text x="679" y="365" text-anchor="middle" fill="#fb7185" font-family="JetBrains Mono,monospace" font-size="9" font-weight="700">DISPLAY</text>
                </g>
              </svg>
            </div>
          </div>

          <!-- Right Inspector + Speed Race -->
          <div style="display:flex;flex-direction:column;gap:12px;min-height:0">
            <div class="card" id="m1-inspector">
              <!-- Populated by renderInfo -->
            </div>

            <div class="card" style="flex:1">
              <div class="card-header">
                <div class="card-title"><span class="dot" style="background:var(--amber)"></span>Access Latency Comparison</div>
                <span class="pill pill-amber">Relative Speed</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:10px;margin-top:4px" id="m1-race-list">
                <div class="speed-race-row">
                  <span style="color:var(--cyan);font-weight:700">CPU Register</span>
                  <div class="speed-track"><div class="speed-bar" id="bar-reg" style="background:var(--cyan);width:100%"></div></div>
                  <span class="mono" style="font-size:11px;color:var(--text-secondary)">0.3 ns</span>
                </div>
                <div class="speed-race-row">
                  <span style="color:var(--emerald);font-weight:700">L1 Cache</span>
                  <div class="speed-track"><div class="speed-bar" id="bar-l1" style="background:var(--emerald);width:86%"></div></div>
                  <span class="mono" style="font-size:11px;color:var(--text-secondary)">~1 ns</span>
                </div>
                <div class="speed-race-row">
                  <span style="color:#60a5fa;font-weight:700">RAM</span>
                  <div class="speed-track"><div class="speed-bar" id="bar-ram" style="background:#60a5fa;width:54%"></div></div>
                  <span class="mono" style="font-size:11px;color:var(--text-secondary)">~60 ns</span>
                </div>
                <div class="speed-race-row">
                  <span style="color:var(--amber);font-weight:700">NVMe SSD</span>
                  <div class="speed-track"><div class="speed-bar" id="bar-ssd" style="background:var(--amber);width:26%"></div></div>
                  <span class="mono" style="font-size:11px;color:var(--text-secondary)">~50 µs</span>
                </div>
                <div class="speed-race-row">
                  <span style="color:var(--coral);font-weight:700">Spinning HDD</span>
                  <div class="speed-track"><div class="speed-bar" id="bar-hdd" style="background:var(--coral);width:8%"></div></div>
                  <span class="mono" style="font-size:11px;color:var(--text-secondary)">~5,000 µs</span>
                </div>
              </div>
              <div style="font-size:11.5px;color:var(--text-muted);margin-top:auto;padding-top:6px;border-top:1px solid var(--border)">
                Analogy: If a <strong>CPU Register</strong> takes <strong>1 second</strong>, RAM takes <strong>3 minutes</strong>, SSD takes <strong>2 days</strong>, and an HDD takes <strong>6 months</strong>!
              </div>
            </div>
          </div>
        </div>
      `;

      // Populate mini GPU cores in SVG
      const svg = container.querySelector('#m1-svg');
      const gpuGroup = svg.querySelector('#m1-gpu-cores');
      const gpuRects = [];
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) {
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', String(406 + c * 21.5));
          rect.setAttribute('y', String(300 + r * 20));
          rect.setAttribute('width', '16');
          rect.setAttribute('height', '14');
          rect.setAttribute('rx', '2');
          rect.setAttribute('fill', '#1c1833');
          rect.setAttribute('stroke', '#4c3d7a');
          gpuGroup.appendChild(rect);
          gpuRects.push(rect);
        }
      }

      const infoEl = container.querySelector('#m1-inspector');
      function selectComp(key) {
        svg.querySelectorAll('.mobo-node').forEach((n) => n.classList.toggle('selected', n.dataset.comp === key));
        const info = COMPONENT_INFO[key];
        infoEl.innerHTML = `
          <div class="card-header">
            <div class="card-title"><span class="dot" style="background:${info.color}"></span>${info.name}</div>
          </div>
          <div style="font-size:13px;color:var(--text-primary);font-weight:500">${info.role}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11.5px">
            <div style="background:#0a0f18;padding:7px 9px;border-radius:6px;border:1px solid var(--border)">
              <div style="color:var(--text-muted);font-size:10px">SPEED</div>
              <div class="mono" style="color:${info.color};margin-top:2px">${info.speed}</div>
            </div>
            <div style="background:#0a0f18;padding:7px 9px;border-radius:6px;border:1px solid var(--border)">
              <div style="color:var(--text-muted);font-size:10px">PERSISTENCE</div>
              <div style="color:var(--text-secondary);margin-top:2px">${info.volatile}</div>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${info.pills.map((p) => `<span class="pill">${p}</span>`).join('')}
          </div>
        `;
      }

      svg.querySelectorAll('.mobo-node').forEach((n) => {
        n.addEventListener('click', () => {
          selectComp(n.dataset.comp);
          setNarration(`Inspecting <strong>${COMPONENT_INFO[n.dataset.comp].name}</strong> — ${COMPONENT_INFO[n.dataset.comp].role}`);
        });
      });
      selectComp('cpu');

      // HDD vs SSD toggle
      const btnHdd = container.querySelector('#m1-hdd');
      const btnSsd = container.querySelector('#m1-ssd');
      function setStorage(mode) {
        storageMode = mode;
        btnHdd.classList.toggle('active-tab', mode === 'hdd');
        btnSsd.classList.toggle('active-tab', mode === 'ssd');
        svg.querySelector('#m1-hdd-vis').style.display = mode === 'hdd' ? '' : 'none';
        svg.querySelector('#m1-ssd-vis').style.display = mode === 'ssd' ? '' : 'none';
        svg.querySelector('#m1-storage-title').textContent = mode === 'hdd' ? 'HDD Storage' : 'NVMe SSD';
        setNarration(mode === 'hdd'
          ? 'Switched to <strong>HDD</strong>: mechanical arm must physically seek across spinning magnetic platters (~5 ms).'
          : 'Switched to <strong>NVMe SSD</strong>: pure electronic NAND flash chips — ~100x faster random access!'
        );
      }
      btnHdd.addEventListener('click', () => setStorage('hdd'));
      btnSsd.addEventListener('click', () => setStorage('ssd'));

      const ramStatus = svg.querySelector('#m1-ram-status');
      const screen = svg.querySelector('#m1-screen');
      const screenTxt = svg.querySelector('#m1-screen-txt');
      const hddArm = svg.querySelector('#m1-hdd-arm');

      function flashGpuCores(on) {
        gpuRects.forEach((r, i) => {
          r.setAttribute('fill', on ? (i % 2 === 0 ? '#a78bfa' : '#38bdf8') : '#1c1833');
        });
      }

      // Scenario 1: Boot Up
      container.querySelector('#m1-boot').addEventListener('click', async () => {
        if (running) return;
        running = true;
        clearTimers();
        screen.setAttribute('fill', '#05080f');
        screenTxt.textContent = 'BOOT...';
        screenTxt.setAttribute('fill', '#647a9e');

        const seekTime = storageMode === 'hdd' ? 950 : 420;
        setNarration(`<strong>Step 1/4:</strong> ${storageMode.toUpperCase()} reads the Operating System kernel blocks and streams them into <strong>RAM</strong>.`);
        ramStatus.textContent = '● Loading OS Kernel...';
        if (storageMode === 'hdd') hddArm.setAttribute('x2', '104');
        await pulseAlongSvgPath(svg, 'bus-storage-ram', { color: '#f59e0b', duration: seekTime, label: 'OS Kernel' });
        if (storageMode === 'hdd') hddArm.setAttribute('x2', '128');

        setNarration('<strong>Step 2/4:</strong> <strong>CPU</strong> fetches the first OS instructions from <strong>RAM</strong> across the Memory Bus.');
        ramStatus.textContent = '● Serving instructions to CPU';
        await pulseAlongSvgPath(svg, 'bus-ram-cpu', { color: '#38bdf8', duration: 600, label: '0xB8 0x05' });

        setNarration('<strong>Step 3/4:</strong> <strong>CPU</strong> tells the <strong>GPU</strong> over PCIe to initialize the desktop display.');
        await pulseAlongSvgPath(svg, 'bus-cpu-gpu', { color: '#a78bfa', duration: 650, label: 'INIT_GFX' });
        flashGpuCores(true);
        await wait(350);

        setNarration('<strong>Step 4/4:</strong> <strong>GPU</strong> scans pixels from VRAM to the <strong>Monitor</strong> — System Ready!');
        await pulseAlongSvgPath(svg, 'bus-gpu-mon', { color: '#fb7185', duration: 420, label: 'RGB' });
        screen.setAttribute('fill', '#0c2742');
        screenTxt.textContent = 'OS READY ✓';
        screenTxt.setAttribute('fill', '#34d399');
        ramStatus.textContent = '● OS Active in RAM';
        await wait(500);
        flashGpuCores(false);
        running = false;
      });

      // Scenario 2: Launch App
      container.querySelector('#m1-app').addEventListener('click', async () => {
        if (running) return;
        running = true;
        clearTimers();
        const seekTime = storageMode === 'hdd' ? 950 : 420;
        setNarration(`<strong>Launch App:</strong> Reading executable binary from <strong>${storageMode.toUpperCase()}</strong> into <strong>RAM</strong> (CPUs cannot run code directly off slow disk!).`);
        ramStatus.textContent = '● Copying app.exe into RAM...';
        await pulseAlongSvgPath(svg, 'bus-storage-ram', { color: '#34d399', duration: seekTime, label: 'app.exe' });

        setNarration('<strong>Fetch & Execute:</strong> CPU reads instructions from RAM → ALU computes → writes result back to RAM.');
        await pulseAlongSvgPath(svg, 'bus-ram-cpu', { color: '#38bdf8', duration: 520, label: 'FETCH' });
        svg.querySelector('#m1-alu').setAttribute('stroke', '#f59e0b');
        await wait(280);
        svg.querySelector('#m1-alu').setAttribute('stroke', '#2c4466');
        await pulseAlongSvgPath(svg, 'bus-ram-cpu', { color: '#f59e0b', duration: 520, reverse: true, label: 'WRITE 42' });
        ramStatus.textContent = '● App running (Stack + Heap live)';
        running = false;
      });

      // Scenario 3: Render Frame
      container.querySelector('#m1-render').addEventListener('click', async () => {
        if (running) return;
        running = true;
        clearTimers();
        setNarration('<strong>Render Frame:</strong> CPU sends 3D triangles & shaders over the fast <strong>PCIe x16 Bus</strong> to the GPU.');
        await pulseAlongSvgPath(svg, 'bus-cpu-gpu', { color: '#a78bfa', duration: 600, label: 'TRIANGLES' });

        setNarration('<strong>Parallel Shading:</strong> All GPU shader cores light up simultaneously to color millions of pixels in VRAM!');
        flashGpuCores(true);
        await wait(550);

        setNarration('<strong>Scanout:</strong> VRAM Framebuffer streams finished RGB pixels to the Monitor.');
        await pulseAlongSvgPath(svg, 'bus-gpu-mon', { color: '#fb7185', duration: 420, label: '60 FPS' });
        screen.setAttribute('fill', '#2a1647');
        screenTxt.textContent = '▲ 3D FRAME';
        screenTxt.setAttribute('fill', '#c4b5fd');
        await wait(400);
        flashGpuCores(false);
        running = false;
      });

      // Scenario 4: Speed Race
      container.querySelector('#m1-race').addEventListener('click', async () => {
        if (running) return;
        running = true;
        const bars = [
          { el: container.querySelector('#bar-reg'), dur: 120, name: 'CPU Register' },
          { el: container.querySelector('#bar-l1'), dur: 260, name: 'L1 Cache' },
          { el: container.querySelector('#bar-ram'), dur: 750, name: 'RAM' },
          { el: container.querySelector('#bar-ssd'), dur: 1700, name: 'NVMe SSD' },
          { el: container.querySelector('#bar-hdd'), dur: 3200, name: 'Spinning HDD' }
        ];
        bars.forEach((b) => { b.el.style.transition = 'none'; b.el.style.width = '0%'; });
        setNarration('<strong>Speed Race:</strong> Fetching 1 piece of data from each memory tier (slowed down so human eyes can watch!).');
        await wait(60);
        bars.forEach((b) => {
          b.el.style.transition = `width ${b.dur}ms linear`;
          b.el.style.width = '100%';
        });
        await wait(3300);
        setNarration('<strong>Race Complete!</strong> Registers & L1 finish instantly while an HDD takes millions of CPU cycles to mechanically seek.');
        running = false;
      });

      setNarration('Click any hardware component on the motherboard, or launch one of the <strong>Animate</strong> scenarios above.');
    },

    destroy() {
      clearTimers();
      running = false;
    }
  };
}

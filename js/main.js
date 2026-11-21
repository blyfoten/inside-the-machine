import { createModule1 } from './modules/mod1_hardware.js';
import { createModule2 } from './modules/mod2_files.js';
import { createModule3 } from './modules/mod3_memory.js';
import { createModule4 } from './modules/mod4_cpu_clock.js';
import { createModule5 } from './modules/mod5_c_to_asm.js';
import { createModule6 } from './modules/mod6_interrupts.js';
import { createModule7 } from './modules/mod7_gpu.js';
import { createModule8 } from './modules/mod8_capstone.js';

const MODULES = [
  {
    id: '01',
    title: 'Anatomy of a Computer',
    tag: 'CPU • RAM • HDD/SSD • GPU',
    factory: createModule1
  },
  {
    id: '02',
    title: 'Files, Bytes & Storage',
    tag: 'Hex Editor • Inodes • Platter',
    factory: createModule2
  },
  {
    id: '03',
    title: 'Stack, Heap & Pointers',
    tag: 'Memory Map • malloc • Arrows',
    factory: createModule3
  },
  {
    id: '04',
    title: 'Clock Cycles & Registers',
    tag: 'Fetch-Decode-Exec • Stalls',
    factory: createModule4
  },
  {
    id: '05',
    title: 'C → Assembly → Machine',
    tag: 'Cycle Stepper • PC • Stack',
    factory: createModule5
  },
  {
    id: '06',
    title: 'Interrupts & Preemption',
    tag: 'IRQ • IVT • Context Switch',
    factory: createModule6
  },
  {
    id: '07',
    title: 'CPU ↔ GPU Graphics',
    tag: 'PCIe • Shaders • VRAM Hex',
    factory: createModule7
  },
  {
    id: '08',
    title: 'Capstone: Key to Pixel',
    tag: 'Full Computer End-to-End',
    factory: createModule8
  }
];

let currentIndex = 0;
let activeInstance = null;
const visited = new Set([0]);

const navEl = document.getElementById('module-nav');
const stageBody = document.getElementById('stage-body');
const badgeEl = document.getElementById('module-badge');
const titleEl = document.getElementById('module-title');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const progressLabel = document.getElementById('progress-label');
const progressFill = document.getElementById('progress-fill');

function renderNav() {
  navEl.innerHTML = '';
  MODULES.forEach((mod, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `nav-item${idx === currentIndex ? ' active' : ''}${visited.has(idx) ? ' visited' : ''}`;
    btn.innerHTML = `
      <span class="nav-num">${mod.id}</span>
      <span class="nav-meta">
        <span class="nav-title">${mod.title}</span>
        <span class="nav-tag">${mod.tag}</span>
      </span>
    `;
    btn.addEventListener('click', () => loadModule(idx));
    navEl.appendChild(btn);
  });

  progressLabel.textContent = `${visited.size} / ${MODULES.length}`;
  progressFill.style.width = `${(visited.size / MODULES.length) * 100}%`;
}

function loadModule(idx) {
  if (idx < 0 || idx >= MODULES.length) return;

  if (activeInstance && typeof activeInstance.destroy === 'function') {
    activeInstance.destroy();
  }
  // Clear any flying packets in flight
  const packetLayer = document.getElementById('packet-layer');
  if (packetLayer) packetLayer.innerHTML = '';

  currentIndex = idx;
  visited.add(idx);
  const mod = MODULES[idx];

  badgeEl.textContent = `MODULE ${mod.id}`;
  titleEl.textContent = mod.title;
  btnPrev.disabled = idx === 0;
  btnNext.disabled = idx === MODULES.length - 1;
  btnNext.textContent = idx === MODULES.length - 1 ? 'Completed ✓' : 'Next →';

  stageBody.innerHTML = '';
  activeInstance = mod.factory();
  activeInstance.init(stageBody);

  renderNav();
}

btnPrev.addEventListener('click', () => loadModule(currentIndex - 1));
btnNext.addEventListener('click', () => loadModule(currentIndex + 1));

window.addEventListener('keydown', (e) => {
  const tag = (e.target && e.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' && currentIndex < MODULES.length - 1) {
    loadModule(currentIndex + 1);
  } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
    loadModule(currentIndex - 1);
  }
});

// Boot into Module 1
loadModule(0);

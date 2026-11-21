import { mountChapter1 } from './chapters/ch1_hardware.js';
import { mountChapter2 } from './chapters/ch2_files.js';
import { mountChapter3 } from './chapters/ch3_memory.js';
import { mountChapter4 } from './chapters/ch4_clock.js';
import { mountChapter5 } from './chapters/ch5_code.js';
import { mountChapter6 } from './chapters/ch6_interrupts.js';
import { mountChapter7 } from './chapters/ch7_gpu.js';

// Mount all 7 scrollytelling chapters onto the single scrollable page
mountChapter1(document.getElementById('ch-hardware'));
mountChapter2(document.getElementById('ch-files'));
mountChapter3(document.getElementById('ch-memory'));
mountChapter4(document.getElementById('ch-clock'));
mountChapter5(document.getElementById('ch-code'));
mountChapter6(document.getElementById('ch-interrupts'));
mountChapter7(document.getElementById('ch-gpu'));

// Hairline reading progress bar
const progressBar = document.getElementById('scroll-progress-bar');
function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0;
  progressBar.style.width = `${pct}%`;
}
window.addEventListener('scroll', updateScrollProgress, { passive: true });
updateScrollProgress();

// Active chapter highlight in slim top navigation bar
const pills = Array.from(document.querySelectorAll('.chap-pill'));
const sections = Array.from(document.querySelectorAll('section.chapter'));

const chapterObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        pills.forEach((p) => p.classList.toggle('active', p.dataset.ch === id));
      }
    }
  },
  {
    rootMargin: '-35% 0px -55% 0px',
    threshold: 0
  }
);

sections.forEach((s) => chapterObserver.observe(s));

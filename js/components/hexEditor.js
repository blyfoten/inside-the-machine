import { hex2, hex4, bin8 } from './animator.js';

/**
 * Reusable Interactive Hex Editor & Memory Inspector
 *
 * Options:
 *   bytes: Uint8Array | number[]
 *   baseAddr: number (default 0)
 *   rowAddresses: number[] | null (optional custom list of 8-byte aligned row starts, inserts gap divider when non-contiguous)
 *   editable: boolean (default false)
 *   getRegion: (addr) => 'code'|'header'|'data'|'heap'|'stack'|'vram'|'zero'
 *   getRegionLabel: (addr) => string
 *   legend: Array<{ label: string, color: string }>
 *   spAddr: number | null
 *   pcAddr: number | null
 *   onEdit: (addr, newVal) => void
 *   onSelect: (addr, val) => void
 */
export class HexEditor {
  constructor(container, opts = {}) {
    this.container = container;
    this.bytes = opts.bytes || new Uint8Array(64);
    this.baseAddr = opts.baseAddr ?? 0;
    this.rowAddresses = opts.rowAddresses || null;
    this.editable = Boolean(opts.editable);
    this.getRegion = opts.getRegion || (() => 'zero');
    this.getRegionLabel = opts.getRegionLabel || ((addr) => this.getRegion(addr).toUpperCase());
    this.legend = opts.legend || [];
    this.spAddr = opts.spAddr ?? null;
    this.pcAddr = opts.pcAddr ?? null;
    this.onEdit = opts.onEdit || null;
    this.onSelect = opts.onSelect || null;
    this.selectedAddr = this.rowAddresses ? this.rowAddresses[0] : this.baseAddr;
    this.cellMap = new Map();
    this.asciiMap = new Map();
    this.render();
  }

  getByte(addr) {
    const idx = addr - this.baseAddr;
    if (idx < 0 || idx >= this.bytes.length) return 0;
    return this.bytes[idx] & 0xff;
  }

  setByte(addr, val) {
    const idx = addr - this.baseAddr;
    if (idx < 0 || idx >= this.bytes.length) return;
    this.bytes[idx] = val & 0xff;
  }

  update(patch = {}) {
    if (patch.bytes !== undefined) this.bytes = patch.bytes;
    if (patch.baseAddr !== undefined) this.baseAddr = patch.baseAddr;
    if (patch.rowAddresses !== undefined) this.rowAddresses = patch.rowAddresses;
    if (patch.spAddr !== undefined) this.spAddr = patch.spAddr;
    if (patch.pcAddr !== undefined) this.pcAddr = patch.pcAddr;
    if (patch.getRegion !== undefined) this.getRegion = patch.getRegion;
    if (patch.getRegionLabel !== undefined) this.getRegionLabel = patch.getRegionLabel;
    if (patch.legend !== undefined) this.legend = patch.legend;
    this.render();
  }

  getCellEl(addr) {
    return this.cellMap.get(addr) || null;
  }

  flash(addr, mode = 'read') {
    const cell = this.cellMap.get(addr);
    if (!cell) return;
    cell.classList.remove('flash-read', 'flash-write');
    void cell.offsetWidth; // trigger reflow
    cell.classList.add(mode === 'write' ? 'flash-write' : 'flash-read');
  }

  select(addr) {
    this.selectedAddr = addr;
    this.renderInspector();
    for (const [a, el] of this.cellMap.entries()) {
      el.classList.toggle('selected', a === addr);
    }
    for (const [a, el] of this.asciiMap.entries()) {
      el.classList.toggle('selected', a === addr);
    }
    if (this.onSelect) this.onSelect(addr, this.getByte(addr));
  }

  render() {
    this.cellMap.clear();
    this.asciiMap.clear();
    this.container.innerHTML = '';

    const root = document.createElement('div');
    root.className = 'hex-editor';

    // Legend
    if (this.legend.length > 0) {
      const leg = document.createElement('div');
      leg.className = 'hex-legend';
      for (const item of this.legend) {
        const span = document.createElement('span');
        span.className = 'hex-legend-item';
        span.innerHTML = `<span class="hex-swatch" style="background:${item.color}"></span>${item.label}`;
        leg.appendChild(span);
      }
      root.appendChild(leg);
    }

    // Hex Table
    const wrap = document.createElement('div');
    wrap.className = 'hex-table-wrap';

    let rows = this.rowAddresses;
    if (!rows) {
      rows = [];
      for (let off = 0; off < this.bytes.length; off += 8) {
        rows.push(this.baseAddr + off);
      }
    }

    let prevAddr = null;
    for (const rowStart of rows) {
      if (prevAddr !== null && rowStart - prevAddr > 8) {
        const gap = document.createElement('div');
        gap.style.cssText = 'text-align:center;color:var(--ink-muted);font-size:10px;padding:3px 0;border-top:1px dashed var(--border);border-bottom:1px dashed var(--border);margin:3px 0;';
        gap.textContent = `⋮  unallocated gap (${rowStart - prevAddr - 8} bytes)  ⋮`;
        wrap.appendChild(gap);
      }
      prevAddr = rowStart;

      const row = document.createElement('div');
      row.className = 'hex-row';

      const addrEl = document.createElement('div');
      addrEl.className = 'hex-addr';
      addrEl.textContent = hex4(rowStart);
      row.appendChild(addrEl);

      const bytesEl = document.createElement('div');
      bytesEl.className = 'hex-bytes';

      const asciiEl = document.createElement('div');
      asciiEl.className = 'hex-ascii';

      for (let i = 0; i < 8; i++) {
        const addr = rowStart + i;
        const val = this.getByte(addr);
        const region = this.getRegion(addr, val);

        const cell = document.createElement('div');
        cell.className = `hex-cell region-${region}`;
        if (addr === this.selectedAddr) cell.classList.add('selected');
        if (this.spAddr !== null && addr === this.spAddr) cell.classList.add('ptr-sp');
        if (this.pcAddr !== null && addr === this.pcAddr) cell.classList.add('ptr-pc');
        cell.textContent = hex2(val);
        cell.title = `${hex4(addr)} | Hex: 0x${hex2(val)} | Dec: ${val} | Bin: ${bin8(val)}`;
        cell.addEventListener('click', () => this.select(addr));
        bytesEl.appendChild(cell);
        this.cellMap.set(addr, cell);

        const ch = document.createElement('span');
        const printable = val >= 32 && val <= 126;
        ch.className = `hex-ascii-ch${printable ? ' printable' : ''}${addr === this.selectedAddr ? ' selected' : ''}`;
        ch.textContent = printable ? String.fromCharCode(val) : '·';
        ch.style.cursor = 'pointer';
        ch.addEventListener('click', () => this.select(addr));
        asciiEl.appendChild(ch);
        this.asciiMap.set(addr, ch);
      }

      row.appendChild(bytesEl);
      row.appendChild(asciiEl);
      wrap.appendChild(row);
    }

    root.appendChild(wrap);

    // Byte Inspector Footer
    this.inspectorEl = document.createElement('div');
    this.inspectorEl.className = 'hex-inspector';
    root.appendChild(this.inspectorEl);

    this.container.appendChild(root);
    this.renderInspector();
  }

  renderInspector() {
    if (!this.inspectorEl) return;
    const addr = this.selectedAddr;
    const val = this.getByte(addr);
    const bits = bin8(val);
    const printable = val >= 32 && val <= 126 ? `'${String.fromCharCode(val)}'` : val === 0 ? `'\\0'` : 'non-ascii';
    const regionLabel = this.getRegionLabel(addr, val);

    this.inspectorEl.innerHTML = '';

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;';
    meta.innerHTML = `
      <span style="color:var(--blue);font-weight:700">${hex4(addr)}</span>
      <span class="pill">${regionLabel}</span>
      <span>Hex: <strong style="color:var(--amber)">0x${hex2(val)}</strong></span>
      <span>Dec: <strong>${val}</strong></span>
      <span>ASCII: <strong style="color:var(--emerald)">${printable}</strong></span>
    `;
    this.inspectorEl.appendChild(meta);

    const bitWrap = document.createElement('div');
    bitWrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const bitLabel = document.createElement('span');
    bitLabel.style.color = 'var(--ink-muted)';
    bitLabel.textContent = this.editable ? 'Flip bits:' : 'Bits:';
    bitWrap.appendChild(bitLabel);

    const strip = document.createElement('div');
    strip.className = 'bit-strip';
    for (let b = 7; b >= 0; b--) {
      const isOne = (val >> b) & 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bit-btn${isOne ? ' one' : ''}`;
      btn.textContent = String(isOne);
      btn.title = `Bit ${b} (value ${1 << b})`;
      if (this.editable) {
        btn.addEventListener('click', () => {
          const next = val ^ (1 << b);
          this.setByte(addr, next);
          if (this.onEdit) this.onEdit(addr, next);
          this.render();
          this.flash(addr, 'write');
        });
      } else {
        btn.style.cursor = 'default';
      }
      strip.appendChild(btn);
    }
    bitWrap.appendChild(strip);

    if (this.editable) {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 2;
      inp.value = hex2(val);
      inp.title = 'Type 2-digit hex (00-FF) & press Enter';
      inp.style.cssText = 'width:34px;background:#ffffff;border:1.5px solid var(--blue);border-radius:4px;color:var(--ink);font-family:var(--font-mono);font-size:11px;font-weight:700;text-align:center;padding:2px;';
      inp.addEventListener('change', () => {
        const parsed = parseInt(inp.value, 16);
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 255) {
          this.setByte(addr, parsed);
          if (this.onEdit) this.onEdit(addr, parsed);
          this.render();
          this.flash(addr, 'write');
        } else {
          inp.value = hex2(val);
        }
      });
      bitWrap.appendChild(inp);
    }

    this.inspectorEl.appendChild(bitWrap);
  }
}

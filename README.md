# Inside the Machine — Interactive Visual Computer Science Course

An animation-first, minimal-text interactive course for new Computer Science students covering how computers work from physical hardware up through C, assembly, memory, interrupts, and GPU graphics.

## Modules

1. **Anatomy of a Computer** — Interactive motherboard diagram (CPU, RAM, HDD/SSD, GPU, Monitor, Buses), animated boot/app/render flows, and a memory latency speed race.
2. **Files, Bytes & Storage** — Live two-way editing between human files (`hello.txt`, `icon.bmp`), a spinning HDD platter / SSD flash block visualizer with Inodes, and an interactive bit-flippable Hex Editor.
3. **Stack, Heap & Pointers** — Process virtual memory map showing the Stack growing downward (`SP ↓`), Heap growing upward (`malloc ↑`), glowing pointer arrows, dangling pointers on `free()`, and a synchronized RAM Hex Editor.
4. **Clock Cycles & Registers** — Live square-wave clock oscilloscope driving Fetch → Decode → Execute → Writeback with 16-bit machine-code decoding, ALU operations, and L1 vs RAM vs Disk stall simulation.
5. **C → Assembly → Machine Code Lab** — 4-pane interactive cycle-by-cycle simulator with 5 C programs (Arithmetic, Loops, Function Calls, Strings/Pointers, Heap `malloc`), flying register/stack data packets, time-travel Undo, and live RAM Hex Editor.
6. **Interrupts, Preemption & Multitasking** — Single CPU juggling two programs via Hardware Keyboard IRQ 1 and Timer IRQ 0 preemption, IVT lookup, Kernel Stack saves, PCB context switches, and a live CPU time-slicing timeline.
7. **CPU ↔ GPU Graphics Pipeline** — CPU vs 64-core GPU parallelism race, interactive triangle rotation, PCIe → Vertex Shader → Rasterizer → Fragment Shader animation, and live editable VRAM RGBA Hex Editor.
8. **Capstone: Trace a Keypress to a Pixel** — Press any key to watch all 6 layers (Keyboard IRQ → CPU/Stack ISR → Heap Hex → SSD Block → PCIe/GPU Shaders → Monitor LEDs) animate end-to-end.

## Running Locally

Because the app uses standard ES Modules with zero build dependencies, serve it with Python:

```bash
cd /home/pappa/.gemini/antigravity/scratch/inside-the-machine
python3 -m http.server 8123
```

Then open `http://localhost:8123` in your browser.

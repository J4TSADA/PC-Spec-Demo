/* ═══ viz.js — ผังเครื่อง 2D สไตล์แบบแปลน (มุมมองข้างเคส)
   ทุกกล่องสเกลจากขนาดจริง (มม.) ใน data.js — แนวเดียวกับ D9:
   "กล่อง parametric จาก dimensions_mm ตอบคำถามใส่ได้ไหมได้เท่าโมเดล 3D" ═══ */

window.VIZ = (function () {

  const COLORS = {
    GPU: "#B8CCEA", CPU: "#F2C9A0", MB: "#CFE3D4", RAM: "#E4D2EC",
    SSD: "#F5E6AC", HDD: "#F5E6AC", PSU: "#D8D8DC", COOL: "#C4E3EA",
    CASE: "none", PC: "#B8CCEA", OS: "#EEE",
  };

  function el(tag, attrs) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function box(g, x, y, w, h, fill, partIdx, label) {
    const grp = el("g", { class: "viz-part", "data-part": partIdx });
    grp.appendChild(el("rect", { class: "body", x, y, width: w, height: h,
      fill: fill || "#EEE", stroke: "#1B2A41", "stroke-width": 1.4 }));
    if (label) {
      const t = el("text", { class: "viz-label", x: x + w / 2, y: y + h / 2 + 3.5,
        "text-anchor": "middle" });
      t.textContent = label;
      grp.appendChild(t);
    }
    g.appendChild(grp);
    return grp;
  }

  /* เส้นบอกระยะแบบแบบแปลน (dimension line) */
  function dimLine(g, x1, y, x2, mm) {
    g.appendChild(el("line", { x1, y1: y, x2, y2: y, stroke: "#9FADBD", "stroke-width": 1 }));
    g.appendChild(el("line", { x1, y1: y - 4, x2: x1, y2: y + 4, stroke: "#9FADBD", "stroke-width": 1 }));
    g.appendChild(el("line", { x1: x2, y1: y - 4, x2: x2, y2: y + 4, stroke: "#9FADBD", "stroke-width": 1 }));
    const t = el("text", { class: "viz-dim-label", x: (x1 + x2) / 2, y: y - 5, "text-anchor": "middle" });
    t.textContent = mm + " mm";
    g.appendChild(t);
  }

  function findPart(parts, type) {
    const i = parts.findIndex(p => p.type === type);
    return i >= 0 ? { i, p: parts[i] } : null;
  }

  /* วาดทั้งผัง — parts คือ array ที่รวม parts+parts2 แล้ว */
  function draw(usecaseKey, tier, parts) {
    const K = tier.kase, M = 64;
    const W = K.w + M * 2, H = K.h + M * 1.6;
    const svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "ผังเครื่อง " + K.name });
    const g = el("g", {});
    svg.appendChild(g);

    /* ตัวเคส */
    g.appendChild(el("rect", { x: M, y: M * .6, width: K.w, height: K.h,
      fill: "#FFFFFF", stroke: "#1B2A41", "stroke-width": 2.2 }));
    dimLine(g, M, M * .6 + K.h + 26, M + K.w, K.w);
    const vt = el("text", { class: "viz-dim-label", x: M - 12, y: M * .6 + K.h / 2,
      "text-anchor": "middle", transform: "rotate(-90 " + (M - 12) + " " + (M * .6 + K.h / 2) + ")" });
    vt.textContent = K.h + " mm";
    g.appendChild(vt);

    const X = M, Y = M * .6;

    /* ── มินิพีซี: กล่องเดียวจบ ── */
    if (tier.id === "h1") {
      const pc = findPart(parts, "PC");
      if (pc) box(g, X + 8, Y + 5, pc.p.dims.w, pc.p.dims.h, COLORS.PC, pc.i, "N100");
      const ssd = findPart(parts, "SSD");
      if (ssd) box(g, X + 8, Y + 5 + 20, 100, 9, COLORS.SSD, ssd.i, "");
      return svg;
    }

    /* ── NAS: ถาดจานซ้อนด้านหน้า (ซ้าย) เมนบอร์ดขวา ── */
    if (usecaseKey === "home") {
      const hdd = findPart(parts, "HDD");
      const bays = tier.id === "h3" ? 6 : 4;
      const filled = 2;                       /* ในสเปคใส่จานมา 2 ลูก */
      for (let b = 0; b < bays; b++) {
        const by = Y + 16 + b * 34;
        if (b < filled && hdd) box(g, X + 14, by, 147, 28, COLORS.HDD, hdd.i, "HDD " + (b + 1));
        else g.appendChild(el("rect", { x: X + 14, y: by, width: 147, height: 28,
          fill: "none", stroke: "#9FADBD", "stroke-dasharray": "4 3", "stroke-width": 1.2 }));
      }
      const mb = findPart(parts, "MB");
      const mbX = X + K.w - 200, mbY = Y + 20;
      if (mb) box(g, mbX, mbY, 180, 150, COLORS.MB, mb.i, "MB");
      const cpu = findPart(parts, "CPU");
      if (cpu) box(g, mbX + 55, mbY + 30, 44, 44, COLORS.CPU, cpu.i, "CPU");
      const ram = findPart(parts, "RAM");
      if (ram) { box(g, mbX + 120, mbY + 20, 12, 90, COLORS.RAM, ram.i, "");
                 box(g, mbX + 138, mbY + 20, 12, 90, COLORS.RAM, ram.i, ""); }
      const ssd = findPart(parts, "SSD");
      if (ssd) box(g, mbX + 30, mbY + 105, 80, 16, COLORS.SSD, ssd.i, "NVMe");
      const psu = findPart(parts, "PSU");
      if (psu) box(g, X + K.w - 160, Y + K.h - 80, 125, 60, COLORS.PSU, psu.i, "PSU");
      return svg;
    }

    /* ── ทาวเวอร์ (AI / เกม): เมนบอร์ดชิดขวา · GPU เสียบขวาง · PSU ล่าง ── */
    const mb = findPart(parts, "MB");
    const mbW = mb ? mb.p.dims.w : 244, mbH = mb ? mb.p.dims.h : 244;
    const mbX = X + K.w - mbW - 26, mbY = Y + 34;
    if (mb) box(g, mbX, mbY, mbW, mbH, COLORS.MB, mb.i, "");

    const cpu = findPart(parts, "CPU");
    const cool = findPart(parts, "COOL");
    const cpuX = mbX + mbW * .42, cpuY = mbY + 42;
    if (cool && cool.p.dims.h > 100) {          /* tower cooler ครอบซีพียู */
      box(g, cpuX - 38, cpuY - 24, 110, 110, COLORS.COOL, cool.i, "COOLER");
    }
    if (cpu) box(g, cpuX, cpuY, cpu.p.dims.w, cpu.p.dims.h, COLORS.CPU, cpu.i, "CPU");
    if (cool && cool.p.dims.h <= 100) {         /* AIO: หม้อน้ำแปะบนเคส */
      const rw = Math.min(cool.p.dims.w, K.w - 60);
      box(g, X + 30, Y + 6, rw, 34, COLORS.COOL, cool.i, "AIO " + cool.p.dims.w + "mm");
    }

    const ram = findPart(parts, "RAM");
    if (ram) for (let s = 0; s < 2; s++)
      box(g, mbX + mbW - 46 + s * 18, mbY + 26, 12, 120, COLORS.RAM, ram.i, "");

    /* GPU: ความยาวจริง ยื่นจากสล็อต PCIe ไปทางหน้าเคส */
    const gpu = findPart(parts, "GPU");
    if (gpu) {
      const gw = gpu.p.dims.w, dual = gpu.p.dims.h > 200;
      const gy = mbY + mbH - 46;
      box(g, mbX + mbW - 20 - gw, gy, gw, 46, COLORS.GPU, gpu.i, gpu.p.name.split(" ")[0] + " " + gpu.p.name.split(" ")[1]);
      if (dual) box(g, mbX + mbW - 20 - gw, gy + 62, gw, 46, COLORS.GPU, gpu.i, "GPU #2");
      dimLine(g, mbX + mbW - 20 - gw, gy + (dual ? 124 : 62), mbX + mbW - 20, gw);
    }

    const ssd = findPart(parts, "SSD");
    if (ssd) box(g, mbX + 24, mbY + mbH - 100, 80, 16, COLORS.SSD, ssd.i, "NVMe");

    const psu = findPart(parts, "PSU");
    if (psu) box(g, X + 22, Y + K.h - psu.p.dims.h - 18, psu.p.dims.w, psu.p.dims.h,
                 COLORS.PSU, psu.i, "PSU " + psu.p.name.split(" ")[0]);

    /* พัดลมหน้า (ตกแต่งเชิงข้อมูล: airflow เข้าหน้า-ออกหลัง) */
    for (let f = 0; f < 2; f++) {
      g.appendChild(el("circle", { cx: X + 34, cy: Y + 70 + f * 90, r: 26,
        fill: "none", stroke: "#9FADBD", "stroke-width": 1.4, "stroke-dasharray": "5 4" }));
      g.appendChild(el("path", { d: "M " + (X + 70) + " " + (Y + 70 + f * 90) + " h 26 m -8 -6 l 8 6 l -8 6",
        fill: "none", stroke: "#9FADBD", "stroke-width": 1.4 }));
    }
    return svg;
  }

  /* hover sync: ผูก svg ↔ รายการอุปกรณ์ */
  function bindHover(svg, listEl) {
    function setHL(idx, on) {
      svg.querySelectorAll('.viz-part[data-part="' + idx + '"]').forEach(n => n.classList.toggle("hl", on));
      const li = listEl.querySelector('li[data-part="' + idx + '"]');
      if (li) li.classList.toggle("hl", on);
    }
    svg.addEventListener("mouseover", e => { const p = e.target.closest(".viz-part"); if (p) setHL(p.dataset.part, true); });
    svg.addEventListener("mouseout",  e => { const p = e.target.closest(".viz-part"); if (p) setHL(p.dataset.part, false); });
    listEl.addEventListener("mouseover", e => { const li = e.target.closest("li[data-part]"); if (li) setHL(li.dataset.part, true); });
    listEl.addEventListener("mouseout",  e => { const li = e.target.closest("li[data-part]"); if (li) setHL(li.dataset.part, false); });
  }

  return { draw, bindHover };
})();

/* ═══ app.js — ประกอบหน้า: อ่าน input → เลือก tier → ตัดสิน → เรนเดอร์ ═══ */

(function () {
  const D = window.SPEC_DATA, C = window.CLOUD, V = window.VIZ, AI = window.AI;
  const page = document.body.dataset.page;                  /* sme | gaming */
  const $ = id => document.getElementById(id);

  let usecase = (page === "gaming") ? "gaming" : "ai";
  let polish = true;                                         /* ขั้น Pathumma เปิดอยู่ */
  let hours = null;      /* null = ยังไม่ได้แก้เอง ใช้ค่าตามงาน (data.js defaultHours) */
  let current = null;                                        /* { tier, ev, budget } */

  const defaultHours = key => D.usecases[key].defaultHours;

  /* ── ควบคุมด้านบน ── */
  $("stPathumma").addEventListener("click", () => {
    polish = !polish;
    $("stPathumma").classList.toggle("on", polish);
    $("stPathumma").setAttribute("aria-pressed", String(polish));
    if (current) { renderAI(); polishPage(); }               /* สลับแล้วขอใหม่ทั้งหน้า */
  });

  $("draftToggle").addEventListener("click", () => {
    const hidden = $("draftBox").classList.toggle("hidden");
    $("draftToggle").setAttribute("aria-expanded", String(!hidden));
    $("draftToggle").textContent = hidden
      ? "ดูร่างก่อนเรียบเรียง (จาก Gemini)"
      : "ซ่อนร่าง";
  });

  document.querySelectorAll(".usecase[data-usecase]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".usecase").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      usecase = btn.dataset.usecase;
    });
  });

  const range = $("budgetRange"), input = $("budgetInput");
  range.addEventListener("input", () => input.value = range.value);
  input.addEventListener("input", () => range.value = input.value);

  /* ป้ายบนหัว: บอกความจริงว่ากำลังรันโหมดไหน */
  AI.mode().then(m => {
    const b = $("modeBadge");
    if (!b) return;
    if (m === "live") {
      b.textContent = "ต่อ AI จริง";
      b.style.background = "var(--ok-bg)";
      b.style.color = "var(--ok)";
      b.style.borderColor = "var(--ok)";
      b.title = "เรียก Gemini + Pathumma ผ่าน backend localhost:5000";
    } else {
      b.textContent = "โหมดจำลอง";
      b.title = "ยังไม่ได้ต่อ backend — เปิดผ่าน http และรัน Project-test เพื่อใช้ AI จริง";
    }
  });

  /* เลือก tier: งบต่ำกว่าขั้นต่ำ → ใช้ tier แรกเป็น "สเปคที่ควรเก็บเงินไปให้ถึง" */
  function pickTier(key, budget) {
    const tiers = D.usecases[key].tiers;
    for (let i = tiers.length - 1; i >= 0; i--)
      if (budget >= tiers[i].min) return tiers[i];
    return tiers[0];
  }

  function generate() {
    const budget = Math.max(+input.value || 0, +input.min);
    const tier = pickTier(usecase, budget);
    const ev = C.evaluate(usecase, budget, tier, hours ?? defaultHours(usecase));
    current = { tier, ev, budget };
    render();
    $("result").classList.remove("hidden");
    $("result").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("goBtn").addEventListener("click", generate);

  function render() {
    const { tier, ev } = current;
    const parts = tier.parts.concat(tier.parts2 || []);

    /* คำตัดสิน + ช่องแก้ชั่วโมง (สร้างใหม่ทุกครั้ง ต้อง bind ใหม่) */
    $("verdict").innerHTML = C.verdictHTML(usecase, ev, tier.name);
    const hi = $("hoursInput");
    if (hi) hi.addEventListener("change", () => {
      hours = Math.min(720, Math.max(5, +hi.value || 60));
      current.ev = C.evaluate(usecase, current.budget, tier, hours);
      render();                                              /* คำนวณใหม่ทั้งชุด */
    });

    /* ผังเครื่อง */
    $("vizTitle").textContent = "ผังเครื่อง — " + tier.kase.name;
    $("vizDims").textContent = tier.kase.w + " × " + tier.kase.h + " mm · " + tier.chip;
    const wrap = $("vizWrap");
    wrap.innerHTML = "";
    const svg = V.draw(usecase, tier, parts);
    wrap.appendChild(svg);

    /* รายการอุปกรณ์ + ลิงก์ร้าน */
    const list = $("partsList");
    list.innerHTML = parts.map((p, i) => {
      const links = p.price > 0
        ? '<span class="part-links">' + D.buyLinks(p.name).map(l =>
            '<a class="buy" href="' + l.url + '" target="_blank" rel="noopener">' + l.shop + ' ↗</a>').join("") + "</span>"
        : "";
      const upg = p.upgrade ? '<div class="part-upg" data-polish>' + p.upgrade + "</div>" : "";
      return '<li data-part="' + i + '">' +
        '<div class="part-top"><div><div class="part-type">' + p.type + '</div>' +
        '<div class="part-name">' + p.name + '</div></div>' +
        '<div class="part-price">' + (p.price > 0 ? C.fmt(p.price) + "฿" : "ฟรี") + "</div></div>" +
        '<div class="part-reason" data-polish>' + p.reason + "</div>" + upg + links + "</li>";
    }).join("");
    $("partsTotal").textContent = "รวม " + C.fmt(ev.total) + "฿";
    V.bindHover(svg, list);

    /* งบเหลือ — กันงงว่า "ใส่งบเพิ่มแล้วทำไมไม่เปลี่ยน" */
    const left = current.budget - ev.total;
    const leftEl = $("budgetLeft");
    if (leftEl) {
      if (left > ev.total * 0.15) {
        leftEl.textContent = "งบเหลือ " + C.fmt(left) + "฿ — สเปคชุดนี้คือจุดคุ้มค่าของงานนี้แล้ว " +
          "เงินส่วนที่เหลือได้ผลตอบแทนดีกว่าถ้าลงกับของรอบข้าง (จอ · UPS · NAS · เน็ต) " +
          "มากกว่าดันสเปคเครื่องขึ้นไปอีก — ดูช่องอัปเกรดขั้นถัดไป";
        leftEl.classList.remove("hidden");
      } else if (left < 0) {
        leftEl.textContent = "สเปคชุดนี้เกินงบ " + C.fmt(-left) + "฿ — เป็นสเปคที่ควรเก็บเงินไปให้ถึง";
        leftEl.classList.remove("hidden");
      } else {
        leftEl.classList.add("hidden");
      }
    }

    /* สามช่องล่าง */
    $("perfList").innerHTML = tier.perf.map(x =>
      '<li><span>' + x.k + '</span><span class="v">' + x.v + "</span></li>").join("");
    $("tempList").innerHTML = tier.temps.map(x =>
      '<li><span>' + x.k + '</span><span class="v' + (x.hot ? " hot" : "") + '">' + x.v + "</span></li>").join("");
    $("upgradeList").innerHTML = tier.upgrades.map(u =>
      '<li><span class="upg-title">' + u.title + '</span>' +
      '<span class="upg-meta">' + u.cost + '฿ · <span class="upg-gain" data-polish>' + u.gain + "</span></span></li>").join("");

    /* แหล่งอ้างอิง */
    $("refsList").innerHTML = C.refs[usecase].map(r =>
      r.u ? '<li><a href="' + r.u + '" target="_blank" rel="noopener">' + r.t + " ↗</a></li>"
          : '<li><span class="ref-note">' + r.t + "</span></li>").join("");

    renderAI();
    polishPage();
  }

  /* ─── เรียบเรียงข้อความอธิบายทั้งหน้าด้วย Pathumma ───
     หน้าเรนเดอร์ด้วยต้นฉบับก่อนเสมอ (ผู้ใช้ไม่ต้องรอ) แล้วค่อยสลับข้อความทีหลัง
     เก็บต้นฉบับไว้ที่ data-orig เพื่อกดปิดแล้วคืนค่าได้โดยไม่ต้องเรนเดอร์ใหม่ */
  let polishSeq = 0;

  async function polishPage() {
    const seq = ++polishSeq;
    const nodes = Array.from($("result").querySelectorAll("[data-polish]"));
    if (nodes.length === 0) return;

    nodes.forEach(n => { if (!n.dataset.orig) n.dataset.orig = n.textContent; });

    if (!polish) {                                   /* ปิดขั้นนี้ = คืนต้นฉบับ */
      nodes.forEach(n => { n.textContent = n.dataset.orig; });
      setPolishNote("");
      return;
    }

    setPolishNote("กำลังเรียบเรียง " + nodes.length + " จุด…");
    try {
      const out = await AI.polishTexts(nodes.map(n => n.dataset.orig));
      if (seq !== polishSeq) return;                 /* มีรอบใหม่กว่าแล้ว ทิ้งอันนี้ */
      if (!out.polished) { setPolishNote(""); return; }

      let changed = 0;
      nodes.forEach((n, i) => {
        const t = out.texts[i];
        if (typeof t === "string" && t.trim()) {
          if (t !== n.dataset.orig) changed++;
          n.textContent = t;
        }
      });
      const who = out.live ? "Pathumma (ThaiLLM)" : "ตัวขัดจำลองในเครื่อง";
      const chunks = out.live && out.totalChunks
        ? " · ก้อนสำเร็จ " + out.okChunks + "/" + out.totalChunks : "";
      setPolishNote(who + " เรียบเรียง " + nodes.length + " จุด · เปลี่ยนจริง " + changed + chunks);
    } catch (err) {
      if (seq !== polishSeq) return;
      setPolishNote("เรียบเรียงไม่สำเร็จ แสดงข้อความต้นฉบับแทน");
    }
  }

  function setPolishNote(text) {
    const el = $("polishNote");
    if (el) el.textContent = text;
  }

  /* เหตุผลจาก AI — สายงานสองขั้น Gemini → Pathumma */
  let aiSeq = 0;

  function setStage(name, state) {
    const el = name === "gemini" ? $("stGemini") : $("stPathumma");
    if (el) el.dataset.state = state;
  }

  async function renderAI() {
    const seq = ++aiSeq;
    const { tier, ev, budget } = current;

    setStage("gemini", "idle"); setStage("pathumma", "idle");
    $("aiModelTag").textContent = polish
      ? AI.STAGES.gemini.tag + " → " + AI.STAGES.pathumma.tag
      : AI.STAGES.gemini.tag + " (ไม่ผ่านขั้นเรียบเรียง)";
    $("aiBody").innerHTML = '<span class="thinking">กำลังวิเคราะห์</span>';

    try {
      const out = await AI.explain({ usecase, budget, tier, ev, polish, onStage: setStage });
      if (seq !== aiSeq) return;                     /* มีคำขอใหม่กว่าแล้ว ทิ้งอันนี้ */
      $("aiBody").textContent = out.final;
      $("draftBox").textContent = out.draft;
      $("draftToggle").parentElement.classList.toggle("hidden", !out.polished);
    } catch (err) {
      if (seq !== aiSeq) return;
      setStage("gemini", "idle"); setStage("pathumma", "idle");
      $("aiBody").innerHTML = '<span class="ref-note">ต่อ backend ไม่ได้ (' + err.message +
        ') — เดโมยังใช้งานได้เต็มรูปแบบในโหมดจำลอง ดูวิธีต่อของจริงใน README.md</span>';
    }
  }
})();

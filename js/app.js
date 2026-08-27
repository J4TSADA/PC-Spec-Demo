/* ═══ app.js — ประกอบหน้า: อ่าน input → เลือก tier → ตัดสิน → เรนเดอร์ ═══ */

(function () {
  const D = window.SPEC_DATA, C = window.CLOUD, V = window.VIZ, AI = window.AI;
  const page = document.body.dataset.page;                  /* sme | gaming */
  const $ = id => document.getElementById(id);

  let usecase = (page === "gaming") ? "gaming" : "ai";
  let model = "gemini";
  let hours = 60;                                            /* ชม.ใช้งาน/เดือน เริ่มต้น */
  let current = null;                                        /* { tier, ev, budget } */

  /* ── ควบคุมด้านบน ── */
  document.querySelectorAll(".ai-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".ai-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      model = btn.dataset.model;
      if (current) renderAI();                               /* สลับโมเดล → ขอคำอธิบายใหม่ */
    });
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
    const ev = C.evaluate(usecase, budget, tier, hours);
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
      const upg = p.upgrade ? '<div class="part-upg">' + p.upgrade + "</div>" : "";
      return '<li data-part="' + i + '">' +
        '<div class="part-top"><div><div class="part-type">' + p.type + '</div>' +
        '<div class="part-name">' + p.name + '</div></div>' +
        '<div class="part-price">' + (p.price > 0 ? C.fmt(p.price) + "฿" : "ฟรี") + "</div></div>" +
        '<div class="part-reason">' + p.reason + "</div>" + upg + links + "</li>";
    }).join("");
    $("partsTotal").textContent = "รวม " + C.fmt(ev.total) + "฿";
    V.bindHover(svg, list);

    /* สามช่องล่าง */
    $("perfList").innerHTML = tier.perf.map(x =>
      '<li><span>' + x.k + '</span><span class="v">' + x.v + "</span></li>").join("");
    $("tempList").innerHTML = tier.temps.map(x =>
      '<li><span>' + x.k + '</span><span class="v' + (x.hot ? " hot" : "") + '">' + x.v + "</span></li>").join("");
    $("upgradeList").innerHTML = tier.upgrades.map(u =>
      '<li><span class="upg-title">' + u.title + '</span>' +
      '<span class="upg-meta">' + u.cost + '฿ · <span class="upg-gain">' + u.gain + "</span></span></li>").join("");

    /* แหล่งอ้างอิง */
    $("refsList").innerHTML = C.refs[usecase].map(r =>
      r.u ? '<li><a href="' + r.u + '" target="_blank" rel="noopener">' + r.t + " ↗</a></li>"
          : '<li><span class="ref-note">' + r.t + "</span></li>").join("");

    renderAI();
  }

  /* เหตุผลจาก AI (แยกออกมาเพื่อให้สลับโมเดลแล้วเรียกใหม่ได้) */
  let aiSeq = 0;
  async function renderAI() {
    const seq = ++aiSeq;
    const { tier, ev, budget } = current;
    $("aiModelTag").textContent = AI.MODEL_INFO[model].tag + " · " + AI.MODEL_INFO[model].note;
    $("aiBody").innerHTML = '<span class="thinking">กำลังเรียบเรียง</span>';
    try {
      const text = await AI.explain(usecase, budget, tier, ev, model);
      if (seq !== aiSeq) return;                     /* มีคำขอใหม่กว่าแล้ว ทิ้งอันนี้ */
      $("aiBody").textContent = text;
    } catch (err) {
      if (seq !== aiSeq) return;
      $("aiBody").innerHTML = '<span class="ref-note">ต่อ backend ไม่ได้ (' + err.message +
        ') — เดโมยังใช้งานได้เต็มรูปแบบในโหมดจำลอง ดูวิธีต่อของจริงใน README.md</span>';
    }
  }
})();

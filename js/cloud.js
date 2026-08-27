/* ═══ cloud.js — ตัดสิน "ประกอบเอง vs เช่า cloud" ด้วยเลขจริง โปร่งใสทุกตัว
   ราคา cloud ตรวจ ส.ค. 2026:
   - RunPod: RTX 4090 $0.69/ชม. (Secure) · RTX 5090 $0.99/ชม. · Community เริ่ม $0.34
   - Vast.ai: RTX 4090 เริ่ม ~$0.29-0.39/ชม.
   - GeForce NOW: Performance $9.99/ด. · Ultimate $19.99/ด. (เพดาน 100 ชม./ด.)
   - Google One 2TB: $9.99/ด. ═══ */

window.CLOUD = (function () {
  const D = window.SPEC_DATA;

  const REFS = {
    ai: [
      { t: "RunPod — GPU Cloud Pricing (4090 $0.69 · 5090 $0.99/ชม.)", u: "https://www.runpod.io/pricing" },
      { t: "Vast.ai — ตลาดเช่า GPU ราคาเริ่ม ~$0.29/ชม.", u: "https://vast.ai/pricing" },
      { t: "getdeploying.com — เทียบราคา GPU cloud 16+ เจ้า", u: "https://getdeploying.com/gpus/nvidia-rtx-4090" },
      { t: "สมมติฐาน: ไฟ 4.5฿/หน่วย · 36฿/$ · รอบเปลี่ยนฮาร์ดแวร์ 36 เดือน", u: null },
    ],
    home: [
      { t: "Google One — 2TB $9.99/เดือน", u: "https://one.google.com/about/plans" },
      { t: "ข้อสังเกต: cloud storage จ่ายตลอดชีพและความจุตายตัว NAS จ่ายครั้งเดียวและขยายได้", u: null },
      { t: "สมมติฐาน: ไฟ 4.5฿/หน่วย · อายุใช้งานเครื่อง 60 เดือน", u: null },
    ],
    gaming: [
      { t: "GeForce NOW — Performance $9.99 · Ultimate $19.99/เดือน (จำกัด 100 ชม./ด.)", u: "https://www.nvidia.com/en-us/geforce-now/memberships/" },
      { t: "สมมติฐาน: ไฟ 4.5฿/หน่วย · 36฿/$ · รอบเปลี่ยนฮาร์ดแวร์ 36 เดือน", u: null },
    ],
  };

  function partsTotal(tier) {
    return tier.parts.concat(tier.parts2 || []).reduce((s, p) => s + p.price, 0);
  }

  /* evaluate: คืน { verdict:'cloud'|'build', ... math } — hours = ชม.ใช้งาน/เดือน (ผู้ใช้แก้ได้) */
  function evaluate(usecaseKey, budget, tier, hours) {
    const total = partsTotal(tier);
    const c = tier.cloud;

    /* งบไม่ถึงสเปคเริ่มต้นของงานนั้นเลย → cloud ทันที */
    const under = budget < window.SPEC_DATA.usecases[usecaseKey].minBuild;

    let cloudMonthly, cloudLabel;
    if (c.isGfn || c.isStorage) {
      cloudMonthly = c.rateUsd * D.FX;                 // ค่าสมาชิกรายเดือน
      cloudLabel = c.gpuLabel;
    } else {
      cloudMonthly = c.rateUsd * D.FX * hours;         // เช่ารายชั่วโมง
      cloudLabel = c.gpuLabel + " × " + hours + " ชม./ด.";
    }

    const elecMonthly = Math.round((tier.watt * hours + tier.idleWatt * (720 - hours)) / 1000 * D.ELEC);
    const elecUse = (usecaseKey === "home") ? Math.round(tier.watt * 720 / 1000 * D.ELEC) : elecMonthly;
    /* home server เปิด 24 ชม. — คิดไฟเต็มเดือน */

    const monthlySaving = cloudMonthly - elecUse;       // ที่ประหยัดได้ต่อเดือนถ้าประกอบเอง
    const breakEven = monthlySaving > 0 ? Math.ceil(total / monthlySaving) : Infinity;
    const horizon = c.refreshMonths;                    // อายุคุ้มค่าของฮาร์ดแวร์

    let verdict = "build";
    if (under) verdict = "cloud";
    else if (c.isGfn) verdict = "build";
    /* GFN ถูกกว่าเชิงเลขแทบเสมอ แต่ได้แค่ "สตรีมเกม" (เพดาน 100 ชม./ด. ต้องมีเครื่อง+เน็ตนิ่ง)
       ส่วนการประกอบได้คอมทั้งเครื่องไว้เรียน/ทำงาน/ขายต่อ — เทียบรายเดือนตรงๆ ไม่แฟร์
       จึงแนะนำ GFN เฉพาะตอนงบยังไม่ถึงสเปคขั้นต่ำ และยังโชว์เลข GFN ให้ดูเสมอ */
    else if (breakEven > horizon) verdict = "cloud";

    return { verdict, under, total, cloudMonthly: Math.round(cloudMonthly),
             cloudLabel, elecMonthly: elecUse, monthlySaving: Math.round(monthlySaving),
             breakEven, horizon, hours, isGfn: !!c.isGfn, isStorage: !!c.isStorage };
  }

  function fmt(n) { return n.toLocaleString("th-TH"); }

  /* สร้าง HTML คำตัดสิน + โชว์เลขทุกตัวให้ตรวจได้ */
  function verdictHTML(usecaseKey, ev, tierName) {
    const be = (ev.breakEven === Infinity) ? "ไม่มีวันคืนทุน" : ev.breakEven + " เดือน";
    const math =
      '<div class="verdict-math">' +
      'ค่าเครื่องรวม <b>' + fmt(ev.total) + '฿</b> · cloud <b>' + fmt(ev.cloudMonthly) + '฿/ด.</b> (' + ev.cloudLabel + ')' +
      ' · ค่าไฟถ้าประกอบเอง <b>' + fmt(ev.elecMonthly) + '฿/ด.</b><br>' +
      'จุดคืนทุน = ' + fmt(ev.total) + ' ÷ (' + fmt(ev.cloudMonthly) + ' − ' + fmt(ev.elecMonthly) + ') = <b>' + be + '</b>' +
      ' · เทียบกับอายุคุ้มค่าฮาร์ดแวร์ <b>' + ev.horizon + ' เดือน</b><br>' +
      'ชั่วโมงใช้งานของคุณ: <input type="number" class="hours-inline" id="hoursInput" min="5" max="720" value="' + ev.hours + '"> ชม./เดือน — แก้เลขนี้แล้วคำตัดสินคำนวณใหม่ทันที' +
      '</div>';

    if (ev.verdict === "cloud") {
      const alt = ev.cloudLabel.split(" ×")[0];
      const why = ev.under
        ? (ev.isGfn
            ? "งบยังไม่ถึงสเปคเริ่มต้นที่เล่นได้จริง ประกอบตอนนี้จะได้เครื่องที่ตกรุ่นเร็วและเล่นเกมใหม่ไม่ไหว ระหว่างเก็บเงินเล่นผ่าน " + alt + " ไปก่อน (" + fmt(ev.cloudMonthly) + "฿/ด. เพดาน 100 ชม.)"
            : "งบยังไม่ถึงสเปคเริ่มต้นของงานนี้ ประกอบตอนนี้จะได้เครื่องที่ทำงานจริงไม่ไหวแล้วเสียดายทีหลัง")
        : "ที่ชั่วโมงใช้งานระดับนี้ กว่าเครื่องจะคืนทุน (" + be + ") ฮาร์ดแวร์ก็ตกรุ่นก่อน (" + ev.horizon + " เดือน)";
      return '<div class="verdict cloud"><span class="verdict-tag">คำตัดสิน — ยังไม่ควรประกอบ</span>' +
        '<h3>เก็บงบไว้ก่อน ใช้ cloud คุ้มกว่า</h3>' +
        '<p>' + why + (ev.under && ev.isGfn ? '' : ' เริ่มจาก ' + alt + ' ราว ' + fmt(ev.cloudMonthly) + '฿/เดือน ') +
        'พอชั่วโมงใช้งานสูงขึ้นหรือเก็บงบถึงสเปคถัดไป ค่อยกลับมาดูใหม่ — ตัวเลขด้านล่างตรวจเองได้ทุกตัว</p>' + math + '</div>';
    }
    if (ev.isGfn) {
      return '<div class="verdict build"><span class="verdict-tag">คำตัดสิน — ประกอบเองคุ้ม</span>' +
        '<h3>' + tierName + '</h3>' +
        '<p>เชิงตัวเลขล้วนๆ ' + ev.cloudLabel + ' (' + fmt(ev.cloudMonthly) + '฿/ด.) ถูกกว่าเสมอ ' +
        'แต่มันได้แค่ "สตรีมเกม" — มีเพดาน 100 ชม./เดือน ต้องมีเน็ตนิ่งและอุปกรณ์อยู่แล้ว ' +
        'ส่วนเครื่องนี้เป็นคอมเต็มตัว ใช้เรียน ทำงาน ตัดต่อ และขายต่อได้ เราจึงแนะนำให้ประกอบเมื่องบถึงระดับนี้ ' +
        'ถ้าคุณต้องการแค่เกมล้วนๆ ปีละไม่กี่สิบชั่วโมง cloud ก็เป็นคำตอบที่ดี — เลขอยู่ข้างล่าง ตัดสินเองได้</p>' + math + '</div>';
    }
    return '<div class="verdict build"><span class="verdict-tag">คำตัดสิน — ประกอบเองคุ้ม</span>' +
      '<h3>' + tierName + '</h3>' +
      '<p>ที่ชั่วโมงใช้งานของคุณ เครื่องนี้คืนทุนใน <b>' + be + '</b> เร็วกว่าอายุคุ้มค่าฮาร์ดแวร์ (' + ev.horizon + ' เดือน) ' +
      'หลังจากนั้นคือกำไรเทียบกับการเช่า และเครื่องยังเป็นของคุณไว้ขายต่อได้</p>' + math + '</div>';
  }

  return { evaluate, verdictHTML, partsTotal, refs: REFS, fmt };
})();

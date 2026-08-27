/* ═══ ai.js — ชั้นเชื่อม AI แยกเป็น provider
   MODE = "mock" : ใช้ตัวเรียบเรียงในเครื่อง (เดโมทำงานได้โดยไม่ต้องมี backend)
   MODE = "live" : ยิงไป backend Express ของโปรเจกต์ (Project-test)
                   POST /api/spec/recommend { usecase, budget, model, tierId }
                   ฝั่ง backend ค่อยเรียก Gemini (@google/genai) หรือ Pathumma
   ※ ห้ามเรียก Gemini ตรงจากหน้าเว็บเด็ดขาด — API key จะหลุด
     ต้องผ่าน backend เสมอ (เหตุผลเดียวกับที่คุยกันเรื่อง GEMINI_API_KEY) ═══ */

window.AI = (function () {
  const MODE = "mock";
  const BACKEND = "http://localhost:5000/api/spec/recommend";

  const MODEL_INFO = {
    gemini:   { tag: "gemini-3.6-flash", note: "ค้นเว็บ + เหตุผลหลัก" },
    pathumma: { tag: "Pathumma-ThaiLLM-qwen3-8b", note: "เรียบเรียงภาษาไทย · โฮสต์ในประเทศ" },
  };

  /* mock: เรียบเรียงเหตุผลจากข้อมูล tier — โครงเดียวกับ prompt ที่จะส่งให้โมเดลจริง */
  function mockExplain(usecaseKey, budget, tier, ev) {
    const fmt = window.CLOUD.fmt;
    const lines = [];
    if (ev.verdict === "cloud") {
      lines.push("ผมดูตัวเลขแล้วขอพูดตรงๆ: งบ " + fmt(budget) + " บาทกับชั่วโมงใช้งาน " + ev.hours +
        " ชม./เดือน ยังไม่ถึงจุดที่การประกอบเครื่องคุ้มค่า จุดคืนทุนอยู่ที่ " +
        (ev.breakEven === Infinity ? "ไกลจนวัดไม่ได้" : ev.breakEven + " เดือน") +
        " ขณะที่ฮาร์ดแวร์มีอายุคุ้มค่าราว " + ev.horizon + " เดือน");
      lines.push("ทางที่แนะนำ: ใช้ " + ev.cloudLabel.split(" ×")[0] + " ไปก่อน (" +
        fmt(ev.cloudMonthly) + " บาท/เดือน) แล้วเก็บงบส่วนต่างไว้ พอใช้งานถี่ขึ้นจนจุดคืนทุนสั้นกว่า " +
        ev.horizon + " เดือน ค่อยประกอบ — ถึงตอนนั้นของก็ถูกลงและใหม่กว่าด้วย");
      return lines.join("\n\n");
    }
    const gpu = tier.parts.find(p => p.type === "GPU") || tier.parts[0];
    lines.push("งบ " + fmt(budget) + " บาทสำหรับงาน" +
      (usecaseKey === "ai" ? " AI" : usecaseKey === "home" ? " home server" : "เกม") +
      " ผมจัดชุด \u201C" + tier.name + "\u201D รวม " + fmt(ev.total) + " บาท หัวใจอยู่ที่ " +
      gpu.name + " — " + gpu.reason);
    if (ev.isGfn) {
      lines.push("ความคุ้ม: ถ้าดูรายเดือนล้วนๆ " + ev.cloudLabel + " (" + fmt(ev.cloudMonthly) +
        " บาท/เดือน) ถูกกว่า แต่สิ่งที่คุณได้จากเครื่องนี้คือคอมทั้งเครื่อง ไม่ใช่แค่สิทธิ์สตรีมเกมที่มีเพดาน 100 ชม./เดือน" +
        " — ใช้เรียน ทำงาน และขายต่อได้ นั่นคือเหตุผลที่งบระดับนี้เราแนะนำให้ประกอบ");
    } else {
      lines.push("ความคุ้ม: คืนทุนเทียบการเช่า cloud ใน " + ev.breakEven + " เดือน เร็วกว่าอายุคุ้มค่าฮาร์ดแวร์ (" +
        ev.horizon + " เดือน) หลังจากนั้นส่วนต่างราว " + fmt(ev.monthlySaving) + " บาท/เดือนคือกำไรของคุณ");
    }
    if (tier.upgrades && tier.upgrades[0]) {
      lines.push("ถ้ามีงบเพิ่มก้อนถัดไป ให้ลงที่ \u201C" + tier.upgrades[0].title + "\u201D (" +
        tier.upgrades[0].cost + " บาท) ก่อนอย่างอื่น เพราะ" + tier.upgrades[0].gain.toLowerCase());
    }
    return lines.join("\n\n");
  }

  /* live: โยนให้ backend ตัดสินใจ (โครง request พร้อมใช้) */
  async function liveExplain(usecaseKey, budget, tier, ev, model) {
    const res = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usecase: usecaseKey, budget, model, tierId: tier.id,
        verdict: ev.verdict, breakEvenMonths: ev.breakEven }),
    });
    if (!res.ok) throw new Error("backend ตอบ " + res.status);
    const data = await res.json();
    return data.data.ai_recommendation || "(backend ไม่ส่งคำอธิบายมา)";
  }

  async function explain(usecaseKey, budget, tier, ev, model) {
    if (MODE === "mock") {
      await new Promise(r => setTimeout(r, 700));      /* จำลองเวลาคิด */
      return mockExplain(usecaseKey, budget, tier, ev);
    }
    return liveExplain(usecaseKey, budget, tier, ev, model);
  }

  return { explain, MODE, MODEL_INFO };
})();

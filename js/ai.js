/* ═══ ai.js — สายงาน AI สองขั้น (pipeline ไม่ใช่ตัวเลือก)
 *
 *   [1] Gemini    วิเคราะห์ + ให้เหตุผลจากข้อมูลสเปคและตัวเลขคืนทุน → ได้ "ร่าง"
 *   [2] Pathumma  รับร่างจาก Gemini มาเรียบเรียงเป็นไทยที่อ่านลื่น  → ได้ "ฉบับส่งจริง"
 *
 * ทำไมต้องสองขั้น: Gemini เก่งเรื่องหาข้อมูลและตรรกะ แต่ภาษาไทยมักออกมาแข็ง
 * เหมือนแปลจากอังกฤษ (ประโยคยาว ทับศัพท์เกินจำเป็น "ทำการ/ดังกล่าว/ซึ่งเป็น")
 * Pathumma เทรนกับไทยโดยตรง เอามาขัดขั้นสุดท้ายได้สำนวนเป็นธรรมชาติกว่า
 *
 * ※ ห้ามเรียกโมเดลตรงจากหน้าเว็บ API key จะหลุด ต้องผ่าน backend เสมอ ═══ */

window.AI = (function () {
  /* MODE: "auto" | "mock" | "live"
     auto = เปิดผ่าน http แล้ว backend ตอบ ping → ใช้ live
            เปิดด้วยการดับเบิลคลิก (file://) หรือ backend ไม่ขึ้น → ถอยไป mock เอง
     ตั้งเป็น "mock" หรือ "live" ตรงๆ ได้ถ้าอยากบังคับ */
  const MODE = "auto";
  const API_BASE = "http://localhost:5000/api/spec";
  const BACKEND = API_BASE + "/recommend";

  let resolvedMode = MODE === "auto" ? null : MODE;   /* null = ยังไม่ได้เช็ค */

  async function mode() {
    if (resolvedMode) return resolvedMode;

    if (location.protocol === "file:") {
      resolvedMode = "mock";                          /* file:// ยิง fetch ไม่ได้อยู่แล้ว */
      return resolvedMode;
    }
    try {
      const res = await fetch(API_BASE + "/health", {
        signal: AbortSignal.timeout(2500),
      });
      resolvedMode = res.ok ? "live" : "mock";
    } catch {
      resolvedMode = "mock";
    }
    return resolvedMode;
  }

  const STAGES = {
    gemini:   { tag: "gemini-3.6-flash",                      role: "วิเคราะห์และให้เหตุผล" },
    pathumma: { tag: "pathumma-thaillm-qwen3-8b-think-3.0.0", role: "เรียบเรียงภาษาไทย" },
  };

  /* ─── ขั้น 1 (mock) — ร่างสไตล์ Gemini: ตรรกะครบ แต่สำนวนแข็ง ─── */
  function mockDraft(usecaseKey, budget, tier, ev) {
    const f = window.CLOUD.fmt;
    const job = usecaseKey === "ai" ? "AI Server"
              : usecaseKey === "home" ? "Home Server" : "Gaming PC";

    if (ev.verdict === "cloud") {
      return [
        "จากการวิเคราะห์งบประมาณจำนวน " + f(budget) + " บาท สำหรับ use case ประเภท " + job +
        " ร่วมกับ usage pattern ที่ระดับ " + ev.hours + " ชั่วโมงต่อเดือน ระบบได้ทำการประเมินแล้วพบว่า " +
        "การลงทุนใน hardware ณ ขณะนี้ยังไม่มีความคุ้มค่า",
        "ทั้งนี้ break-even point อยู่ที่ " +
        (ev.breakEven === Infinity ? "ระยะเวลาที่ไม่สามารถคำนวณได้" : ev.breakEven + " เดือน") +
        " ซึ่งเป็นระยะเวลาที่มากกว่า hardware refresh cycle ดังกล่าวที่ " + ev.horizon + " เดือน",
        "ดังนั้นจึงมีข้อเสนอแนะให้ทำการใช้บริการ " + ev.cloudLabel.split(" ×")[0] +
        " เป็นจำนวนเงิน " + f(ev.cloudMonthly) + " บาทต่อเดือนไปก่อนในเบื้องต้น",
      ].join("\n\n");
    }

    const gpu = tier.parts.find(p => p.type === "GPU") || tier.parts[0];
    const out = [
      "จากการวิเคราะห์งบประมาณจำนวน " + f(budget) + " บาท สำหรับ use case ประเภท " + job +
      " ระบบได้ทำการเลือกชุดอุปกรณ์ที่มีชื่อว่า " + tier.name +
      " ซึ่งมีมูลค่ารวมทั้งสิ้น " + f(ev.total) + " บาท",
      "โดยองค์ประกอบที่มีความสำคัญมากที่สุดคือ " + gpu.name +
      " ซึ่งเป็นอุปกรณ์ที่" + gpu.reason,
    ];
    if (ev.isGfn) {
      out.push("ในส่วนของการเปรียบเทียบกับ cloud service นั้น " + ev.cloudLabel +
        " มีค่าใช้จ่ายเป็นจำนวนเงิน " + f(ev.cloudMonthly) + " บาทต่อเดือน " +
        "ซึ่งมีราคาที่ต่ำกว่า อย่างไรก็ตาม service ดังกล่าวมีข้อจำกัดที่ 100 ชั่วโมงต่อเดือน " +
        "และไม่สามารถนำไปใช้งานในลักษณะอื่นได้");
    } else {
      out.push("ในส่วนของความคุ้มค่านั้น ระบบคำนวณ break-even point ได้ที่ " + ev.breakEven +
        " เดือน ซึ่งเป็นระยะเวลาที่น้อยกว่า hardware refresh cycle ที่ " + ev.horizon + " เดือน " +
        "โดยมีส่วนต่างเป็นจำนวนเงิน " + f(ev.monthlySaving) + " บาทต่อเดือน");
    }
    if (tier.upgrades && tier.upgrades[0]) {
      out.push("สำหรับ upgrade path ในลำดับถัดไป มีข้อเสนอแนะให้ทำการพิจารณา " +
        tier.upgrades[0].title + " เป็นจำนวนเงิน " + tier.upgrades[0].cost +
        " บาท เนื่องจาก" + tier.upgrades[0].gain);
    }
    return out.join("\n\n");
  }

  /* ─── ขั้น 2 (mock) — Pathumma ขัดสำนวน ───
     ของจริงส่งร่างเข้าโมเดลพร้อม system prompt "เรียบเรียงใหม่ ห้ามแก้ตัวเลข"
     ตรงนี้ใช้กฎแทนที่ เพื่อให้เห็นชนิดของการเปลี่ยนแปลงโดยไม่ต้องมี backend
     ※ ตั้งใจไม่แตะตัวเลขเลย — ขั้นนี้ห้ามเปลี่ยนข้อเท็จจริง */
  const POLISH = [
    [/จากการวิเคราะห์งบประมาณจำนวน /g, "งบ "],
    [/ สำหรับ use case ประเภท /g, " สำหรับงาน "],
    [/ ร่วมกับ usage pattern ที่ระดับ /g, " ที่ใช้งานราว "],
    [/ ระบบได้ทำการประเมินแล้วพบว่า /g, " ผมดูแล้วขอบอกตรงๆ ว่า"],
    [/ ระบบได้ทำการเลือกชุดอุปกรณ์ที่มีชื่อว่า /g, " ผมจัดชุด "],
    [/ ซึ่งมีมูลค่ารวมทั้งสิ้น /g, " รวม "],
    [/โดยองค์ประกอบที่มีความสำคัญมากที่สุดคือ /g, "หัวใจอยู่ที่ "],
    [/ ซึ่งเป็นอุปกรณ์ที่/g, " — "],
    [/ในส่วนของความคุ้มค่านั้น ระบบคำนวณ break-even point ได้ที่ /g, "เรื่องความคุ้ม เครื่องนี้คืนทุนใน "],
    [/ในส่วนของการเปรียบเทียบกับ cloud service นั้น /g, "ถ้าเทียบกับ cloud "],
    [/ทั้งนี้ break-even point อยู่ที่ /g, "จุดคืนทุนอยู่ที่ "],
    [/สำหรับ upgrade path ในลำดับถัดไป มีข้อเสนอแนะให้ทำการพิจารณา /g, "ถ้ามีงบก้อนถัดไป ลงที่ "],
    [/ดังนั้นจึงมีข้อเสนอแนะให้ทำการใช้บริการ /g, "แนะนำให้ใช้ "],
    [/ซึ่งเป็นระยะเวลาที่มากกว่า hardware refresh cycle ดังกล่าวที่/g, "ซึ่งนานกว่าอายุคุ้มค่าของฮาร์ดแวร์ที่"],
    [/ซึ่งเป็นระยะเวลาที่น้อยกว่า hardware refresh cycle ที่/g, "เร็วกว่าอายุคุ้มค่าฮาร์ดแวร์ที่"],
    [/ระยะเวลาที่ไม่สามารถคำนวณได้/g, "ไกลจนวัดไม่ได้"],
    [/ อย่างไรก็ตาม service ดังกล่าวมีข้อจำกัดที่ /g, " แต่มันมีเพดานแค่ "],
    [/และไม่สามารถนำไปใช้งานในลักษณะอื่นได้/g, "และเอาไปทำอย่างอื่นไม่ได้ ต่างจากคอมทั้งเครื่อง"],
    [/ซึ่งมีราคาที่ต่ำกว่า/g, "ถูกกว่าจริง"],
    [/มีค่าใช้จ่ายเป็นจำนวนเงิน /g, "อยู่ที่ "],
    [/เป็นจำนวนเงิน /g, ""],
    [/โดยมีส่วนต่าง/g, "ส่วนต่างหลังจากนั้นคือ"],
    [/ไปก่อนในเบื้องต้น/g, "ไปก่อน แล้วค่อยกลับมาดูใหม่"],
    [/ยังไม่มีความคุ้มค่า/g, "ยังไม่คุ้ม"],
    [/การลงทุนใน hardware ณ ขณะนี้/g, "ประกอบเครื่องตอนนี้"],
    [/เนื่องจาก/g, "เพราะ"],
    [/ทำการ/g, ""],
    [/ดังกล่าว/g, ""],
  ];

  function mockPolish(draft) {
    let t = draft;
    for (const [re, to] of POLISH) t = t.replace(re, to);
    return t.replace(/ {2,}/g, " ").replace(/ ,/g, ",").trim();
  }

  /* ─── กฎเพิ่มเติมสำหรับข้อความอธิบายทั่วหน้า (เหตุผลรายชิ้น/อัปเกรด/คำตัดสิน) ───
     ข้อความพวกนี้เขียนเป็นไทยอยู่แล้ว กฎจึงเน้นตัดคำฟุ่มเฟือยที่คนไทยเขียนติดมือ
     ※ ของจริง Pathumma จะเรียบเรียงใหม่ทั้งประโยค ไม่ใช่แค่แทนที่คำ */
  const POLISH_GENERAL = [
    [/สามารถ(.{1,20}?)ได้/g, "$1ได้"],
    [/มีความจำเป็น/g, "จำเป็น"],
    [/ทำให้เกิด/g, "ทำให้"],
    [/ในการที่จะ/g, "ที่จะ"],
    [/เป็นอย่างมาก/g, "มาก"],
    [/มีความ/g, ""],
    [/การทำ/g, ""],
    [/ซึ่ง/g, ""],
    [/ทั้งนี้/g, ""],
  ];

  function mockPolishGeneral(text) {
    let t = text;
    for (const [re, to] of POLISH) t = t.replace(re, to);
    for (const [re, to] of POLISH_GENERAL) t = t.replace(re, to);
    return t.replace(/ {2,}/g, " ").replace(/ ,/g, ",").trim();
  }

  /* ─── live: ส่ง context ที่คำนวณแล้วให้ backend ───
     ※ เดโมส่งข้อมูล tier ไปด้วยเพื่อไม่ต้องซ้ำ data.js สองที่
       production ควรให้ backend เป็นเจ้าของข้อมูลเอง (ตาม D1) */
  function buildPayload(usecaseKey, budget, tier, ev, polish) {
    const gpu = tier.parts.find(p => p.type === "GPU") || tier.parts[0];
    const up = (tier.upgrades && tier.upgrades[0]) || null;
    return {
      usecase: usecaseKey,
      budget,
      hours: ev.hours,
      polish,
      tier: {
        id: tier.id,
        name: tier.name,
        total: ev.total,
        topPart: { name: gpu.name, reason: gpu.reason },
        upgrade: up ? { title: up.title, cost: up.cost, gain: up.gain } : null,
      },
      cloud: {
        verdict: ev.verdict,
        label: ev.cloudLabel,
        monthly: ev.cloudMonthly,
        elec: ev.elecMonthly,
        saving: ev.monthlySaving,
        breakEven: ev.breakEven === Infinity ? null : ev.breakEven,
        horizon: ev.horizon,
        isGfn: !!ev.isGfn,
      },
    };
  }

  async function liveExplain(payload) {
    const res = await fetch(BACKEND, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || body.error || "backend ตอบ " + res.status);
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "backend ปฏิเสธคำขอ");
    return {
      draft: json.data.draft || "",
      final: json.data.ai_recommendation || "(backend ไม่ส่งคำอธิบายมา)",
      polished: !!json.data.polished,
    };
  }

  /* ─── ทางเข้าเดียว ───
     onStage(ชื่อขั้น, สถานะ) ให้ UI อัปเดตไฟสถานะระหว่างรอ
     polish=false → ข้ามขั้น Pathumma (ไว้กดเทียบว่าต่างกันแค่ไหน) */
  async function explain({ usecase, budget, tier, ev, polish = true, onStage = () => {} }) {
    if ((await mode()) === "live") {
      onStage("gemini", "running");
      const out = await liveExplain(buildPayload(usecase, budget, tier, ev, polish));
      onStage("gemini", "done");
      onStage("pathumma", out.polished ? "done" : "skipped");
      return out;
    }

    onStage("gemini", "running");
    await new Promise(r => setTimeout(r, 650));
    const draft = mockDraft(usecase, budget, tier, ev);
    onStage("gemini", "done");

    if (!polish) {
      onStage("pathumma", "skipped");
      return { draft, final: draft, polished: false };
    }

    onStage("pathumma", "running");
    await new Promise(r => setTimeout(r, 450));
    const final = mockPolish(draft);
    onStage("pathumma", "done");
    return { draft, final, polished: true };
  }

  /* ─── เรียบเรียงข้อความอธิบายทั้งหน้าเป็นชุดเดียว ───
     หน้าหนึ่งมีข้อความอธิบาย 15-18 จุด ยิงทีละจุดคือ 18 request ช้าและเปลือง
     จึงรวบส่งครั้งเดียวแล้วให้คืนกลับมาเป็น array เรียงเดิม
     ※ ถ้าจำนวนกลับมาไม่ตรง = คืนต้นฉบับทั้งชุด ดีกว่าเอาข้อความสลับที่ไปแสดง */
  async function polishTexts(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return { texts: [], polished: false };
    }

    if ((await mode()) === "mock") {
      await new Promise(r => setTimeout(r, 400));
      return { texts: texts.map(mockPolishGeneral), polished: true, live: false };
    }

    const res = await fetch(API_BASE + "/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: texts }),
    });
    if (!res.ok) throw new Error("backend ตอบ " + res.status);

    const json = await res.json();
    if (!json.success) throw new Error(json.error || "backend ปฏิเสธคำขอ");

    const out = json.data.segments;
    if (!Array.isArray(out) || out.length !== texts.length) {
      return { texts, polished: false, live: true };   /* ยาวไม่ตรง = ไม่เชื่อ คืนต้นฉบับ */
    }
    return {
      texts: out,
      polished: !!json.data.polished,
      live: true,
      okChunks: json.data.okChunks,
      totalChunks: json.data.totalChunks,
    };
  }

  return { explain, polishTexts, mode, MODE, STAGES };
})();

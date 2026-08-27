/* สคริปต์ตรวจ: จำลองการกดปุ่มจัดสเปคหนึ่งครั้ง แล้วดึงข้อความทุกจุดที่ติด data-polish
   ออกมาเทียบก่อน/หลัง ผ่าน backend จริง — ใช้ดูว่า Pathumma ไปแตะตรงไหนบ้าง */
global.window = {};
require("./js/data.js");
require("./js/cloud.js");
const D = window.SPEC_DATA, C = window.CLOUD;

const USECASE = process.argv[2] || "ai";
const BUDGET = Number(process.argv[3] || 60000);
const HOURS = Number(process.argv[4] || 150);

const tiers = D.usecases[USECASE].tiers;
let tier = tiers[0];
for (let i = tiers.length - 1; i >= 0; i--) if (BUDGET >= tiers[i].min) { tier = tiers[i]; break; }
const ev = C.evaluate(USECASE, BUDGET, tier, HOURS);
const parts = tier.parts.concat(tier.parts2 || []);

/* เก็บ segment แบบเดียวกับที่ app.js เก็บจาก DOM */
const segs = [];
const html = C.verdictHTML(USECASE, ev, tier.name);
const m = html.match(/<p data-polish>([\s\S]*?)<\/p>/);
if (m) segs.push({ where: "การ์ดคำตัดสิน", text: m[1].replace(/<[^>]+>/g, "") });

parts.forEach(p => {
  segs.push({ where: `เหตุผล · ${p.type} ${p.name}`, text: p.reason });
  if (p.upgrade) segs.push({ where: `ทางอัปเกรด · ${p.type}`, text: p.upgrade });
});
tier.upgrades.forEach(u => segs.push({ where: `อัปเกรดขั้นถัดไป · ${u.title}`, text: u.gain }));

(async () => {
  console.log(`สเปค: ${tier.name}`);
  console.log(`งบ ${BUDGET.toLocaleString()} · ${HOURS} ชม./ด. · คำตัดสิน: ${ev.verdict}`);
  console.log(`จุดที่ติดป้าย data-polish ทั้งหมด: ${segs.length} จุด\n`);

  const t = Date.now();
  const res = await fetch("http://localhost:5181/api/spec/polish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ segments: segs.map(s => s.text) }),
  });
  const j = await res.json();
  const secs = ((Date.now() - t) / 1000).toFixed(1);

  if (!j.success) { console.log("ล้มเหลว:", j.error); return; }

  let changed = 0;
  segs.forEach((s, i) => {
    const after = j.data.segments[i];
    const diff = after !== s.text;
    if (diff) changed++;
    console.log(`${diff ? "✎" : " "} [${String(i).padStart(2)}] ${s.where}`);
    if (diff) {
      console.log(`      ก่อน: ${s.text}`);
      console.log(`      หลัง: ${after}`);
    }
  });
  console.log(`\nสรุป: ${secs} วิ · polished=${j.data.polished} · เปลี่ยนจริง ${changed}/${segs.length} จุด`);
})();

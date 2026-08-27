# SpecSheet — เดโมเว็บจัดสเปคด้วย AI

เปิดใช้ได้เลย: **ดับเบิลคลิก `index.html`** (ตั้งใจไม่ใช้ build tool / ES modules เพื่อให้เปิดจาก file:// ได้ตรงๆ)

- `index.html` — หน้า SME: AI Server / Home Server
- `gaming.html` — หน้าคนทั่วไป: จัดสเปคเกม (แยกกันตามที่ตกลง)

## อะไร "จริง" อะไร "จำลอง" ในเดโมนี้

| ส่วน | สถานะ | หมายเหตุ |
|---|---|---|
| ตรรกะเลือกสเปคตามงบ/งาน | ✅ จริง | `js/app.js` → `pickTier()` |
| คำตัดสิน cloud vs ประกอบเอง | ✅ จริง | `js/cloud.js` สูตรโปร่งใส แก้ชั่วโมงใช้งานแล้วคำนวณใหม่ได้ |
| ราคา cloud ที่ใช้อ้างอิง | ✅ จริง | RunPod/Vast.ai/GeForce NOW/Google One ตรวจ ส.ค. 2026 มีลิงก์ในหน้าเว็บ |
| ผังเครื่อง 2D สเกลจาก มม. | ✅ จริง | `js/viz.js` — แนวเดียวกับ D9 (กล่อง parametric จาก dimensions_mm) |
| ลิงก์ร้าน JIB / Advice / BNN | ⚠️ กึ่งจริง | เป็นลิงก์ "ค้นหา" ชื่อสินค้าในเว็บร้าน ไม่ใช่ลิงก์สินค้าตรง |
| ราคา/สเปคอุปกรณ์ | 🔶 จำลอง | ตัวเลขประมาณจากตลาด ส.ค. 2026 — ของจริงต้องมาจาก Supabase (ตาม D1) |
| ข้อความ "เหตุผลจาก AI" | 🔶 จำลอง | `js/ai.js` MODE="mock" เรียบเรียงจากข้อมูล tier ในเครื่อง |
| Gemini / Pathumma | ⏳ จุดต่อพร้อม | ดูหัวข้อถัดไป |

หลักที่ยึดตาม vault: **AI ไม่ใช่แหล่งข้อมูลสเปค** ตัวเลขทุกตัวมาจาก data + สูตร
AI มีหน้าที่เรียบเรียงเหตุผลเท่านั้น (D1, D10) — ต่อโมเดลจริงแล้วคำตัดสินก็ไม่เปลี่ยน

## วิธีต่อ Gemini + Pathumma ของจริง

หน้าเว็บ **ห้าม** เรียก Gemini ตรง (API key จะโชว์ใน DevTools ให้ทั้งโลก)
ต้องผ่าน backend Express ตัวเดิมใน `Project-test` — เพิ่ม endpoint ใหม่ตามแพทเทิร์นที่มีอยู่แล้ว:

1. `src/services/spec.service.ts` — รับ `{ usecase, budget, tierId, verdict, breakEvenMonths }`
   ประกอบ prompt (system instruction แบบเดียวกับ `hardware.service.ts` + แท็กกันฉีด)
   แล้วเรียกโมเดลตาม `model`:
   - `gemini` → `ai.models.generateContent` (`@google/genai` ที่มีอยู่แล้ว)
   - `pathumma` → เรียก ThaiLLM API ผ่าน fetch/OpenAI-compatible client
2. `src/routes/spec.route.ts` — validate แบบ `parseRecommendInput` แล้วคืน
   `{ success, data: { ai_recommendation } }`
3. `app.ts` — `app.use("/api/spec", specRoutes)` (อย่าลืม CORS: หน้าเว็บเปิดจาก file://
   ให้ตั้ง `CORS_ORIGIN=*` ตอน dev)
4. ฝั่งเว็บ: แก้ `js/ai.js` บรรทัดเดียว `MODE = "live"`

> ⚠️ **Pathumma:** endpoint จริงของ ThaiLLM API ยังเป็น Open Question ใน vault
> (`03 - Open Questions`) — ยังไม่รู้ URL/รูปแบบ request จนกว่าจะขอ access จาก thaillm.or.th
> ระหว่างนี้ปุ่ม Pathumma ในเดโมใช้ตัวเรียบเรียงจำลองตัวเดียวกับ Gemini

## โครงข้อมูล (js/data.js)

ทุก tier = `{ min, max, watt, kase, cloud, parts[], perf[], temps[], upgrades[] }`
ทุกชิ้นมี `dims` หน่วยมิลลิเมตร → `viz.js` เอาไปวาดผังตามสเกลจริง
ย้ายขึ้น production คือแปลงโครงนี้เป็นตาราง Supabase แล้วให้ backend เป็นคน `pickTier`

## จุดที่ตั้งใจให้ไปอ่านในโค้ด

- `cloud.js` — สูตรคืนทุน + เหตุผลที่ GeForce NOW ไม่ถูกตัดสินด้วยเลขรายเดือนอย่างเดียว
- `viz.js` `draw()` — layout 3 แบบ (mini PC / NAS / tower) จาก dims เดียวกัน
- `app.js` `renderAI()` — กัน race ตอนสลับโมเดลด้วย `aiSeq`
- `ai.js` — เส้นแบ่ง mock/live อยู่ที่ฟังก์ชันเดียว สลับได้โดยไม่แตะ UI

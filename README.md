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
| ข้อความ "เหตุผลจาก AI" | 🔶 จำลอง | `js/ai.js` MODE="mock" — จำลองทั้งสองขั้นในเครื่อง |
| Gemini → Pathumma | ✅ พร้อมต่อ | endpoint จริงเขียนเสร็จแล้วใน `Project-test` ดูหัวข้อถัดไป |

## สายงาน AI สองขั้น

```
Gemini  ──→  Pathumma  ──→  ผู้ใช้
วิเคราะห์      ขัดสำนวนไทย
```

Gemini เก่งตรรกะแต่ภาษาไทยออกมาแข็งเหมือนแปลจากอังกฤษ
Pathumma เทรนกับไทยโดยตรง เอามาขัดขั้นสุดท้าย

ปุ่ม **Pathumma** บนแถบบนกดปิดได้ เพื่อดูร่างดิบจาก Gemini
และปุ่ม **ดูร่างก่อนเรียบเรียง** ในการ์ด AI กางเทียบสองเวอร์ชันได้

> ขั้นเรียบเรียง**ห้ามแตะตัวเลข** system prompt สั่งไว้ชัด และ mock ก็ตั้งใจไม่แตะเช่นกัน

หลักที่ยึดตาม vault: **AI ไม่ใช่แหล่งข้อมูลสเปค** ตัวเลขทุกตัวมาจาก data + สูตร
AI มีหน้าที่เรียบเรียงเหตุผลเท่านั้น (D1, D10) — ต่อโมเดลจริงแล้วคำตัดสินก็ไม่เปลี่ยน

## วิธีต่อ Gemini + Pathumma ของจริง

หน้าเว็บ **ห้าม** เรียกโมเดลตรง (API key จะโชว์ใน DevTools ให้ทั้งโลก)
ทุกอย่างผ่าน backend `Project-test` ซึ่ง**เขียนเสร็จแล้ว** ที่
`Desktop\Work\Project-test`

ไฟล์ที่เพิ่ม/แก้ไปแล้ว
- `src/config/pathumma.ts` (ใหม่) — เรียก ThaiLLM แบบ OpenAI-compatible + ตัด `<think>` ทิ้ง
- `src/services/spec.service.ts` (ใหม่) — สายงานสองขั้น
- `src/routes/spec.route.ts` (ใหม่) — validate + ตอบ HTTP
- `src/config/env.ts` — เพิ่ม `PATHUMMA_*` (เป็น**ตัวเลือก** ขาดคีย์ก็ไม่พัง)
- `src/app.ts` — `app.use("/api/spec", specRoutes)`

### เปิดใช้จริง 3 ขั้น

**1. ใส่คีย์ใน `Project-test/.env`**

```bash
PATHUMMA_BASE_URL=http://thaillm.or.th/api/v1
PATHUMMA_API_KEY=คีย์จริงของคุณ
```

**2. เปิดสองเทอร์มินัล**

```cmd
cd Desktop\Work\Project-test
npm run dev                      → localhost:5000

cd Desktop\pc-spec-demo
npx serve                        → localhost:3000
```

**3. แก้ `js/ai.js` บรรทัดเดียว** `MODE = "live"`

> ⚠️ **อย่าดับเบิลคลิก `index.html` ตอนใช้โหมด live** — ไฟล์ที่เปิดจาก `file://`
> มี origin เป็น `null` เบราว์เซอร์จะบล็อกด้วย CORS ต้องเสิร์ฟผ่าน http เท่านั้น

### สัญญา API

```
POST /api/spec/recommend
{ usecase, budget, hours, polish, tier:{...}, cloud:{...} }

→ { success, data: { draft, ai_recommendation, polished } }
```

`draft` = ร่างจาก Gemini · `ai_recommendation` = ฉบับหลัง Pathumma ขัด
ถ้า Pathumma ล่มหรือไม่ได้ตั้งคีย์ จะได้ `polished: false` และทั้งสองฟิลด์เป็นข้อความเดียวกัน
(ตาม **D16** ชั้นเสริมล้มต้องไม่ล้มทั้ง request)

## โครงข้อมูล (js/data.js)

ทุก tier = `{ min, max, watt, kase, cloud, parts[], perf[], temps[], upgrades[] }`
ทุกชิ้นมี `dims` หน่วยมิลลิเมตร → `viz.js` เอาไปวาดผังตามสเกลจริง
ย้ายขึ้น production คือแปลงโครงนี้เป็นตาราง Supabase แล้วให้ backend เป็นคน `pickTier`

## จุดที่ตั้งใจให้ไปอ่านในโค้ด

- `cloud.js` — สูตรคืนทุน + เหตุผลที่ GeForce NOW ไม่ถูกตัดสินด้วยเลขรายเดือนอย่างเดียว
- `viz.js` `draw()` — layout 3 แบบ (mini PC / NAS / tower) จาก dims เดียวกัน
- `app.js` `renderAI()` — กัน race ตอนสลับโมเดลด้วย `aiSeq`
- `ai.js` — เส้นแบ่ง mock/live อยู่ที่ฟังก์ชันเดียว สลับได้โดยไม่แตะ UI

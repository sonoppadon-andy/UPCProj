Project use Google Sheet to store data  follow instruction
# วิธีเชื่อมแอปกับ Google Sheets

ไฟล์ที่ใช้:
- `index-google-sheets.html` — หน้าเว็บที่แก้ไขแล้ว
- `Code.gs` — Backend บน Google Apps Script

## 1. สร้าง Google Sheet
สร้าง Google Sheet ใหม่ แล้วคัดลอก Sheet ID จาก URL:

`https://docs.google.com/spreadsheets/d/SHEET_ID/edit`

## 2. ตั้งค่า Apps Script
1. เปิด Google Sheet แล้วเลือก **Extensions > Apps Script**
2. วางโค้ดจาก `Code.gs`
3. แก้ `SPREADSHEET_ID`
4. ตั้ง Project timezone เป็น `Asia/Bangkok`
5. รันฟังก์ชัน `setupSheets()` หนึ่งครั้ง และอนุญาตสิทธิ์

ระบบจะสร้างชีต:
- `Runs`
- `Passwords`
- `Teams`

และสร้างโฟลเดอร์ Google Drive สำหรับรูปหลักฐาน

## 3. Deploy เป็น Web App
1. เลือก **Deploy > New deployment**
2. Type: **Web app**
3. Execute as: **Me**
4. Who has access:
   - `Anyone` สำหรับเว็บที่ไม่บังคับล็อกอิน Google
   - หรือเฉพาะองค์กร หากผู้ใช้ทุกคนอยู่ใน Google Workspace เดียวกัน
5. กด Deploy และคัดลอก URL ที่ลงท้ายด้วย `/exec`

## 4. ตั้งค่า URL ในหน้าเว็บ
เปิด `index-google-sheets.html` แล้วแก้:

```javascript
const GOOGLE_SCRIPT_URL = "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
```

เป็น URL `/exec` ที่ได้จากขั้นตอน Deploy

## 5. นำหน้าเว็บขึ้น Hosting
ไม่ควรเปิดด้วย `file://` ในบางเบราว์เซอร์ แนะนำให้นำขึ้น HTTPS hosting เช่น GitHub Pages, Firebase Hosting, Cloudflare Pages หรือเว็บเซิร์ฟเวอร์ของบริษัท

## หมายเหตุด้านความปลอดภัย
- รหัสสมาชิกและรหัส Admin ในตัวอย่างยังเป็น plain text จึงเหมาะกับกิจกรรมภายในที่ความเสี่ยงต่ำเท่านั้น
- ผู้ใช้ที่เปิด Developer Tools สามารถเห็น `ADMIN_PASSWORD` ในไฟล์ HTML
- สำหรับใช้งานจริง ควรย้ายการตรวจสอบ Admin และรหัสสมาชิกไปฝั่ง Apps Script และเก็บ password hash แทน plain text
- การแชร์รูป `Anyone with the link` อาจถูกนโยบาย Google Workspace ขององค์กรบล็อก

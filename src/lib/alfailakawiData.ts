/**
 * سجل مستأجري عمارتَي محمود الفيلكاوي — مستورد من قاعدتَي بيانات المكتب (Microsoft Access)
 * «عمارة حولي/برنامج عقار.accdb» و«عمارة المنقف/برنامج عقار.accdb»، تاريخ الاستيراد 2026-09-17.
 *
 * لم تُغيّر أي قيمة جوهرية. التنظيف اقتصر على:
 *  - توحيد أسماء الأدوار (الارضى/الأرضي، الربع/الرابع، الثانى/الثاني، السردب/السرداب).
 *  - حولي: نسبة الوحدة إلى دورها من أول رقمها، فصحّح ذلك الشقة 505 التي كانت مسجّلة في الرابع.
 *  - المنقف: ثلاث شقق لكل دور (1–3 الأول … 16–18 السادس)، والمحل والملحقان في الأرضي.
 *  - توحيد كتابة الجنسيات (هندى ← هندي، مصر ى ← مصري، الأردن ← أردني…).
 *  - «كى نت» في خانة طريقة الدفع ← كي نت.
 */

export interface OfficeRecord {
  seq: number;          // التسلسل في سجل المكتب
  floor: string;        // اسم الدور
  unit: string;         // رقم الوحدة
  kind: "apartment" | "shop" | "storage";
  name: string;         // اسم المستأجر
  civilId: string;      // الرقم المدني أو رقم الجواز
  nationality: string;
  job: string;          // المهنة / جهة العمل
  phone: string;
  rent: number;         // الإيجار الشهري بالدينار الكويتي
  start: string;        // تاريخ بداية العقد (YYYY-MM-DD)
  end: string;          // تاريخ الانتهاء المسجّل
  signed: string;       // تاريخ تحرير العقد
  pay: "cash" | "knet";
  /** ملاحظة مراجعة تظهر بالأحمر على الوحدة */
  note?: string;
}

export interface BuildingSpec {
  id: string;
  name: string;
  code: string;
  area: string;
  block: string;
  street: string;
  parcel: string;
  color: string;
  notes: string;
  /** الأدوار ووحداتها بالترتيب */
  floors: { level: number; name: string; units: { number: string; kind: "apartment" | "shop" | "storage" }[] }[];
  records: OfficeRecord[];
}

export const OWNER_NAME = "محمود محمود عبدالمجيد الفيلكاوي";

const apts = (from: number, to: number, pad = 0) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ number: String(from + i).padStart(pad, "0"), kind: "apartment" as const }));

/* ================================ عمارة حولي ================================ */

export const HAWALLY_RECORDS: OfficeRecord[] = [
  {seq: 208, floor: "الأرضي", unit: "001", kind: "apartment", name: "هارون الرشيد ابيز الدين", civilId: "279031604027", nationality: "بنغلاديشي", job: "فراش", phone: "66985345", rent: 180, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-17", pay: "cash"},
  {seq: 207, floor: "الأرضي", unit: "002", kind: "apartment", name: "اسلام جبريل احمد محمد", civilId: "299082502192", nationality: "مصري", job: "مراسل", phone: "50554660", rent: 160, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-17", pay: "cash"},
  {seq: 112, floor: "الأرضي", unit: "003", kind: "apartment", name: "هشام محمد أبو حمدان", civilId: "", nationality: "", job: "", phone: "", rent: 130, start: "", end: "", signed: "", pay: "cash"},
  {seq: 209, floor: "الأرضي", unit: "004", kind: "apartment", name: "عماد شوقى ضيف طانيوس", civilId: "294022302567", nationality: "مصري", job: "سائق سيارة خصوصى", phone: "96911815", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-18", pay: "cash"},
  {seq: 114, floor: "الأرضي", unit: "005", kind: "apartment", name: "بالا نيبانا ثيروجنانا سامبا ندام", civilId: "", nationality: "", job: "", phone: "", rent: 125, start: "", end: "", signed: "", pay: "cash"},
  {seq: 168, floor: "الأرضي", unit: "006", kind: "apartment", name: "مدحت عادل فهيم فريج", civilId: "283111406452", nationality: "مصري", job: "بائع اثاث", phone: "66409323", rent: 130, start: "2025-12-01", end: "2026-11-30", signed: "2025-11-18", pay: "cash"},
  {seq: 210, floor: "الأرضي", unit: "007", kind: "apartment", name: "عمر حسين عبدالحميد حسين", civilId: "287110803825", nationality: "مصري", job: "مندوب مشتريات", phone: "65998308", rent: 180, start: "2026-08-01", end: "2026-07-31", signed: "2026-07-18", pay: "cash"},
  {seq: 201, floor: "الأرضي", unit: "008", kind: "apartment", name: "احمد عبدالعزيز محمد حسب النبى", civilId: "290012503535", nationality: "مصري", job: "باحث قانونى", phone: "60695167", rent: 160, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-15", pay: "cash"},
  {seq: 55, floor: "الأول", unit: "101", kind: "apartment", name: "محمد مختار السيد احمد", civilId: "", nationality: "مصري", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 127, floor: "الأول", unit: "102", kind: "apartment", name: "مينا رفعت عزيز ابسخرون", civilId: "290090104441", nationality: "مصري", job: "مراسل", phone: "96649438", rent: 150, start: "2025-01-09", end: "2026-08-31", signed: "2025-08-15", pay: "cash"},
  {seq: 57, floor: "الأول", unit: "103", kind: "apartment", name: "طارق عادل نجاح على صالح", civilId: "", nationality: "مصري", job: "", phone: "", rent: 180, start: "", end: "", signed: "", pay: "cash"},
  {seq: 149, floor: "الأول", unit: "104", kind: "apartment", name: "احمد شريف محمد مرسى", civilId: "291110101331", nationality: "مصري", job: "كاتب ملفات", phone: "98935671", rent: 160, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-15", pay: "cash"},
  {seq: 180, floor: "الأول", unit: "105", kind: "apartment", name: "لين فواز احمد", civilId: "303080602041", nationality: "لبناني", job: "بائع هدايات عام", phone: "98815201", rent: 130, start: "2026-02-01", end: "2027-01-31", signed: "2026-01-30", pay: "cash"},
  {seq: 60, floor: "الأول", unit: "106", kind: "apartment", name: "موحو حاماد هو اجباره موحمدهو", civilId: "", nationality: "", job: "", phone: "", rent: 130, start: "", end: "", signed: "", pay: "cash"},
  {seq: 126, floor: "الثاني", unit: "201", kind: "apartment", name: "العربى وفا محمد مصطفى شرشير", civilId: "296111903152", nationality: "مصري", job: "جلارتو روزا الايسكريم والبوظه", phone: "94049783", rent: 150, start: "2025-08-01", end: "2026-07-31", signed: "2025-08-15", pay: "cash"},
  {seq: 205, floor: "الثاني", unit: "202", kind: "apartment", name: "اليكس بابشان", civilId: "293021105612", nationality: "هندي", job: "مساعد كهربائى", phone: "60954736", rent: 150, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-16", pay: "cash"},
  {seq: 219, floor: "الثاني", unit: "203", kind: "apartment", name: "تبين ثوماس راجى", civilId: "298041003691", nationality: "هندي", job: "ممارس مبتدئ", phone: "96039949", rent: 180, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-18", pay: "cash"},
  {seq: 64, floor: "الثاني", unit: "204", kind: "apartment", name: "عمروعلى طه احمد", civilId: "", nationality: "مصري", job: "", phone: "", rent: 160, start: "", end: "", signed: "", pay: "cash"},
  {seq: 65, floor: "الثاني", unit: "205", kind: "apartment", name: "اجيش جورج", civilId: "", nationality: "هندي", job: "", phone: "", rent: 120, start: "", end: "", signed: "", pay: "cash"},
  {seq: 66, floor: "الثاني", unit: "206", kind: "apartment", name: "جوبى راشيل حوس جوزيف", civilId: "", nationality: "هندي", job: "", phone: "", rent: 125, start: "", end: "", signed: "", pay: "cash"},
  {seq: 190, floor: "الثاني", unit: "207", kind: "apartment", name: "محمد مسرور رازا", civilId: "285021009583", nationality: "هندي", job: "فنى مختبرات", phone: "55265260", rent: 130, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-14", pay: "cash"},
  {seq: 68, floor: "الثاني", unit: "208", kind: "apartment", name: "هارى كريشنا كودرو متهاربراكاش", civilId: "", nationality: "هندي", job: "", phone: "", rent: 130, start: "", end: "", signed: "", pay: "cash"},
  {seq: 176, floor: "الثاني", unit: "209", kind: "apartment", name: "خالد عبدالرحيم احمد محمد", civilId: "296062303838", nationality: "مصري", job: "باحث قانونى", phone: "55042324", rent: 160, start: "2026-02-01", end: "2027-01-31", signed: "2026-01-15", pay: "cash"},
  {seq: 70, floor: "الثاني", unit: "210", kind: "apartment", name: "هادى احمد محمد مصطفى", civilId: "", nationality: "مصري", job: "صراف عملات", phone: "", rent: 180, start: "", end: "", signed: "", pay: "cash"},
  {seq: 182, floor: "الثاني", unit: "211", kind: "apartment", name: "ابانوب يوسف القس اسحق مقار", civilId: "294093004065", nationality: "مصري", job: "بائع عطور", phone: "66396156", rent: 150, start: "2026-03-01", end: "2027-02-28", signed: "2026-02-18", pay: "cash"},
  {seq: 72, floor: "الثاني", unit: "212", kind: "apartment", name: "محمد عبدالحميد أبو الوفا على", civilId: "", nationality: "مصري", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 73, floor: "الثالث", unit: "301", kind: "apartment", name: "محمد حسنى سيد احمد", civilId: "", nationality: "", job: "", phone: "", rent: 140, start: "", end: "", signed: "", pay: "cash"},
  {seq: 74, floor: "الثالث", unit: "302", kind: "apartment", name: "نمر صايل نمر أبو عليان", civilId: "", nationality: "", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 75, floor: "الثالث", unit: "303", kind: "apartment", name: "محمود سعيد عبد العزيز مصطفى", civilId: "", nationality: "", job: "", phone: "", rent: 180, start: "", end: "", signed: "", pay: "cash"},
  {seq: 159, floor: "الثالث", unit: "304", kind: "apartment", name: "زهير طالب محمود سندس", civilId: "292101606199", nationality: "أردني", job: "سكرتير", phone: "66073541", rent: 160, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-27", pay: "cash"},
  {seq: 216, floor: "الثالث", unit: "305", kind: "apartment", name: "المكى ادم محمد ادم", civilId: "292011010797", nationality: "سوداني", job: "مراقب قوالب خرسانة", phone: "65960916", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-29", pay: "cash"},
  {seq: 144, floor: "الثالث", unit: "306", kind: "apartment", name: "حسام حسين حسن ابازيد", civilId: "291032901834", nationality: "مصري", job: "طباع اول", phone: "94057288", rent: 130, start: "2025-10-01", end: "2026-09-30", signed: "2025-09-23", pay: "cash"},
  {seq: 213, floor: "الثالث", unit: "307", kind: "apartment", name: "نير انجالا نيد هاشانى راسيا", civilId: "294042901647", nationality: "سريلانكي", job: "حلاق مصفف شعر نسانى", phone: "55932081", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-24", pay: "cash"},
  {seq: 217, floor: "الثالث", unit: "308", kind: "apartment", name: "السيد جمال عبد الرحيم محمد", civilId: "287121003065", nationality: "مصري", job: "عامل مخازن", phone: "66781780", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-29", pay: "cash"},
  {seq: 80, floor: "الثالث", unit: "309", kind: "apartment", name: "حسن محمد على جمعه", civilId: "", nationality: "مصري", job: "", phone: "", rent: 160, start: "", end: "", signed: "", pay: "cash"},
  {seq: 211, floor: "الثالث", unit: "310", kind: "apartment", name: "رمضان جمال تمام عبدالرحمن", civilId: "283102010325", nationality: "مصري", job: "نجار مبانى", phone: "55877763", rent: 180, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-20", pay: "cash"},
  {seq: 82, floor: "الثالث", unit: "311", kind: "apartment", name: "عماد عباس يوسف شريف", civilId: "", nationality: "مصري", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 83, floor: "الثالث", unit: "312", kind: "apartment", name: "محمد رائد محمد ناصر", civilId: "", nationality: "مصري", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 154, floor: "الرابع", unit: "401", kind: "apartment", name: "تالا طاهر الصمد", civilId: "297071507749", nationality: "لبناني", job: "بائع هدايا عام", phone: "92296279", rent: 150, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-16", pay: "cash"},
  {seq: 150, floor: "الرابع", unit: "402", kind: "apartment", name: "بيتيلهيم جيتا شيو مامو", civilId: "285052904783", nationality: "إثيوبي", job: "طباخ تمور", phone: "50362115", rent: 150, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-15", pay: "cash"},
  {seq: 156, floor: "الرابع", unit: "403", kind: "apartment", name: "سيد امير سيد احمد", civilId: "298020302166", nationality: "هندي", job: "كاشير", phone: "55754252", rent: 180, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-18", pay: "cash"},
  {seq: 151, floor: "الرابع", unit: "404", kind: "apartment", name: "سنيه الحجرى", civilId: "273052107946", nationality: "تونسي", job: "كاتب ادخال بيانات", phone: "60403204", rent: 160, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-15", pay: "cash"},
  {seq: 152, floor: "الرابع", unit: "405", kind: "apartment", name: "ساره عثمان عطوه محمد فرحات", civilId: "296101403488", nationality: "مصري", job: "كاتب استقبال", phone: "51022092", rent: 130, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-15", pay: "cash"},
  {seq: 153, floor: "الرابع", unit: "406", kind: "apartment", name: "محمد عبدالمنعم احمد على", civilId: "285010130003", nationality: "مصري", job: "مدرس لغات", phone: "94454954", rent: 130, start: "2025-11-01", end: "2026-10-31", signed: "2025-10-16", pay: "cash"},
  {seq: 164, floor: "الرابع", unit: "407", kind: "apartment", name: "سمير فتحى عبدالفتاح حسن", civilId: "291010120156", nationality: "مصري", job: "مهندس مدنى", phone: "60629412", rent: 130, start: "2025-11-01", end: "2026-10-31", signed: "2025-11-03", pay: "cash"},
  {seq: 212, floor: "الرابع", unit: "408", kind: "apartment", name: "اسلام إبراهيم عبدالرحيم محمد", civilId: "293110802815", nationality: "مصري", job: "سائق سيارة خصوصى", phone: "99610029", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-21", pay: "cash"},
  {seq: 197, floor: "الرابع", unit: "409", kind: "apartment", name: "احمد حسن عباس محمد", civilId: "277080505528", nationality: "مصري", job: "رئيس قسم", phone: "99829382", rent: 160, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-22", pay: "cash"},
  {seq: 166, floor: "الرابع", unit: "410", kind: "apartment", name: "محمد عبدالتواب نجيب احمد", civilId: "293100111551", nationality: "مصري", job: "مطور نظم المعلومات", phone: "50472184", rent: 180, start: "2025-11-01", end: "2026-10-31", signed: "2025-11-03", pay: "cash"},
  {seq: 218, floor: "الرابع", unit: "411", kind: "apartment", name: "علاء الدين محمد احمد محمد", civilId: "289100206567", nationality: "مصري", job: "مهندس مدنى", phone: "69975547", rent: 150, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-17", pay: "cash"},
  {seq: 161, floor: "الرابع", unit: "412", kind: "apartment", name: "احمد عبدالله حسن احمد رمضان", civilId: "295010194751", nationality: "مصري", job: "مهندس ميكانيك عام", phone: "67640558", rent: 150, start: "2025-11-01", end: "2026-10-31", signed: "2025-11-02", pay: "cash"},
  {seq: 198, floor: "الخامس", unit: "501", kind: "apartment", name: "عمر إبراهيم حسن إبراهيم", civilId: "292021603174", nationality: "مصري", job: "باحث قانونى", phone: "98595361", rent: 150, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-30", pay: "knet"},
  {seq: 188, floor: "الخامس", unit: "502", kind: "apartment", name: "شهين احمد نلداث", civilId: "298030202986", nationality: "هندي", job: "مراقب ادارى", phone: "66348746", rent: 150, start: "2026-05-01", end: "2027-04-30", signed: "2026-04-05", pay: "cash"},
  {seq: 186, floor: "الخامس", unit: "503", kind: "apartment", name: "اجينا كامالا ما", civilId: "290030112589", nationality: "هندي", job: "ممرض اختصاصى", phone: "69609295", rent: 180, start: "2026-04-01", end: "2027-03-31", signed: "2026-03-23", pay: "cash"},
  {seq: 189, floor: "الخامس", unit: "504", kind: "apartment", name: "صالح على صالح على حسن", civilId: "285011006346", nationality: "مصري", job: "مندوب الهينه العامة المكافحة الفساد", phone: "65070058", rent: 160, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-08", pay: "cash"},
  {seq: 172, floor: "الخامس", unit: "505", kind: "apartment", name: "فارمان احمد", civilId: "293011606333", nationality: "هندي", job: "فنى وزارة الصحة", phone: "65132367", rent: 130, start: "2026-01-01", end: "2026-12-31", signed: "2026-06-17", pay: "cash"},
  {seq: 203, floor: "الخامس", unit: "506", kind: "apartment", name: "عبدالفتاح محمود عبدالعاطى حسين النجار", civilId: "280042501961", nationality: "مصري", job: "مخلص معاملات", phone: "55220700", rent: 130, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-16", pay: "cash"},
  {seq: 170, floor: "الخامس", unit: "507", kind: "apartment", name: "الجيلى عبدالوهاب يوسف احمد", civilId: "289010119857", nationality: "سوداني", job: "سائق سياره خصوصى", phone: "96785016", rent: 130, start: "2025-12-01", end: "2026-11-30", signed: "2025-11-26", pay: "cash"},
  {seq: 187, floor: "الخامس", unit: "508", kind: "apartment", name: "مجدى عبدالسلام عبدالله زكارنه", civilId: "299061403275", nationality: "أردني", job: "منهدس", phone: "66996749", rent: 130, start: "2026-04-01", end: "2027-03-31", signed: "2026-03-27", pay: "cash"},
  {seq: 145, floor: "الخامس", unit: "509", kind: "apartment", name: "ارشاد شمس الدين صاحب", civilId: "284073102646", nationality: "هندي", job: "كاتب", phone: "65846611", rent: 150, start: "2025-10-01", end: "2026-09-30", signed: "2025-09-25", pay: "cash"},
  {seq: 87, floor: "الخامس", unit: "510", kind: "apartment", name: "امل بابو بابو", civilId: "", nationality: "", job: "", phone: "", rent: 180, start: "", end: "", signed: "", pay: "cash"},
  {seq: 88, floor: "الخامس", unit: "511", kind: "apartment", name: "احمد السيد محمد عوض", civilId: "", nationality: "", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 89, floor: "الخامس", unit: "512", kind: "apartment", name: "جمال افندى شمس الدين", civilId: "", nationality: "", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 90, floor: "السادس", unit: "601", kind: "apartment", name: "لين كميل شلالا", civilId: "", nationality: "", job: "", phone: "", rent: 150, start: "", end: "", signed: "", pay: "cash"},
  {seq: 215, floor: "السادس", unit: "602", kind: "apartment", name: "وليد عبدالحكيم زكى سالم", civilId: "272110101354", nationality: "مصري", job: "مدخل بيانات", phone: "95539800", rent: 150, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-25", pay: "cash"},
  {seq: 191, floor: "السادس", unit: "603", kind: "apartment", name: "براءه رياض عبدالطلالعه", civilId: "292050309644", nationality: "أردني", job: "مشرفة حضانه", phone: "60434417", rent: 180, start: "2026-06-01", end: "2027-05-31", signed: "2026-05-14", pay: "cash"},
  {seq: 196, floor: "السادس", unit: "604", kind: "apartment", name: "محمد مصطفى ابوالعنين السيد", civilId: "282041104306", nationality: "مصري", job: "سائق شاحنة", phone: "65530993", rent: 160, start: "2026-07-01", end: "2027-06-30", signed: "2026-06-20", pay: "cash"},
  {seq: 94, floor: "السادس", unit: "605", kind: "apartment", name: "رضا محمد مصطفى أبو شعيشع", civilId: "296010174851", nationality: "مصري", job: "مندوب مبعات", phone: "", rent: 130, start: "2025-01-06", end: "2026-05-31", signed: "", pay: "cash"},
  {seq: 185, floor: "السادس", unit: "606", kind: "apartment", name: "ناصر الانجاثو تو تودى", civilId: "277052008794", nationality: "هندي", job: "سائق اجرة", phone: "51183914", rent: 130, start: "2026-04-01", end: "2027-03-31", signed: "2026-03-15", pay: "cash"},
  {seq: 179, floor: "السادس", unit: "607", kind: "apartment", name: "ميناء سمير ابواليامين ناروز", civilId: "290100504562", nationality: "مصري", job: "مندوب مشتريات", phone: "51265985", rent: 130, start: "2026-02-01", end: "2026-01-31", signed: "2026-01-28", pay: "cash"},
  {seq: 96, floor: "السادس", unit: "608", kind: "apartment", name: "محمد ناصر عبداللاه محمد", civilId: "", nationality: "مصري", job: "", phone: "", rent: 130, start: "", end: "", signed: "", pay: "cash"},
  {seq: 130, floor: "السادس", unit: "609", kind: "apartment", name: "مروه محمد إبراهيم بكرى", civilId: "298060104324", nationality: "مصري", job: "كاتب ادارى /عام", phone: "98743778", rent: 160, start: "2025-09-01", end: "2025-08-31", signed: "2025-08-17", pay: "cash"},
  {seq: 132, floor: "السادس", unit: "610", kind: "apartment", name: "اجيت ديفاكاران", civilId: "290090807323", nationality: "هندي", job: "نادل طعام", phone: "66918315", rent: 170, start: "2025-08-01", end: "2026-07-31", signed: "2025-08-20", pay: "cash"},
  {seq: 99, floor: "السادس", unit: "611", kind: "apartment", name: "احمد نصر حماده موسى", civilId: "", nationality: "سوداني", job: "", phone: "", rent: 150, start: "2025-01-05", end: "2026-04-30", signed: "", pay: "cash"},
  {seq: 100, floor: "السادس", unit: "612", kind: "apartment", name: "محمد احمد شاكر مدنى", civilId: "292032703234", nationality: "مصري", job: "شركه كيوايت فوتوجالير", phone: "51748047", rent: 150, start: "2025-11-01", end: "2026-10-31", signed: "", pay: "cash"},
  {seq: 101, floor: "السابع", unit: "701", kind: "apartment", name: "عبد الحكيم لقمان جبارة", civilId: "", nationality: "", job: "", phone: "", rent: 160, start: "", end: "", signed: "", pay: "cash"},
  {seq: 221, floor: "السابع", unit: "702", kind: "apartment", name: "شامير احمد محمد سيد مسعود", civilId: "297050504338", nationality: "هندي", job: "فنى تصوير", phone: "51405721", rent: 180, start: "2026-10-01", end: "2027-09-30", signed: "2026-09-16", pay: "cash"},
  {seq: 123, floor: "السابع", unit: "703", kind: "apartment", name: "محمد حماده محمد محمود", civilId: "289040111573", nationality: "مصري", job: "كاتب استقبال فندقى", phone: "67068383", rent: 180, start: "2025-01-08", end: "2026-07-31", signed: "2025-07-18", pay: "cash"},
  {seq: 135, floor: "السابع", unit: "705", kind: "apartment", name: "حسين فياس احمد شريف", civilId: "295072703398", nationality: "هندي", job: "فنى الكترونى", phone: "97191664", rent: 130, start: "2025-09-01", end: "2026-08-31", signed: "2025-08-25", pay: "cash"},
  {seq: 220, floor: "السابع", unit: "706", kind: "apartment", name: "روميل طلعت فهيم جورجى", civilId: "283032206305", nationality: "مصري", job: "سائق سيارة", phone: "51393894", rent: 130, start: "2026-09-01", end: "2027-08-31", signed: "2026-08-20", pay: "cash"},
  {seq: 204, floor: "السابع", unit: "707", kind: "apartment", name: "هيثم رومانى نبيه رزق", civilId: "297010135128", nationality: "مصري", job: "حداد المنيوم", phone: "98792310", rent: 140, start: "2026-08-01", end: "2027-07-31", signed: "2026-07-16", pay: "cash"},
  {seq: 120, floor: "السابع", unit: "708", kind: "apartment", name: "حسام عوض عبدالله رمضان", civilId: "289030403935", nationality: "مصري", job: "عامل مخازن", phone: "", rent: 180, start: "2025-07-01", end: "2026-06-30", signed: "2025-07-01", pay: "cash"},
  {seq: 108, floor: "السابع", unit: "709", kind: "apartment", name: "ايمن هشام امين منصور", civilId: "", nationality: "أردني", job: "", phone: "", rent: 180, start: "", end: "", signed: "", pay: "cash"},
  {seq: 157, floor: "السابع", unit: "710", kind: "apartment", name: "وهيب فلحون", civilId: "", nationality: "مغربي", job: "", phone: "96735985", rent: 160, start: "", end: "", signed: "2025-10-27", pay: "cash"},
  {seq: 54, floor: "السرداب", unit: "السرداب", kind: "storage", name: "خالد محى الدين قطاش", civilId: "", nationality: "", job: "", phone: "", rent: 700, start: "", end: "", signed: "", pay: "cash"},
  {seq: 53, floor: "الأرضي", unit: "المحل", kind: "shop", name: "جمعه رضا جمعه عباس", civilId: "", nationality: "", job: "", phone: "", rent: 640, start: "", end: "", signed: "", pay: "knet"},
];

/* =============================== عمارة المنقف =============================== */

export const MANGAF_RECORDS: OfficeRecord[] = [
  {seq: 49, floor: "الأول", unit: "1", kind: "apartment", name: "اسامه مصطفى اسعد", civilId: "", nationality: "أردني", job: "", phone: "66516232", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "knet"},
  {seq: 51, floor: "الأول", unit: "2", kind: "apartment", name: "ا نيمو سوندار يسان", civilId: "273052007793", nationality: "هندي", job: "سائق شاحنه", phone: "55372024", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 50, floor: "الأول", unit: "3", kind: "apartment", name: "جاتيش كومار ماديباتى", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash", note: "مسجّل في سجل المكتب على الشقة 2 مع مستأجر آخر، ونُسب مؤقتًا إلى الشقة 3 التي لا مستأجر لها — يرجى التأكد من رقم الشقة"},
  {seq: 52, floor: "الثاني", unit: "4", kind: "apartment", name: "بارفيز احمد شيخ", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 53, floor: "الثاني", unit: "5", kind: "apartment", name: "ريجيمون برهام برهام", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 54, floor: "الثاني", unit: "6", kind: "apartment", name: "كاسيف فالى سيد", civilId: "", nationality: "هندي", job: "", phone: "51334786", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 55, floor: "الثالث", unit: "7", kind: "apartment", name: "سوماتا راجو كافيلا", civilId: "", nationality: "هندي", job: "", phone: "96002601", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 56, floor: "الثالث", unit: "8", kind: "apartment", name: "سريرام راجابا", civilId: "", nationality: "هندي", job: "", phone: "", rent: 180, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 57, floor: "الثالث", unit: "9", kind: "apartment", name: "نارايانا سريكومار", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 58, floor: "الرابع", unit: "10", kind: "apartment", name: "سبيى اراكال", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 59, floor: "الرابع", unit: "11", kind: "apartment", name: "بابو ويلسون ويلسون", civilId: "", nationality: "هندي", job: "", phone: "", rent: 190, start: "2023-08-01", end: "2024-07-31", signed: "2025-08-26", pay: "cash"},
  {seq: 60, floor: "الرابع", unit: "12", kind: "apartment", name: "ماتو ثوماس ثوماس", civilId: "", nationality: "هندي", job: "", phone: "", rent: 190, start: "2024-03-01", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 71, floor: "الخامس", unit: "13", kind: "apartment", name: "راميش كريشنان كوتى ناير جوبالابيلاى", civilId: "274100902317", nationality: "هندي", job: "الكترونى صيانه احهزة حاسوب", phone: "", rent: 200, start: "2025-10-01", end: "2026-09-30", signed: "2025-11-11", pay: "cash"},
  {seq: 62, floor: "الخامس", unit: "14", kind: "apartment", name: "شفقت سليم محمد", civilId: "", nationality: "باكستاني", job: "", phone: "90982671", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 63, floor: "الخامس", unit: "15", kind: "apartment", name: "اجيت كيسافا بيلاى", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 75, floor: "السادس", unit: "16", kind: "apartment", name: "نيمى سوبها رانى كارلوس", civilId: "T8208807", nationality: "هندي", job: "بائع بذور واسمدة زراعية", phone: "", rent: 200, start: "2026-05-01", end: "2027-04-30", signed: "2026-04-26", pay: "cash"},
  {seq: 73, floor: "السادس", unit: "17", kind: "apartment", name: "محمد صابر شرف الدين", civilId: "", nationality: "هندي", job: "", phone: "", rent: 200, start: "2026-01-01", end: "2026-12-31", signed: "2025-12-28", pay: "cash"},
  {seq: 66, floor: "السادس", unit: "18", kind: "apartment", name: "ناصر سلامه حسين", civilId: "", nationality: "أردني", job: "", phone: "", rent: 200, start: "", end: "", signed: "2025-08-26", pay: "cash"},
  {seq: 70, floor: "الأرضي", unit: "المحل", kind: "shop", name: "مشعل هزاع عايض الرشيدى", civilId: "284092101024", nationality: "كويتي", job: "", phone: "", rent: 450, start: "2025-05-01", end: "", signed: "2025-08-27", pay: "cash"},
  {seq: 74, floor: "الأرضي", unit: "ملحق 1", kind: "apartment", name: "امين الله نينا محمد", civilId: "274040803367", nationality: "هندي", job: "ادارى قواعد بيانات", phone: "", rent: 180, start: "2026-01-01", end: "2026-12-31", signed: "2026-01-09", pay: "cash"},
  {seq: 72, floor: "الأرضي", unit: "ملحق 2", kind: "apartment", name: "شهناز موكاتى كاندى احمد كويا", civilId: "279020506683", nationality: "هندي", job: "سائق سيارة خصوصى", phone: "", rent: 190, start: "2025-11-01", end: "2026-10-31", signed: "2025-11-11", pay: "cash"},
];

/** بيانات العقارين كما وردت في نموذج العقد (rent1.docm) لكل عمارة. */
export const BUILDINGS: BuildingSpec[] = [
  {
    id: "b-hawally",
    name: "عمارة حولي",
    code: "HWL",
    area: "حولي",
    block: "قطعة 10",
    street: "شارع 210",
    parcel: "قسيمة 20/79",
    color: "#1d4ed8",
    notes: "سرداب، ومحل وثماني شقق في الأرضي، ثم سبعة أدوار سكنية.",
    floors: [
      { level: -1, name: "السرداب", units: [{ number: "السرداب", kind: "storage" }] },
      { level: 0, name: "الأرضي", units: [...apts(1, 8, 3), { number: "المحل", kind: "shop" }] },
      { level: 1, name: "الأول", units: apts(101, 106) },
      { level: 2, name: "الثاني", units: apts(201, 212) },
      { level: 3, name: "الثالث", units: apts(301, 312) },
      { level: 4, name: "الرابع", units: apts(401, 412) },
      { level: 5, name: "الخامس", units: apts(501, 512) },
      { level: 6, name: "السادس", units: apts(601, 612) },
      { level: 7, name: "السابع", units: apts(701, 710) },
    ],
    records: HAWALLY_RECORDS,
  },
  {
    id: "b-mangaf",
    name: "عمارة المنقف",
    code: "MNF",
    area: "المنقف",
    block: "قطعة 4",
    street: "شارع 25",
    parcel: "قسيمة 159",
    color: "#0369a1",
    notes: "محل وملحقان في الأرضي، وثلاث شقق في كل دور من الأول إلى السادس.",
    floors: [
      {
        level: 0, name: "الأرضي",
        units: [{ number: "المحل", kind: "shop" }, { number: "ملحق 1", kind: "apartment" }, { number: "ملحق 2", kind: "apartment" }],
      },
      { level: 1, name: "الأول", units: apts(1, 3) },
      { level: 2, name: "الثاني", units: apts(4, 6) },
      { level: 3, name: "الثالث", units: apts(7, 9) },
      { level: 4, name: "الرابع", units: apts(10, 12) },
      { level: 5, name: "الخامس", units: apts(13, 15) },
      { level: 6, name: "السادس", units: apts(16, 18) },
    ],
    records: MANGAF_RECORDS,
  },
];

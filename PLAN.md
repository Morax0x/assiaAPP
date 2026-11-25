# خطة التنفيذ — تطبيق إدارة مكتب الخدمات والمعاملات

## 1. هيكل المجلدات (Modular)

```
src/
  app/
    (auth)/login/
    (app)/                       # layout: Sidebar (desktop) + BottomNav (mobile) + Topbar
      dashboard/ clients/[id]/ transactions/[id]/ treasury/ alerts/ settings/{general,roles,reminders,templates,users,audit}/
    share/[token]/               # عام بدون تسجيل دخول، يقرأ بالخادم فقط
    api/{share,files/signed-url,import,export,invoice/[id]}/
  modules/                       # كل وحدة: components/ actions.ts (server) queries.ts schema.ts (zod)
    auth/ clients/ documents/ alerts/ transactions/ treasury/ share/ import-export/ settings/ audit/
  components/{ui (shadcn), layout, data-table, status-badge, file-dropzone, command-palette}/
  lib/{supabase/{server,client,admin}.ts, permissions.ts, money.ts, dates.ts, whatsapp.ts, image-compress.ts}
  styles/tokens.css              # ألوان/خطوط/نصف أقطار
public/{manifest.webmanifest, icons/, sw.js}
supabase/migrations/0001_schema.sql
```

قواعد: كل الكتابة عبر Server Actions + Zod؛ العمليات المالية عبر دوال RPC فقط؛ التحقق من الصلاحية يتم في قاعدة البيانات (RLS) وليس في الواجهة فقط.

## 2. قرارات تصميم قاعدة البيانات (مهمة للموافقة)

- **مكتب واحد (Single-tenant)**: بدون `office_id`. إن أردت لاحقاً خدمة أكثر من مكتب نضيفه الآن بدل لاحقاً.
- **دفتر حركات واحد `ledger_entries`**: الأرصدة تُحسب منه (`account_balances`) فلا يوجد رصيد مخزن قابل للتلاعب. لا حذف للحركات المالية، فقط إلغاء (`voided_at`).
- **التحويلات الداخلية**: سطران مرتبطان بـ `transfer_id` من نوع `transfer`، ويُستثنيان من الإيراد والمصروف في التقارير.
- **فصل المالية**: `govt_fees` (تكلفة) و`office_fee` (ربح المكتب) و`discount`، والإجمالي عمود محسوب. الربح الصافي = الدفعات المستلمة − الرسوم الحكومية المدفوعة − المصاريف.
- **حالة الدفع مشتقة** (`transaction_payment_summary`) وليست عموداً يدوياً، فلا تتعارض مع الدفعات.
- **إصدارات المستندات**: `group_id` مشترك + `is_current`؛ دالة `renew_document` تؤرشف القديم وتنشئ الجديد في خطوة واحدة.
- **الصلاحيات**: جدول `role_permissions` قابل للتعديل من الإعدادات، والمالك دائماً مسموح. إخفاء الأرصدة/الأرباح عن الموظف يتم عبر RLS على `ledger_entries` ودوال التقارير.
- **الموظف وتسجيل الدفعات**: لا يقرأ الدفتر، لذلك يسجل الدفعة عبر `record_client_payment` (SECURITY DEFINER) ويرى المدفوع/المتبقي فقط.
- **المشاركة الخارجية**: لا سياسات وصول للزائر نهائياً. صفحة `/share/[token]` تعمل بمفتاح الخدمة على الخادم، تتحقق من الصلاحية والـ PIN (مع قفل بعد 5 محاولات)، تعرض المستندات المحددة فقط، وتولّد Signed URL قصيرة العمر. التوكن يُخزن مجزّأً (SHA-256).
- **سجل النشاط**: تريغرات على الجداول الحساسة، والجدول للقراءة فقط عبر API.
- **التخزين**: Bucket خاص `vault`، الرفع من المتصفح بصلاحية، والتنزيل/المعاينة عبر Signed URL يولدها الخادم فقط.

## 3. المراحل

| # | المرحلة | المخرجات |
|---|---|---|
| 0 | الأساس | Next.js + TS + Tailwind + shadcn، tokens، خط IBM Plex Sans Arabic، RTL، Sidebar/BottomNav/Topbar، Command Palette (هيكل)، PWA (manifest + service worker + أيقونات)، تشغيل ملف SQL |
| 1 | المصادقة والإعدادات | تسجيل الدخول، middleware، `permissions.ts`، إدارة المستخدمين والأدوار، إعدادات المكتب والتذكير وقوالب الخدمات |
| 2 | العملاء والمستندات والتنبيهات | ملف العميل، رفع متعدد/سحب وإفلات/كاميرا + ضغط الصور، معاينة PDF/صور، مركز التنبيهات، Snooze، تجديد بإصدار، واتساب، تحويل لمعاملة تجديد |
| 3 | المعاملات والخزينة | جدول TanStack بالفلاتر، نموذج المعاملة بالقوالب، الدفعات، المستحقات، الحسابات، المصاريف بصورة، التحويلات، الجرد، لوحة التحكم والرسم |
| 4 | المشاركة والتصدير | روابط مشاركة بصلاحية/PIN/إلغاء، استيراد/تصدير Excel، فاتورة وإيصال PDF، سجل النشاط، تدقيق نهائي (أداء، وصول، اختبار الهاتف) |

## 4. التصميم (التزام بالقواعد)

خلفية `#F8FAFC`، أسطح `#FFFFFF`، حدود `#E2E8F0` بسمك 1px، نص `#0F172A`، لون تمييز واحد: **أزرق كحلي `#1E3A5F`** (أو زمردي داكن إن فضلت). أيقونات Lucide بسمك 1.5. بلا تدرجات أو إيموجي أو ظلال ثقيلة. أرقام `tabular-nums`. خصائص منطقية (`ps/pe/ms/me`). الجداول تتحول إلى بطاقات تحت 768px.

## 5. نقاط تحتاج قرارك

1. العملة الافتراضية (مفترض درهم إماراتي AED) وهل تحتاج ضريبة قيمة مضافة على الفواتير؟
2. التنبيهات: داخل التطبيق فقط الآن (جرس + صفحة)، أم تضيف Web Push على الهاتف لاحقاً؟ (iOS يتطلب تثبيت PWA أولاً)
3. لون التمييز: أزرق كحلي أم زمردي؟
4. هل ستنشر على Vercel؟ (يؤثر على Cron لتحديث التنبيهات اليومية)

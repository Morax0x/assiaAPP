export const PERMISSIONS = [
  { key: "clients.write", label: "إضافة وتعديل العملاء", hint: "يضيف عملاء جدداً (أفراد، شركات، كفلاء) ويعدّل بياناتهم ويضيف موظفين لملف الشركة" },
  { key: "clients.delete", label: "حذف العملاء", hint: "يحذف عميلاً (يُنقل إلى سلة المحذوفات ويمكن استرجاعه)" },
  { key: "txn.write", label: "إضافة وتعديل المعاملات", hint: "ينشئ المعاملات والفواتير وعروض الأسعار، ويسجل الدفعات، ويغيّر مراحل المعاملة" },
  { key: "txn.delete", label: "حذف المعاملات", hint: "يحذف المعاملات وعروض الأسعار" },
  { key: "docs.write", label: "رفع وتعديل المستندات", hint: "يرفع المستندات (وجماعياً من مجلد) ويعدّلها وينقلها بين العملاء ويجددها" },
  { key: "docs.delete", label: "حذف المستندات", hint: "يحذف المستندات" },
  { key: "docs.open", label: "فتح وتحميل ملفات المستندات", hint: "يعاين الملفات ويحمّلها. بدونها يرى أسماء المستندات فقط ولا يفتح محتواها" },
  { key: "docs.move", label: "نقل المستندات بين العملاء", hint: "ينقل مستنداً أو مجلداً من عميل أو شركة أو موظف إلى آخر" },
  { key: "docs.import", label: "رفع مجلدات كاملة دفعة واحدة", hint: "يستعمل «رفع مجلد كامل» لاستيراد الأرشيف بترتيبه" },
  { key: "invoices.write", label: "إصدار الفواتير وعروض الأسعار", hint: "ينشئ الفواتير وعروض الأسعار ويطبعها (يحتاج أيضاً إضافة المعاملات)" },
  { key: "txn.fees", label: "رؤية الرسوم الحكومية ورسوم المكتب", hint: "يرى تفصيل المعاملة: الرسوم الحكومية ورسوم المكتب. بدونها يرى المجموع فقط" },
  { key: "receivables.view", label: "رؤية المبالغ المتبقية على العملاء", hint: "يفتح صفحة المبالغ غير المسددة" },
  { key: "data.export", label: "تصدير Excel", hint: "يحمّل جداول المعاملات والعملاء والمستحقات" },
  { key: "data.import", label: "استيراد المعاملات من Excel", hint: "يرفع ملف Excel لإضافة معاملات دفعة واحدة" },
  { key: "services.manage", label: "تعديل الخدمات والأسعار", hint: "يضيف الخدمات ويغيّر أسعارها" },
  { key: "treasury.view", label: "رؤية رصيد الكاش والبطاقة", hint: "يرى رصيد الكاش والبطاقة وحركات الخزينة وكشوف الحساب" },
  { key: "treasury.write", label: "إدارة الخزينة (مصاريف، تحويلات، جرد)", hint: "يسجل المصاريف والتحويلات والجرد ورسوم الجهات الحكومية، ويلغي الحركات" },
  { key: "reports.view", label: "تقارير الأرباح والمصاريف", hint: "يرى تقارير الأرباح والمصاريف وأعمار الديون" },
  { key: "share.create", label: "إنشاء روابط المشاركة", hint: "ينشئ روابط مشاركة خارجية لمستندات العملاء ويلغيها" },
  { key: "settings.manage", label: "إدارة الإعدادات", hint: "يغيّر بيانات المكتب والخدمات والأسعار والحسابات ومواعيد التذكير" },
  { key: "users.manage", label: "إدارة الموظفين", hint: "يضيف المستخدمين ويعدّل بياناتهم وصلاحياتهم ويوقفهم ويحذفهم" },
  { key: "audit.view", label: "سجل النشاط", hint: "يرى سجل النشاط: من فعل ماذا ومتى" },
] as const;

export type PermKey = (typeof PERMISSIONS)[number]["key"];

export const ROLE_LABEL: Record<string, string> = {
  owner: "صاحب العمل",
  admin: "مدير المكتب",
  staff: "موظف",
};

export const CLIENT_KIND_LABEL: Record<string, string> = { individual: "فرد", company: "شركة", sponsor: "كفيل" };
export const CLIENT_KIND_PLURAL: Record<string, string> = { individual: "أفراد", company: "شركات", sponsor: "كفلاء" };

export const TXN_STATUS_LABEL: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد الإجراء",
  awaiting_docs: "بانتظار مستندات",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const PAY_STATUS_LABEL: Record<string, string> = {
  paid: "مدفوعة بالكامل",
  partial: "مدفوعة جزئياً",
  unpaid: "غير مدفوعة",
};

export const METHOD_LABEL: Record<string, string> = {
  cash: "كاش",
  bank_card: "بطاقة المكتب",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك",
};

export const LEDGER_KIND_LABEL: Record<string, string> = {
  client_payment: "دفعة عميل",
  govt_fee: "رسوم حكومية",
  expense: "مصروف",
  transfer: "تحويل داخلي",
  adjustment: "تسوية جرد",
};

export const BUCKET_LABEL: Record<string, string> = {
  expired: "منتهي",
  critical: "ينتهي قريباً",
  upcoming: "قادم",
  valid: "ساري",
};

export const FOLLOWUP_LABEL: Record<string, string> = {
  pending: "لم يتم المتابعة",
  client_notified: "تم إبلاغ العميل",
  renewal_started: "بدأ التجديد",
  snoozed: "مؤجل",
  done: "منجز",
};

/** Starting points when adding a person. You can then tick or untick any permission one by one. */
export const PERMISSION_PRESETS = {
  staff: { label: "موظف عادي", hint: "العملاء والمعاملات والمستندات والمشاركة", keys: ["clients.write", "txn.write", "docs.write", "share.create"] },
  manager: { label: "صلاحيات واسعة", hint: "كل شيء تقريباً بما فيه الخزينة والتقارير والمستخدمين", keys: PERMISSIONS.map((p) => p.key) },
  viewer: { label: "عرض فقط", hint: "يرى فقط ولا يضيف ولا يعدّل", keys: [] as string[] },
} as const;

/** Short names used in one-line summaries of what a person can do. */
export const PERMISSION_SHORT: Record<string, string> = {
  "clients.write": "العملاء", "txn.write": "المعاملات والفواتير", "docs.write": "المستندات", "share.create": "المشاركة",
  "treasury.view": "رؤية الخزينة", "treasury.write": "تسجيل المصاريف", "reports.view": "التقارير", "settings.manage": "الإعدادات",
  "users.manage": "إدارة المستخدمين", "audit.view": "سجل النشاط", "clients.delete": "حذف العملاء", "txn.delete": "حذف المعاملات", "docs.delete": "حذف المستندات",
  "docs.open": "فتح الملفات", "docs.move": "نقل المستندات", "docs.import": "رفع المجلدات", "invoices.write": "الفواتير وعروض الأسعار", "txn.fees": "رؤية الرسوم", "receivables.view": "المستحقات", "data.export": "التصدير", "data.import": "الاستيراد", "services.manage": "الخدمات والأسعار",
};

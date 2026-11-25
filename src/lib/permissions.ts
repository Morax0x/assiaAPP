export const PERMISSIONS = [
  { key: "clients.write", label: "إضافة وتعديل العملاء" },
  { key: "clients.delete", label: "حذف العملاء" },
  { key: "txn.write", label: "إضافة وتعديل المعاملات" },
  { key: "txn.delete", label: "حذف المعاملات" },
  { key: "docs.write", label: "رفع وتعديل المستندات" },
  { key: "docs.delete", label: "حذف المستندات" },
  { key: "treasury.view", label: "رؤية رصيد الكاش والبطاقة" },
  { key: "treasury.write", label: "إدارة الخزينة (مصاريف، تحويلات، جرد)" },
  { key: "reports.view", label: "تقارير الأرباح والمصاريف" },
  { key: "share.create", label: "إنشاء روابط المشاركة" },
  { key: "settings.manage", label: "إدارة الإعدادات" },
  { key: "users.manage", label: "إدارة الموظفين" },
  { key: "audit.view", label: "سجل النشاط" },
] as const;

export type PermKey = (typeof PERMISSIONS)[number]["key"];

export const ROLE_LABEL: Record<string, string> = {
  owner: "صاحب العمل",
  admin: "مدير المكتب",
  staff: "موظف",
};

export const TXN_STATUS_LABEL: Record<string, string> = {
  new: "جديدة",
  in_progress: "قيد الإجراء",
  awaiting_docs: "بانتظار مستندات",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

export const PAY_STATUS_LABEL: Record<string, string> = {
  paid: "مدفوعة",
  partial: "مدفوعة جزئياً",
  unpaid: "غير مدفوعة",
};

export const METHOD_LABEL: Record<string, string> = {
  cash: "كاش",
  bank_card: "بطاقة المكتب",
  bank_transfer: "تحويل بنكي",
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

"use client";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/form";

export function StatementAccountSelect({ accounts, account, from, to }: { accounts: { id: string; name: string }[]; account: string; from: string; to: string }) {
  const router = useRouter();
  return (
    <Select
      value={account} className="mb-3 w-full sm:w-64" aria-label="الحساب"
      onChange={(e) => router.push(`/treasury/statement?account=${e.target.value}&from=${from}&to=${to}`)}
    >
      {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
    </Select>
  );
}

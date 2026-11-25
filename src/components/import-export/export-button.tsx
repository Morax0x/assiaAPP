import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExportButton({ type, label }: { type: "transactions" | "receivables" | "clients" | "ledger" | "report" | "backup"; label: string }) {
  return (
    <Button asChild variant="outline">
      <a href={`/api/export?type=${type}`} download><Download /> {label}</a>
    </Button>
  );
}

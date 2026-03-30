// StatusBadge - kept for compatibility
import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-900/40 text-gray-300 border-gray-600",
  Submitted: "bg-blue-900/40 text-blue-300 border-blue-700",
  PendingApproval: "bg-amber-900/40 text-amber-300 border-amber-700",
  ReturnedForCorrection: "bg-rose-900/40 text-rose-300 border-rose-700",
  Completed: "bg-green-900/40 text-green-300 border-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  PendingApproval: "Pending Approval",
  ReturnedForCorrection: "Returned for Correction",
};

export default function StatusBadge({ status }: Props) {
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_STYLES[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

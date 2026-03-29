// StatusBadge - kept for compatibility
import { Badge } from "@/components/ui/badge";

interface Props {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "bg-gray-900/40 text-gray-300 border-gray-600",
  Submitted: "bg-blue-900/40 text-blue-300 border-blue-700",
  Reviewed: "bg-purple-900/40 text-purple-300 border-purple-700",
  PendingReReview: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
  Completed: "bg-green-900/40 text-green-300 border-green-700",
};

export default function StatusBadge({ status }: Props) {
  return (
    <Badge
      variant="outline"
      className={`text-xs ${STATUS_STYLES[status] ?? ""}`}
    >
      {status === "PendingReReview" ? "Pending Re-Review" : status}
    </Badge>
  );
}

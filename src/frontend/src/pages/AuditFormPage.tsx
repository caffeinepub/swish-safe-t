import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, ClipboardList } from "lucide-react";
import AppHeader from "../components/AppHeader";
import type { Session } from "../lib/session";

interface Props {
  session: Session;
  auditId: string;
  onBack: () => void;
}

export default function AuditFormPage({ session, auditId, onBack }: Props) {
  return (
    <div className="min-h-screen bg-[#111c18]">
      <AppHeader
        session={session}
        onNavigate={(p) => {
          if (p.name === "dashboard") onBack();
        }}
      />
      <main className="max-w-3xl mx-auto px-4 py-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-gray-400 hover:text-white gap-1 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Card className="bg-[#1a2420] border-[#3a4f44]">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[#6aab7e]" />
              Audit Form
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 text-sm">Audit ID: {auditId}</p>
            <p className="text-gray-500 text-sm mt-2">
              Full audit form with auto-save and validation coming soon.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

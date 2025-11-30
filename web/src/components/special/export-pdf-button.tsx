import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportPDFButtonProps {
  className?: string;
}

export function ExportPDFButton({ className }: ExportPDFButtonProps) {
  return (
    <Button variant="secondary" size="sm" className={cn(className)}>
      <FileDown className="h-4 w-4 mr-2" />
      Export PDF
    </Button>
  );
}

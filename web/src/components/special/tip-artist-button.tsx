import * as React from "react";
import { Button } from "@/components/ui/button";

interface TipArtistButtonProps {
  className?: string;
}

export function TipArtistButton({ className }: TipArtistButtonProps) {
  return (
    <Button variant="primary" className={className}>
      Tip Artist
    </Button>
  );
}

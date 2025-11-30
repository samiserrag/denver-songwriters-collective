"use client";

import Link from "next/link";
import type { StudioService } from "@/types";
import { Button } from "@/components/ui";

interface ServiceCardProps {
  service: StudioService;
  studioId: string;
}

export function ServiceCard({ service, studioId }: ServiceCardProps) {
  return (
    <div className="card-base p-6">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-white">{service.name}</h3>
        <span className="text-gold-400 font-medium">${service.price}</span>
      </div>
      <p className="text-neutral-400 text-sm mb-2">{service.duration}</p>
      {service.description && (
        <p className="text-neutral-500 text-sm mb-4">{service.description}</p>
      )}
      <Link href={`/studios/${studioId}/book/${service.id}`}>
        <Button variant="primary" size="sm" className="w-full mt-4">
          Book Now
        </Button>
      </Link>
    </div>
  );
}

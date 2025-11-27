"use client";

import type { StudioService } from "@/types";

interface ServiceCardProps {
  service: StudioService;
}

export function ServiceCard({ service }: ServiceCardProps) {
  return (
    <div className="bg-neutral-900 rounded-lg p-6">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-lg font-semibold text-white">{service.name}</h3>
        <span className="text-gold-400 font-medium">${service.price}</span>
      </div>
      <p className="text-neutral-400 text-sm mb-2">{service.duration}</p>
      {service.description && (
        <p className="text-neutral-500 text-sm">{service.description}</p>
      )}
    </div>
  );
}

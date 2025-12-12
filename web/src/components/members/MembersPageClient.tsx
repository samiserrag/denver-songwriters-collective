"use client";

import * as React from "react";
import type { Member, MemberRole } from "@/types";
import { MemberFilters } from "./MemberFilters";
import { MembersGrid } from "./MembersGrid";

interface MembersPageClientProps {
  members: Member[];
  initialRole?: MemberRole;
}

export function MembersPageClient({ members, initialRole }: MembersPageClientProps) {
  const [filteredMembers, setFilteredMembers] = React.useState<Member[]>(members);

  return (
    <div className="space-y-8">
      <MemberFilters
        members={members}
        onFilteredMembersChange={setFilteredMembers}
        initialRole={initialRole}
      />
      <div className="text-sm text-[var(--color-warm-gray)]">
        Showing {filteredMembers.length} of {members.length} members
      </div>
      <MembersGrid members={filteredMembers} />
    </div>
  );
}

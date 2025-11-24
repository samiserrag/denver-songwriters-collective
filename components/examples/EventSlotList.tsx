/**
 * Example component: Event Slot List
 * Displays available open mic slots with claim/unclaim functionality
 */
'use client';

import { useState, useEffect } from 'react';
import { useClaimSlot, useUnclaimSlot, useAvailableSlots } from '@/hooks/useOpenMicSlots';
import { supabase } from '@/lib/supabase/client';
import { formatTimeString } from '@/lib/utils/datetime';
import type { EventSlot } from '@/lib/supabase/types';

interface EventSlotListProps {
  eventId: string;
  autoRefresh?: boolean;
}

/**
 * Display all available slots for an event with claim/unclaim actions
 *
 * @example
 * ```tsx
 * <EventSlotList eventId="event-uuid" autoRefresh={true} />
 * ```
 */
export function EventSlotList({ eventId, autoRefresh = false }: EventSlotListProps) {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { slots, isLoading, error, refetch } = useAvailableSlots(eventId, autoRefresh);
  const { claimSlot, isLoading: isClaiming, error: claimError } = useClaimSlot();
  const { unclaimSlot, isLoading: isUnclaiming, error: unclaimError } = useUnclaimSlot();

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  const handleClaim = async (slotId: string) => {
    const result = await claimSlot(slotId);
    if (result) {
      // Refresh the list after successful claim
      await refetch();
    }
  };

  const handleUnclaim = async (slotId: string) => {
    const result = await unclaimSlot(slotId);
    if (result) {
      // Refresh the list after successful unclaim
      await refetch();
    }
  };

  const isSlotOwnedByUser = (slot: EventSlot) => {
    return currentUserId && slot.performer_id === currentUserId;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-3 text-gray-600">Loading slots...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 font-medium">Error loading slots</p>
        <p className="text-red-600 text-sm mt-1">{error.message}</p>
        <button
          onClick={() => refetch()}
          className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded-md text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">No available slots for this event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Available Slots</h3>
        <button
          onClick={() => refetch()}
          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          aria-label="Refresh slots"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error Messages */}
      {claimError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{claimError.message}</p>
        </div>
      )}

      {unclaimError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-800 text-sm">{unclaimError.message}</p>
        </div>
      )}

      {/* Slot List */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {slots.map((slot) => {
          const isOwned = isSlotOwnedByUser(slot);
          const isAvailable = !slot.performer_id;

          return (
            <div
              key={slot.id}
              className={`border rounded-lg p-4 transition-all ${
                isOwned
                  ? 'border-green-300 bg-green-50'
                  : isAvailable
                  ? 'border-gray-200 bg-white hover:border-gray-300'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Slot #{slot.slot_index}
                  </span>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formatTimeString(slot.start_time)} - {formatTimeString(slot.end_time)}
                  </p>
                </div>

                {isOwned && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Your Slot
                  </span>
                )}
              </div>

              {!currentUserId ? (
                <p className="text-sm text-gray-500 mt-3">Sign in to claim slots</p>
              ) : isOwned ? (
                <button
                  onClick={() => handleUnclaim(slot.id)}
                  disabled={isUnclaiming}
                  className="w-full mt-3 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUnclaiming ? 'Unclaiming...' : 'Unclaim Slot'}
                </button>
              ) : isAvailable ? (
                <button
                  onClick={() => handleClaim(slot.id)}
                  disabled={isClaiming}
                  className="w-full mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClaiming ? 'Claiming...' : 'Claim Slot'}
                </button>
              ) : (
                <div className="mt-3 px-4 py-2 bg-gray-100 text-gray-500 rounded-md text-sm text-center">
                  Already Claimed
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

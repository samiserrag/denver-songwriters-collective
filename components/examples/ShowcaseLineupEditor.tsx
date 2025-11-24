/**
 * Example component: Showcase Lineup Editor
 * Admin/Host interface for managing showcase event lineups
 */
'use client';

import { useState, useEffect } from 'react';
import { useSetLineup, getLineupValidationErrors } from '@/hooks/useShowcaseLineup';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/lib/supabase/types';

interface ShowcaseLineupEditorProps {
  eventId: string;
  eventName: string;
  availablePerformers: Profile[];
  currentLineup?: Profile[];
  onSuccess?: () => void;
}

/**
 * Editor for setting showcase event lineup (admin/host only)
 *
 * @example
 * ```tsx
 * <ShowcaseLineupEditor
 *   eventId="event-uuid"
 *   eventName="Summer Showcase"
 *   availablePerformers={performers}
 *   onSuccess={() => console.log('Lineup updated!')}
 * />
 * ```
 */
export function ShowcaseLineupEditor({
  eventId,
  eventName,
  availablePerformers,
  currentLineup = [],
  onSuccess,
}: ShowcaseLineupEditorProps) {
  const [selectedPerformerIds, setSelectedPerformerIds] = useState<string[]>(
    currentLineup.map((p) => p.id)
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);

  const { setLineup, isLoading, error, data, isUnauthorized, reset } = useSetLineup({
    onSuccess: () => {
      if (onSuccess) {
        onSuccess();
      }
    },
  });

  // Get current user's role
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        // Fetch user's role from profiles table
        supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single()
          .then(({ data: profile }) => {
            setUserRole(profile?.role || null);
          });
      }
    });
  }, []);

  const handleAddPerformer = (performerId: string) => {
    if (!selectedPerformerIds.includes(performerId)) {
      const newLineup = [...selectedPerformerIds, performerId];
      setSelectedPerformerIds(newLineup);
      setValidationErrors(getLineupValidationErrors(newLineup));
    }
  };

  const handleRemovePerformer = (performerId: string) => {
    const newLineup = selectedPerformerIds.filter((id) => id !== performerId);
    setSelectedPerformerIds(newLineup);
    setValidationErrors(getLineupValidationErrors(newLineup));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newLineup = [...selectedPerformerIds];
    [newLineup[index - 1], newLineup[index]] = [newLineup[index], newLineup[index - 1]];
    setSelectedPerformerIds(newLineup);
  };

  const handleMoveDown = (index: number) => {
    if (index === selectedPerformerIds.length - 1) return;
    const newLineup = [...selectedPerformerIds];
    [newLineup[index], newLineup[index + 1]] = [newLineup[index + 1], newLineup[index]];
    setSelectedPerformerIds(newLineup);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = getLineupValidationErrors(selectedPerformerIds);
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    await setLineup(eventId, selectedPerformerIds);
  };

  const handleReset = () => {
    reset();
    setSelectedPerformerIds(currentLineup.map((p) => p.id));
    setValidationErrors([]);
  };

  const getPerformerById = (id: string) => {
    return availablePerformers.find((p) => p.id === id);
  };

  const availableToAdd = availablePerformers.filter(
    (p) => !selectedPerformerIds.includes(p.id)
  );

  // Authorization check
  if (userRole && !['admin', 'host'].includes(userRole)) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-800 font-medium">Access Denied</p>
        <p className="text-red-600 text-sm mt-1">
          You must be an admin or event host to manage lineups.
        </p>
      </div>
    );
  }

  // Success state
  if (data && !error) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="ml-3 flex-1">
            <h3 className="text-green-800 font-medium">Lineup Updated!</h3>
            <p className="text-green-700 text-sm mt-1">
              The showcase lineup for "{eventName}" has been successfully updated with {data.length} slots.
            </p>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-md text-sm font-medium transition-colors"
            >
              Edit Lineup Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Edit Showcase Lineup</h3>
        <p className="text-sm text-gray-600 mb-6">Event: {eventName}</p>

        {/* Unauthorized Error */}
        {isUnauthorized && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm font-medium">Unauthorized</p>
            <p className="text-red-700 text-sm mt-1">
              You do not have permission to manage this event's lineup.
            </p>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-yellow-800 text-sm font-medium">Validation Errors:</p>
            <ul className="list-disc list-inside text-yellow-700 text-sm mt-1 space-y-1">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* General Error */}
        {error && !isUnauthorized && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm">{error.message}</p>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Current Lineup */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Current Lineup ({selectedPerformerIds.length} performers)
            </h4>
            {selectedPerformerIds.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No performers added yet</p>
            ) : (
              <div className="space-y-2">
                {selectedPerformerIds.map((performerId, index) => {
                  const performer = getPerformerById(performerId);
                  if (!performer) return null;

                  return (
                    <div
                      key={performerId}
                      className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-gray-500">#{index + 1}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{performer.full_name}</p>
                          <p className="text-xs text-gray-500">{performer.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index === selectedPerformerIds.length - 1}
                          className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemovePerformer(performerId)}
                          className="p-1 text-red-400 hover:text-red-600"
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Performers */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Available Performers ({availableToAdd.length})
            </h4>
            {availableToAdd.length === 0 ? (
              <p className="text-sm text-gray-500 italic">All performers added to lineup</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableToAdd.map((performer) => (
                  <div
                    key={performer.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{performer.full_name}</p>
                      <p className="text-xs text-gray-500">{performer.role}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddPerformer(performer.id)}
                      className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={isLoading || selectedPerformerIds.length === 0}
            className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              'Save Lineup'
            )}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </form>
  );
}

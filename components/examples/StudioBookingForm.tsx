/**
 * Example component: Studio Booking Form
 * Form for booking studio service appointments with validation
 */
'use client';

import { useState, useEffect } from 'react';
import { useBookStudio, validateFutureTime, getNextAvailableTime } from '@/hooks/useStudioBooking';
import { supabase } from '@/lib/supabase/client';
import { formatAppointmentTime, formatPrice, toDateTimeLocalValue } from '@/lib/utils/datetime';
import type { StudioService } from '@/lib/supabase/types';

interface StudioBookingFormProps {
  services: StudioService[];
  onSuccess?: () => void;
}

/**
 * Form for booking studio service appointments
 *
 * @example
 * ```tsx
 * <StudioBookingForm
 *   services={availableServices}
 *   onSuccess={() => console.log('Booked!')}
 * />
 * ```
 */
export function StudioBookingForm({ services, onSuccess }: StudioBookingFormProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [desiredTime, setDesiredTime] = useState<string>('');
  const [validationError, setValidationError] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const { bookStudio, isLoading, error, data, isDoubleBooking, reset } = useBookStudio({
    onSuccess: () => {
      // Clear form on success
      setSelectedServiceId('');
      setDesiredTime('');
      setValidationError('');

      // Call parent callback
      if (onSuccess) {
        onSuccess();
      }
    },
  });

  // Check authentication
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
  }, []);

  // Set default time on mount
  useEffect(() => {
    if (!desiredTime) {
      setDesiredTime(toDateTimeLocalValue(getNextAvailableTime()));
    }
  }, [desiredTime]);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // Validation
    if (!selectedServiceId) {
      setValidationError('Please select a service');
      return;
    }

    if (!desiredTime) {
      setValidationError('Please select a date and time');
      return;
    }

    // CRITICAL FIX: Convert datetime-local to UTC without timezone offset
    const local = new Date(desiredTime);

    const utc = new Date(Date.UTC(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      local.getHours(),
      local.getMinutes()
    ));

    const isoTime = utc.toISOString();

    if (!validateFutureTime(isoTime)) {
      setValidationError('Please select a time in the future');
      return;
    }

    // Book the service
    await bookStudio(selectedServiceId, isoTime);
  };

  const handleReset = () => {
    reset();
    setValidationError('');
  };

  if (!isAuthenticated) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-800 font-medium">Please sign in to book studio services</p>
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">No studio services available</p>
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
            <h3 className="text-green-800 font-medium">Booking Confirmed!</h3>
            <p className="text-green-700 text-sm mt-1">
              Your appointment is scheduled for {formatAppointmentTime(data.appointment_time)}
            </p>
            <p className="text-green-600 text-sm mt-2">
              Status: <span className="font-medium">{data.status}</span>
            </p>
            <button
              onClick={handleReset}
              className="mt-4 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded-md text-sm font-medium transition-colors"
            >
              Book Another Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Book a Studio Session</h3>

        {/* Service Selection */}
        <div className="mb-4">
          <label htmlFor="service" className="block text-sm font-medium text-gray-700 mb-2">
            Select Service
          </label>
          <select
            id="service"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Choose a service...</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} - {formatPrice(service.price_cents)} ({service.duration_min} min)
              </option>
            ))}
          </select>
        </div>

        {/* Service Details */}
        {selectedService && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm font-medium text-blue-900">{selectedService.name}</p>
            {selectedService.description && (
              <p className="text-sm text-blue-700 mt-1">{selectedService.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-blue-800">
              <span>Duration: {selectedService.duration_min} minutes</span>
              <span>•</span>
              <span>Price: {formatPrice(selectedService.price_cents)}</span>
            </div>
          </div>
        )}

        {/* Time Selection */}
        <div className="mb-4">
          <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Date & Time
          </label>
          <input
            id="time"
            type="datetime-local"
            value={desiredTime}
            onChange={(e) => setDesiredTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Select a future date and time for your session</p>
        </div>

        {/* Validation Error */}
        {validationError && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <p className="text-yellow-800 text-sm">{validationError}</p>
          </div>
        )}

        {/* Booking Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-red-800 text-sm font-medium">
              {isDoubleBooking ? 'Time Slot Unavailable' : 'Booking Error'}
            </p>
            <p className="text-red-700 text-sm mt-1">{error.message}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !selectedServiceId}
          className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Booking...
            </span>
          ) : (
            'Book Session'
          )}
        </button>
      </div>
    </form>
  );
}

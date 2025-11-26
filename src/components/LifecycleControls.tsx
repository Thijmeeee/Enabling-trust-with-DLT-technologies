import { useState } from 'react';
import { createLifecycleEvent } from '../lib/operations/lifecycleHelpers';

type LifecycleControlsProps = {
  dppId: string;
  did: string;
  onEventCreated?: () => void;
};

export function LifecycleControls({ dppId, did, onEventCreated }: LifecycleControlsProps) {
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventType, setEventType] = useState<'assembly' | 'installation' | 'maintenance' | 'disposal'>('maintenance');
  const [eventDetails, setEventDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateEvent = async () => {
    if (!eventDetails.trim()) {
      alert('Please enter event details');
      return;
    }

    setLoading(true);
    try {
      console.log('LifecycleControls: Creating event...', { dppId, did, eventType, eventDetails });
      await createLifecycleEvent(dppId, did, eventType, {
        description: eventDetails,
        performedBy: 'Current User', // In production: get from auth
        location: 'On-site',
      });

      console.log('LifecycleControls: Event created successfully, calling onEventCreated callback');
      alert('Event added successfully!');
      setEventDetails('');
      setShowEventForm(false);
      onEventCreated?.();
      console.log('LifecycleControls: onEventCreated callback completed');
    } catch (error) {
      console.error('Failed to create event:', error);
      alert('Error adding event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-gray-700">Add New Event</h4>
        <button
          onClick={() => setShowEventForm(!showEventForm)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          disabled={loading}
        >
          {showEventForm ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {showEventForm && (
        <div className="space-y-3 bg-gray-50 p-4 rounded mt-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="assembly">Assembly</option>
              <option value="installation">Installation</option>
              <option value="maintenance">Maintenance</option>
              <option value="disposal">Disposal</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Details
            </label>
            <textarea
              value={eventDetails}
              onChange={(e) => setEventDetails(e.target.value)}
              placeholder="Describe what happened..."
              className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
          </div>

          <button
            onClick={handleCreateEvent}
            disabled={loading || !eventDetails.trim()}
            className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? 'Adding...' : 'Add Event'}
          </button>
        </div>
      )}
    </div>
  );
}

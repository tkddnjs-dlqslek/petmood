import { settingsStore } from "../../../lib/storage/settings-store";
import type { PetMoodSettings } from "../../../types";

export default function TriggerSettings({
  settings,
}: {
  settings: PetMoodSettings;
}) {
  const { triggers } = settings;

  return (
    <div className="space-y-6">
      {/* Timer Trigger */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <label className="flex items-center justify-between mb-3">
          <div>
            <span className="font-medium">Timer Notifications</span>
            <p className="text-xs text-gray-400">
              Sends notifications at regular intervals
            </p>
          </div>
          <input
            type="checkbox"
            checked={triggers.timer.enabled}
            onChange={(e) =>
              settingsStore.set({
                triggers: {
                  ...triggers,
                  timer: { ...triggers.timer, enabled: e.target.checked },
                },
              })
            }
            className="w-4 h-4 accent-orange-500"
          />
        </label>
        {triggers.timer.enabled && (
          <select
            value={triggers.timer.intervalMinutes}
            onChange={(e) =>
              settingsStore.set({
                triggers: {
                  ...triggers,
                  timer: {
                    ...triggers.timer,
                    intervalMinutes: Number(e.target.value),
                  },
                },
              })
            }
            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value={15}>Every 15 min</option>
            <option value={30}>Every 30 min</option>
            <option value={45}>Every 45 min</option>
            <option value={60}>Every 1 hour</option>
            <option value={90}>Every 1.5 hours</option>
            <option value={120}>Every 2 hours</option>
          </select>
        )}
      </section>

      {/* Browse Duration Trigger */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <label className="flex items-center justify-between mb-3">
          <div>
            <span className="font-medium">Browse Duration Alert</span>
            <p className="text-xs text-gray-400">
              Reminds you to take a break after extended browsing
            </p>
          </div>
          <input
            type="checkbox"
            checked={triggers.browseDuration.enabled}
            onChange={(e) =>
              settingsStore.set({
                triggers: {
                  ...triggers,
                  browseDuration: {
                    ...triggers.browseDuration,
                    enabled: e.target.checked,
                  },
                },
              })
            }
            className="w-4 h-4 accent-orange-500"
          />
        </label>
        {triggers.browseDuration.enabled && (
          <select
            value={triggers.browseDuration.thresholdMinutes}
            onChange={(e) =>
              settingsStore.set({
                triggers: {
                  ...triggers,
                  browseDuration: {
                    ...triggers.browseDuration,
                    thresholdMinutes: Number(e.target.value),
                  },
                },
              })
            }
            className="w-full p-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value={30}>After 30 min</option>
            <option value={45}>After 45 min</option>
            <option value={60}>After 1 hour</option>
            <option value={90}>1시간 After 30 min</option>
            <option value={120}>After 2 hours</option>
          </select>
        )}
      </section>

      {/* Time of Day Trigger */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <label className="flex items-center justify-between mb-3">
          <div>
            <span className="font-medium">Scheduled Notifications</span>
            <p className="text-xs text-gray-400">
              Custom notifications at specific times
            </p>
          </div>
          <input
            type="checkbox"
            checked={triggers.timeOfDay.enabled}
            onChange={(e) =>
              settingsStore.set({
                triggers: {
                  ...triggers,
                  timeOfDay: {
                    ...triggers.timeOfDay,
                    enabled: e.target.checked,
                  },
                },
              })
            }
            className="w-4 h-4 accent-orange-500"
          />
        </label>

        {triggers.timeOfDay.enabled && (
          <div className="space-y-2">
            {triggers.timeOfDay.slots.map((slot, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={slot.hour}
                  onChange={(e) => {
                    const newSlots = [...triggers.timeOfDay.slots];
                    newSlots[i] = { ...slot, hour: Number(e.target.value) };
                    settingsStore.set({
                      triggers: {
                        ...triggers,
                        timeOfDay: { ...triggers.timeOfDay, slots: newSlots },
                      },
                    });
                  }}
                  className="w-14 p-1 border border-gray-200 rounded text-center"
                />
                <span>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  step={5}
                  value={slot.minute}
                  onChange={(e) => {
                    const newSlots = [...triggers.timeOfDay.slots];
                    newSlots[i] = { ...slot, minute: Number(e.target.value) };
                    settingsStore.set({
                      triggers: {
                        ...triggers,
                        timeOfDay: { ...triggers.timeOfDay, slots: newSlots },
                      },
                    });
                  }}
                  className="w-14 p-1 border border-gray-200 rounded text-center"
                />
                <button
                  onClick={() => {
                    const newSlots = triggers.timeOfDay.slots.filter(
                      (_, j) => j !== i
                    );
                    settingsStore.set({
                      triggers: {
                        ...triggers,
                        timeOfDay: { ...triggers.timeOfDay, slots: newSlots },
                      },
                    });
                  }}
                  className="text-red-400 hover:text-red-600 text-xs"
                >
                  Delete
                </button>
              </div>
            ))}

            <button
              onClick={() => {
                const newSlots = [
                  ...triggers.timeOfDay.slots,
                  { hour: 12, minute: 0 },
                ];
                settingsStore.set({
                  triggers: {
                    ...triggers,
                    timeOfDay: { ...triggers.timeOfDay, slots: newSlots },
                  },
                });
              }}
              className="text-sm text-orange-500 hover:text-orange-600"
            >
              + Add Time
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

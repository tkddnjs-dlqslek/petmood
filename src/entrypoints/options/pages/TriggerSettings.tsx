import { settingsStore } from "../../../lib/storage/settings-store";
import { FREQUENCY_PRESETS } from "../../../lib/triggers/policy";
import type { PetMoodSettings } from "../../../types";

const FREQ_PRESETS: Array<{
  key: PetMoodSettings["frequencyPreset"];
  label: string;
  desc: string;
}> = [
  { key: "quiet", label: "Quiet", desc: "Every 60 min" },
  { key: "normal", label: "Normal", desc: "Every 30 min" },
  { key: "lively", label: "Lively", desc: "Every 10 min" },
];

export default function TriggerSettings({
  settings,
}: {
  settings: PetMoodSettings;
}) {
  const { triggers } = settings;

  const applyFrequency = (
    preset: PetMoodSettings["frequencyPreset"],
    customMinutes?: number
  ) => {
    const minutes =
      preset === "custom"
        ? customMinutes ?? triggers.timer.intervalMinutes
        : FREQUENCY_PRESETS[preset as keyof typeof FREQUENCY_PRESETS];
    settingsStore.set({
      frequencyPreset: preset,
      triggers: {
        ...triggers,
        timer: { enabled: true, intervalMinutes: minutes },
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Frequency Preset */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-medium mb-1">Frequency</h3>
        <p className="text-xs text-gray-400 mb-3">
          How often your pet shows up while you're browsing.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {FREQ_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => applyFrequency(p.key)}
              className={`py-3 px-2 rounded-lg border text-sm transition ${
                settings.frequencyPreset === p.key
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="font-medium">{p.label}</div>
              <div className="text-[10px] text-gray-400">{p.desc}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Custom:</span>
          <input
            type="number"
            min={1}
            max={240}
            value={triggers.timer.intervalMinutes}
            onFocus={() => {
              // Switch to custom as soon as the user touches the field so the
              // preset highlights drop off — avoids the "Lively is still
              // orange while I'm typing in Custom" confusion.
              if (settings.frequencyPreset !== "custom") {
                applyFrequency("custom", triggers.timer.intervalMinutes);
              }
            }}
            onChange={(e) =>
              applyFrequency("custom", Number(e.target.value))
            }
            className={`w-20 p-2 border rounded-lg text-center transition ${
              settings.frequencyPreset === "custom"
                ? "border-orange-500 bg-orange-50 text-orange-600 font-medium"
                : "border-gray-200"
            }`}
          />
          <span className="text-gray-500">min</span>
        </div>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          Timing is approximate. Chrome may fire the alarm a little early or
          late (and pauses it to save power when idle), so the actual gap can
          drift by several seconds from the value you set.
        </p>
      </section>
    </div>
  );
}

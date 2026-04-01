import { useState } from "react";
import { settingsStore } from "../../../lib/storage/settings-store";
import { DEFAULT_MESSAGES } from "../../../lib/templates/message-bank";
import type { PetMoodSettings } from "../../../types";
import { ACTIVITY_TYPES } from "../../../types";

const ACTIVITY_LABELS: Record<string, string> = {
  happy: "Happy",
  eating: "Eating",
  running: "Running",
  sleeping: "Sleeping",
  sad: "Sad",
  angry: "Angry",
  caught: "Caught (running)",
  escaped: "Escaped (running)",
};

const MAX_CUSTOM_PER_CATEGORY = 20;
const ALL_CATEGORIES = [...ACTIVITY_TYPES, "caught", "escaped"] as const;

export default function MessageSettings({
  settings,
}: {
  settings: PetMoodSettings;
}) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [newMsg, setNewMsg] = useState("");

  const custom = settings.customMessages ?? {};

  const addMessage = async (category: string) => {
    if (!newMsg.trim()) return;
    const existing = custom[category] ?? [];
    if (existing.length >= MAX_CUSTOM_PER_CATEGORY) {
      alert(`Max ${MAX_CUSTOM_PER_CATEGORY} custom messages per category!`);
      return;
    }
    const updated = { ...custom, [category]: [...existing, newMsg.trim()] };
    await settingsStore.set({ customMessages: updated });
    setNewMsg("");
  };

  const removeMessage = async (category: string, index: number) => {
    const existing = custom[category] ?? [];
    const updated = {
      ...custom,
      [category]: existing.filter((_, i) => i !== index),
    };
    await settingsStore.set({ customMessages: updated });
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <section className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-medium mb-2">Message Mode</h3>
        <div className="flex gap-2">
          {(["mix", "custom-only"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => settingsStore.set({ messageMode: mode })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${
                settings.messageMode === mode
                  ? "border-orange-500 bg-orange-50 text-orange-600"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              {mode === "mix" ? "Mix (default + yours)" : "Custom only"}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {settings.messageMode === "mix"
            ? "Your messages are mixed with the defaults."
            : "Only your custom messages will be shown. Add at least 1 per category."}
        </p>
      </section>

      {/* Category list */}
      {ALL_CATEGORIES.map((cat) => {
        const catCustom = custom[cat] ?? [];
        const defaultCount = (DEFAULT_MESSAGES[cat] ?? []).length;
        const isExpanded = expandedCat === cat;

        return (
          <section
            key={cat}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            <button
              onClick={() => setExpandedCat(isExpanded ? null : cat)}
              className="w-full flex items-center justify-between p-4"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">
                  {ACTIVITY_LABELS[cat] ?? cat}
                </span>
                <span className="text-xs text-gray-400">
                  {catCustom.length} custom / {defaultCount} default
                </span>
              </div>
              <span className="text-xs text-gray-300">
                {isExpanded ? "▲" : "▼"}
              </span>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                {/* Custom messages */}
                {catCustom.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">
                      Your messages:
                    </p>
                    {catCustom.map((msg, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2"
                      >
                        <span className="flex-1 text-xs text-gray-700">
                          {msg}
                        </span>
                        <button
                          onClick={() => removeMessage(cat, i)}
                          className="text-red-400 hover:text-red-600 text-xs shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={expandedCat === cat ? newMsg : ""}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") addMessage(cat);
                    }}
                    placeholder="Type a new message..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-orange-400"
                    maxLength={200}
                  />
                  <button
                    onClick={() => addMessage(cat)}
                    disabled={!newMsg.trim()}
                    className="px-3 py-2 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 transition disabled:bg-gray-300"
                  >
                    Add
                  </button>
                </div>
                <p className="text-[10px] text-gray-300">
                  {catCustom.length}/{MAX_CUSTOM_PER_CATEGORY} custom messages
                </p>

                {/* Default messages preview */}
                <details className="text-xs">
                  <summary className="text-gray-400 cursor-pointer hover:text-gray-500">
                    View default messages ({defaultCount})
                  </summary>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {(DEFAULT_MESSAGES[cat] ?? []).map((msg, i) => (
                      <p key={i} className="text-gray-400 px-2 py-1">
                        {msg}
                      </p>
                    ))}
                  </div>
                </details>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

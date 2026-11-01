"use client";
import type {
  MemoryEffort,
  MemoryEffortTrace,
} from "@cortexmemory/sdk/runtime";
export function MemoryEffortControl({
  value,
  onChange,
  disabled = false,
  supported = true,
}: {
  value: MemoryEffort;
  onChange: (value: MemoryEffort) => void;
  disabled?: boolean;
  supported?: boolean;
}) {
  return (
    <div>
      <label>
        Memory effort
        <select
          aria-label="Memory effort"
          disabled={disabled || !supported}
          onChange={(event) => {
            const selected = event.target.value;
            if (
              selected === "fast" ||
              selected === "normal" ||
              selected === "high" ||
              selected === "max"
            ) {
              onChange(selected);
            }
          }}
          value={value}
        >
          <option value="fast">Fast</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="max">Max</option>
        </select>
      </label>
      {!supported && (
        <p role="status">
          This Agent version uses legacy memory selection. Choose an
          effort-aware Agent version to change effort.
        </p>
      )}
    </div>
  );
}
export function MemoryEffortStatus({ trace }: { trace?: MemoryEffortTrace }) {
  if (!trace) {
    return null;
  }
  return (
    <div data-testid="memory-effort-status" role="status">
      <p>
        Server effort: {trace.effectiveEffort}. Reached depth{" "}
        {trace.reachedDepth}; selected {trace.selected} entries.
      </p>
      <p>
        Effective limits:{" "}
        {trace.maxDepth === null
          ? "no preset hop cap"
          : `${trace.maxDepth} hops`}
        ;{" "}
        {trace.maxEntries === null
          ? "no preset entry cap"
          : `${trace.maxEntries} entries`}
        ; {trace.maxContextTokens} context units.
      </p>
      <p>
        Retrieval: {trace.durationMs} ms. Stops:{" "}
        {trace.stopReasons.join(", ") || "not reported"}.
      </p>
      {trace.unavailableStages.length > 0 && (
        <p>
          Unavailable memory sources: {trace.unavailableStages.join(", ")}.
          Results are partial.
        </p>
      )}
    </div>
  );
}

import { Button } from "@/components/ui/button";

export type TimeRange = 7 | 30 | 90 | null; // null = all time

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
  { value: 90, label: "90 Days" },
  { value: null, label: "All Time" },
];

export function TimeRangeSelector({ selected, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-2 flex-wrap">
      {TIME_RANGES.map(({ value, label }) => (
        <Button
          key={label}
          variant={selected === value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(value)}
          className="transition-all"
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

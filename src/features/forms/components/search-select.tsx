"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

/** Type-to-search dropdown for long option lists (branches, states, courses). Loaded on demand. */
export default function SearchSelect({
  id,
  options,
  value,
  onChange,
  invalid,
  describedBy,
  placeholder,
}: {
  id: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}) {
  return (
    <Combobox items={options} value={value || null} onValueChange={(v) => onChange((v as string | null) ?? "")}>
      <ComboboxInput
        id={id}
        placeholder={placeholder ?? "Type to search"}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        showClear={Boolean(value)}
        className="h-11 w-full rounded-lg text-[15px]"
      />
      <ComboboxContent>
        <ComboboxEmpty>No match</ComboboxEmpty>
        <ComboboxList>
          {(item: string) => (
            <ComboboxItem key={item} value={item}>
              {item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";

type SearchOption = {
  value: string;
  label: string;
  subtitle?: string;
  searchAliases?: string;
};

type SearchSelectProps = {
  label: string;
  placeholder: string;
  options: SearchOption[];
  value: string;
  accentColor?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function SearchSelect({
  label,
  placeholder,
  options,
  value,
  accentColor = "#2a2a2a",
  disabled = false,
  onChange,
}: SearchSelectProps) {
  const selectedOption = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const displayValue = open ? query : selectedOption?.label ?? "";

  const filteredOptions = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) {
      return options.slice(0, 8);
    }

    return options
      .filter((option) => {
        const haystack = `${option.label} ${option.subtitle ?? ""} ${option.searchAliases ?? ""}`.toLowerCase();
        return haystack.includes(normalized);
      })
      .slice(0, 8);
  }, [deferredQuery, options]);

  return (
    <div className="relative">
      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-[#888888]">
        {label}
      </label>
      <div
        className="rounded-2xl border border-[#2a2a2a] bg-[#131313] p-[1px]"
        style={{ boxShadow: `inset 0 0 0 1px ${accentColor}22` }}
      >
        <input
          disabled={disabled}
          value={displayValue}
          placeholder={placeholder}
          onFocus={() => {
            if (disabled) {
              return;
            }
            setQuery(selectedOption?.label ?? "");
            setOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              setOpen(false);
              setQuery("");
            }, 100);
          }}
          onChange={(event) => {
            if (disabled) {
              return;
            }
            setQuery(event.target.value);
            setOpen(true);
          }}
          className="w-full rounded-[15px] bg-[#131313] px-4 py-3 text-base text-[#f5f5f5] outline-none placeholder:text-[#666666] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        />
      </div>
      {open && !disabled && filteredOptions.length > 0 ? (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-[#2a2a2a] bg-[#111111] shadow-2xl shadow-black/40">
          {filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onMouseDown={() => {
                onChange(option.value);
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-start justify-between gap-3 border-b border-[#1f1f1f] px-4 py-3 text-left last:border-b-0 hover:bg-[#191919]"
            >
              <span className="pr-3 text-sm font-medium text-[#f5f5f5]">
                {option.label}
              </span>
              {option.subtitle ? (
                <span className="text-xs text-[#888888]">{option.subtitle}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

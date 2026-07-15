"use client";

import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { BOOK_COLORS, BOOK_EMOJIS } from "@/lib/constants";
import { cn, formatIndianDigits, parseAmountInput } from "@/lib/helpers";
import { Button } from "@/components/ui/Button";
import { FieldWrap, Input, Textarea } from "@/components/ui/Input";
import type { Book, NewBookInput } from "@/types";

interface BookFormProps {
  initial?: Book;
  submitLabel: string;
  onSubmit: (input: NewBookInput) => Promise<void>;
}

export function BookForm({ initial, submitLabel, onSubmit }: BookFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [colorTag, setColorTag] = useState(initial?.color_tag ?? BOOK_COLORS[0].key);
  const [emoji, setEmoji] = useState(initial?.icon_emoji ?? BOOK_EMOJIS[0]);
  const [budget, setBudget] = useState(
    initial?.monthly_budget ? formatIndianDigits(String(initial.monthly_budget)) : ""
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Give this book a name");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        color_tag: colorTag,
        icon_emoji: emoji,
        monthly_budget: budget ? parseAmountInput(budget) : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-6">
      <Input
        label="Book name"
        placeholder="e.g. Home Expenses"
        value={name}
        maxLength={60}
        onChange={(e) => {
          setName(e.target.value);
          if (nameError) setNameError(null);
        }}
        error={nameError}
        autoFocus
      />

      <Textarea
        label="Description · optional"
        placeholder="What does this ledger track?"
        value={description}
        maxLength={160}
        onChange={(e) => setDescription(e.target.value)}
      />

      <FieldWrap label="Color tag">
        <div className="flex flex-wrap gap-2.5">
          {BOOK_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.name}
              onClick={() => setColorTag(c.key)}
              aria-pressed={colorTag === c.key}
              className={cn(
                "press flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
                colorTag === c.key ? "scale-110 ring-2 ring-offset-2 ring-offset-canvas" : "hover:scale-105"
              )}
              style={{
                background: `linear-gradient(145deg, ${c.hex}, color-mix(in srgb, ${c.hex} 70%, #1a120a))`,
                ...(colorTag === c.key ? ({ ["--tw-ring-color" as string]: c.hex } as React.CSSProperties) : {}),
              }}
            >
              {colorTag === c.key ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
            </button>
          ))}
        </div>
      </FieldWrap>

      <FieldWrap label="Icon">
        <div className="grid grid-cols-6 gap-2">
          {BOOK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={cn(
                "press flex h-12 items-center justify-center rounded-xl border text-2xl transition-all duration-200",
                emoji === e
                  ? "border-brand bg-brand-soft shadow-card"
                  : "border-line bg-card hover:border-line-strong"
              )}
            >
              {e}
            </button>
          ))}
        </div>
      </FieldWrap>

      <Input
        label="Monthly budget · optional"
        placeholder="e.g. 25,000"
        inputMode="numeric"
        value={budget}
        onChange={(e) => setBudget(formatIndianDigits(e.target.value))}
        hint="Leave blank for no budget. You'll see a spend meter when set."
        className="amount"
      />

      <Button type="submit" size="lg" loading={busy} className="mt-2">
        {submitLabel}
      </Button>
    </form>
  );
}

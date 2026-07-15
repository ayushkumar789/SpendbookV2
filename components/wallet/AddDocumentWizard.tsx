"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DOC_TYPES, docTypeMeta, type DocTypeMeta } from "@/components/wallet/docTypes";
import { createWalletDocument } from "@/lib/features/wallet";
import { cn } from "@/lib/helpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import type { WalletDocType } from "@/types/features";

interface AddDocumentWizardProps {
  onDone: () => void;
  onCancel: () => void;
}

/** Card-frame capture zone with auto-crop preview (object-fit: cover). */
function CaptureZone({
  label,
  file,
  onFile,
  accent,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
  accent: string;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    // Camera capture is only meaningful on touch devices (mobile web / PWA / native).
    setCanScan(navigator.maxTouchPoints > 0);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const f = e.target.files?.[0] ?? null;
    if (f) onFile(f);
    e.target.value = "";
  };

  return (
    <div className="flex-1">
      <p className="label-caps mb-2">{label}</p>
      <div
        className="bank-card flex items-center justify-center border-2 border-dashed bg-card/60 transition-colors"
        style={{ borderColor: file ? accent : "var(--line-strong)" }}
      >
        {preview ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt={`${label} preview`} className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onFile(null)}
              className="press absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm transition-colors hover:bg-black/80"
            >
              <RotateCcw className="h-3 w-3" /> Retake
            </button>
            <span
              className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-white"
              style={{ background: accent }}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5 p-4">
            <p className="text-center text-xs text-ink3">Frame the {label.toLowerCase()} inside the card</p>
            <div className="flex gap-2">
              {canScan ? (
                <Button type="button" size="sm" variant="soft" icon={<Camera className="h-3.5 w-3.5" />} onClick={() => scanRef.current?.click()}>
                  Scan
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" icon={<Upload className="h-3.5 w-3.5" />} onClick={() => uploadRef.current?.click()}>
                Upload
              </Button>
            </div>
          </div>
        )}
      </div>
      <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      <input ref={scanRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
    </div>
  );
}

export function AddDocumentWizard({ onDone, onCancel }: AddDocumentWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<WalletDocType | null>(null);
  const [label, setLabel] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const meta: DocTypeMeta | null = docType ? docTypeMeta(docType) : null;

  const save = async (): Promise<void> => {
    if (!user || !docType || !meta) return;
    if (!frontFile) {
      toast("Capture or upload the front side first", "error");
      return;
    }
    setBusy(true);
    try {
      await createWalletDocument(user.id, {
        doc_type: docType,
        doc_name: meta.name,
        custom_label: label.trim() || null,
        has_back: meta.hasBack,
        frontFile,
        backFile: meta.hasBack ? backFile : null,
      });
      toast("Document stored securely", "success");
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save document", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Step rail */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                s < step ? "bg-jade text-white" : s === step ? "bg-brand text-on-brand shadow-[0_0_14px_-4px_var(--brand-glow)]" : "border border-line-strong text-ink3"
              )}
            >
              {s < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : s}
            </span>
            {s < 3 ? <span className={cn("h-0.5 flex-1 rounded-full transition-colors", s < step ? "bg-jade" : "bg-line")} /> : null}
          </div>
        ))}
      </div>
      <p className="label-caps -mt-3">
        {step === 1 ? "Step 1 · Document type" : step === 2 ? "Step 2 · Label" : "Step 3 · Capture"}
      </p>

      {step === 1 ? (
        <>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {DOC_TYPES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.key}
                  onClick={() => {
                    setDocType(d.key);
                    setLabel(`My ${d.name}`);
                  }}
                  aria-pressed={docType === d.key}
                  className={cn(
                    "press flex flex-col items-center gap-2.5 rounded-2xl border p-4 transition-all duration-200",
                    docType === d.key ? "border-brand bg-brand-soft shadow-card" : "border-line bg-card hover:border-line-strong"
                  )}
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: `linear-gradient(145deg, ${d.gradient[1]}, ${d.gradient[0]})` }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-center text-[12px] font-semibold text-ink">{d.name}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="lg" disabled={!docType} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Input
            label="Document label"
            value={label}
            maxLength={60}
            onChange={(e) => {
              setLabel(e.target.value);
              setLabelError(null);
            }}
            error={labelError}
            hint="How this card appears in your vault"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              size="lg"
              onClick={() => {
                if (!label.trim()) {
                  setLabelError("Give it a label");
                  return;
                }
                setStep(3);
              }}
            >
              Continue
            </Button>
          </div>
        </>
      ) : null}

      {step === 3 && meta ? (
        <>
          <div className={cn("flex gap-4", meta.hasBack ? "flex-col sm:flex-row" : "flex-col")}>
            <CaptureZone label="Front side" file={frontFile} onFile={setFrontFile} accent={meta.color} />
            {meta.hasBack ? <CaptureZone label="Back side" file={backFile} onFile={setBackFile} accent={meta.color} /> : null}
          </div>
          <p className="text-xs leading-relaxed text-ink3">
            Images are framed to card shape automatically and stored in your private vault.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => setStep(2)} disabled={busy}>
              Back
            </Button>
            <Button size="lg" onClick={() => void save()} loading={busy} disabled={!frontFile}>
              Save to vault
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

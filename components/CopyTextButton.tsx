"use client";

import { useRef, useState } from "react";

export function CopyTextButton({
  text,
  idleLabel,
  className,
  copiedLabel = "Copied!",
  disabled,
}: {
  text: string;
  idleLabel: string;
  className?: string;
  copiedLabel?: string;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const click = async () => {
    try {
      await navigator.clipboard.writeText(text);
      if (timer.current) clearTimeout(timer.current);
      setPhase("ok");
      timer.current = setTimeout(() => {
        setPhase("idle");
        timer.current = null;
      }, 2000);
    } catch {
      if (timer.current) clearTimeout(timer.current);
      setPhase("fail");
      timer.current = setTimeout(() => {
        setPhase("idle");
        timer.current = null;
      }, 2000);
    }
  };

  const label =
    phase === "ok" ? copiedLabel : phase === "fail" ? "Couldn't copy" : idleLabel;

  return (
    <button type="button" className={className} disabled={disabled} onClick={() => void click()}>
      {label}
    </button>
  );
}

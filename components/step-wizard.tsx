"use client";

import { AnimatePresence, motion } from "motion/react";
import { type RefObject, useEffect } from "react";

/** Run `fn` after paint and a few later ticks — helps focus survive `AnimatePresence` + spring timing. */
export function scheduleAfterEnterStable(fn: () => void): () => void {
  const timeouts: ReturnType<typeof setTimeout>[] = [];
  let raf2 = 0;
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => {
      fn();
      timeouts.push(setTimeout(fn, 0));
      timeouts.push(setTimeout(fn, 48));
      timeouts.push(setTimeout(fn, 120));
      timeouts.push(setTimeout(fn, 260));
    });
  });
  return () => {
    cancelAnimationFrame(raf1);
    cancelAnimationFrame(raf2);
    timeouts.forEach(clearTimeout);
  };
}

/** Spring tuned for crisp, Reanimated-like step changes on the web (Motion uses the WAAPI spring solver). */
export const wizardSpring = {
  type: "spring" as const,
  stiffness: 520,
  damping: 38,
  mass: 0.72,
};

const SLIDE_PX = 32;

export function slideVariants(axis: "x" | "y" = "x", distance = SLIDE_PX) {
  const d = axis === "x" ? { x: distance } : { y: distance };
  const neg = axis === "x" ? { x: -distance } : { y: -distance };
  // Slide only — no opacity crossfade. Safari (especially iOS) can leave
  // `opacity: 0` enter variants stuck unpainted; see motion/framer-motion #838.
  return {
    enter: (dir: number) => (dir >= 0 ? d : neg),
    center: { x: 0, y: 0 },
    exit: (dir: number) => (dir >= 0 ? neg : d),
  };
}

type AnimatedWizardStepProps = {
  stepKey: string | number;
  direction: number;
  children: React.ReactNode;
  className?: string;
  axis?: "x" | "y";
  /** `sync` mounts the next step while the previous exits — better for focusing inputs; default `wait`. */
  presenceMode?: "wait" | "sync";
  /** Fires when this step’s enter → center motion finishes (exit completions use the exiting slide’s key). */
  onStepEnterComplete?: (stepKey: string | number) => void;
};

/** Own component so `slideKey` in `onAnimationComplete` stays correct for exiting vs entering slides. */
function WizardStepMotion({
  slideKey,
  direction,
  axis,
  motionClassName,
  children,
  onStepEnterComplete,
}: {
  slideKey: string | number;
  direction: number;
  axis: "x" | "y";
  motionClassName: string;
  children: React.ReactNode;
  onStepEnterComplete?: (stepKey: string | number) => void;
}) {
  return (
    <motion.div
      role="group"
      aria-live="polite"
      custom={direction}
      variants={slideVariants(axis)}
      initial="enter"
      animate="center"
      exit="exit"
      transition={wizardSpring}
      className={motionClassName}
      onAnimationComplete={
        onStepEnterComplete
          ? () => {
              scheduleAfterEnterStable(() => onStepEnterComplete(slideKey));
            }
          : undefined
      }
    >
      {children}
    </motion.div>
  );
}

export function AnimatedWizardStep({
  stepKey,
  direction,
  children,
  className,
  axis = "x",
  presenceMode = "wait",
  onStepEnterComplete,
}: AnimatedWizardStepProps) {
  const outer =
    className != null && className !== ""
      ? `relative min-w-0 overflow-x-hidden overflow-y-visible ${className}`
      : "relative min-w-0 overflow-x-hidden overflow-y-visible";

  return (
    <div className={outer}>
      <AnimatePresence mode={presenceMode} custom={direction}>
        <WizardStepMotion
          key={stepKey}
          slideKey={stepKey}
          direction={direction}
          axis={axis}
          motionClassName="min-w-0 w-full"
          onStepEnterComplete={onStepEnterComplete}
        >
          {children}
        </WizardStepMotion>
      </AnimatePresence>
    </div>
  );
}

/** Focus the given element when `deps` change (e.g. step index), after layout. */
export function useFocusWhen(
  deps: unknown[],
  ref: RefObject<HTMLElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps array
  }, deps);
}

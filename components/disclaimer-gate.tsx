import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export const DISCLAIMER_TEXT =
  "This review is just an estimate performed by an AI algorithm. It could be spot on or way out to lunch. Always have a tuner verify the logs before calling it safe. This is to be used as a simple spot check for obvious issues.";

/** Full-screen notice the user must acknowledge before using the app. */
export function DisclaimerGate({ children }: { children: ReactNode }) {
  const [accepted, setAccepted] = useState(false);
  const titleId = useId();
  const bodyId = useId();
  const okayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (accepted) return;
    okayRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [accepted]);

  return (
    <>
      {children}
      {!accepted ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            className="w-full max-w-lg rounded-2xl border-2 border-amber-500/70 bg-background p-5 shadow-2xl sm:p-6"
          >
            <p id={titleId} className="font-mono text-xs tracking-[0.18em] text-amber-800 uppercase dark:text-amber-200">
              Important notice
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">Read this before you continue</h2>
            <p id={bodyId} className="mt-4 text-base leading-7 text-foreground">
              {DISCLAIMER_TEXT}
            </p>
            <div className="mt-6 flex justify-end">
              <Button
                ref={okayRef}
                type="button"
                size="lg"
                className="h-11 min-w-[8rem] px-6 text-base font-semibold tracking-wide uppercase"
                onClick={() => setAccepted(true)}
              >
                Okay
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

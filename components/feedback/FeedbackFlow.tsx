"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Step = "welcome" | "rating" | "comment" | "done";

const GOLD = "#d9b45b";
const DARK_GOLD = "#C59B27";

export function FeedbackFlow({
  eventId,
  eventTitle,
}: {
  eventId: string;
  eventTitle: string;
}) {
  const [step, setStep] = React.useState<Step>("welcome");
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const stepIndex = { welcome: 0, rating: 1, comment: 2, done: 3 }[step];

  async function submit() {
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("feedback").insert({
        event_id: eventId,
        rating,
        comment: comment.trim() || null,
        attendee_id: null,
      });
      if (error) throw error;
      setStep("done");
    } catch (error) {
      console.error(error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not submit your feedback. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <Image
        src="/wits-logo-light.png"
        alt="University of the Witwatersrand"
        width={164}
        height={100}
        priority
        className="h-12 w-auto"
      />

      {step !== "done" && (
        <div className="mt-8 flex items-center gap-1.5" aria-hidden>
          {[1, 2, 3].map((dot) => (
            <span
              key={dot}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                stepIndex >= dot ? "w-8 bg-[#d9b45b]" : "w-4 bg-white/25",
              )}
            />
          ))}
        </div>
      )}

      <div className="mt-10 w-full text-center">
        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.div
              key="welcome"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-6"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d9b45b]">
                Event feedback
              </p>
              <h1 className="text-3xl font-semibold text-balance text-white sm:text-4xl">
                {eventTitle}
              </h1>
              <p className="mx-auto max-w-md text-base leading-relaxed text-white/80">
                Thank you for joining us. Your honest feedback helps us make our
                future events even better. It only takes a minute, and your
                responses are completely anonymous.
              </p>
              <Button
                size="lg"
                onClick={() => setStep("rating")}
                className="bg-[#d9b45b] text-primary hover:bg-[#C59B27]"
              >
                Share my feedback
                <ArrowRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {step === "rating" && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-semibold text-balance text-white sm:text-4xl">
                How was your experience?
              </h2>
              <div className="flex justify-center gap-2 sm:gap-3">
                {[1, 2, 3, 4, 5].map((value) => (
                  <motion.button
                    key={value}
                    type="button"
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    onMouseEnter={() => setHover(value)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(value)}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    className="rounded-full p-1"
                  >
                    <Star
                      className="size-11 transition-colors sm:size-12"
                      style={{
                        color:
                          (hover || rating) >= value ? GOLD : "rgba(255,255,255,0.3)",
                        fill:
                          (hover || rating) >= value ? GOLD : "transparent",
                      }}
                    />
                  </motion.button>
                ))}
              </div>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("welcome")}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  disabled={rating === 0}
                  onClick={() => setStep("comment")}
                  className="bg-[#d9b45b] text-primary hover:bg-[#C59B27] disabled:opacity-40"
                >
                  Continue
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "comment" && (
            <motion.div
              key="comment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="space-y-8"
            >
              <h2 className="text-3xl font-semibold text-balance text-white sm:text-4xl">
                Anything you&apos;d like to add?
              </h2>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us what you loved, or what we could do better..."
                className="min-h-36 border-white/25 bg-white/10 text-white placeholder:text-white/50 focus-visible:border-[#d9b45b] focus-visible:ring-[#d9b45b]/40"
              />
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep("rating")}
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Back
                </Button>
                <Button
                  size="lg"
                  onClick={submit}
                  disabled={submitting}
                  className="bg-[#d9b45b] text-primary hover:bg-[#C59B27]"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Heart className="size-4 fill-pink-500 text-pink-500" />
                  )}
                  {submitting ? "Submitting..." : "Submit feedback"}
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="space-y-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
                className="mx-auto flex size-20 items-center justify-center rounded-full bg-[#d9b45b]"
              >
                <Heart className="size-9 fill-pink-500 text-pink-500" />
              </motion.div>
              <h2 className="text-4xl font-semibold text-white">Thank you!</h2>
              <p
                className="mx-auto max-w-md text-base leading-relaxed"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Your feedback has been recorded and will help shape the next CSD
                experience. We can&apos;t wait to see you again.
              </p>
              <p
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: DARK_GOLD }}
              >
                Centre for Student Development
              </p>

              <div>
                <Link
                  href={`/events/${eventId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 hover:underline"
                >
                  <ArrowLeft className="size-4" />
                  Back to event
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

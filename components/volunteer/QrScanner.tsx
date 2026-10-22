"use client";

import * as React from "react";
import jsQR from "jsqr";
import {
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  ScanLine,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { cn, initials } from "@/lib/utils";
import type { EventRecord, UserPosition } from "@/lib/types";
import { parseWristbands, wristbandSwatch } from "@/lib/wristbands";

type Phase =
  | "scanning"
  | "loading"
  | "found"
  | "no-registration"
  | "already-checked-in"
  | "checked-in";

type Mode = "scan" | "email";

const POSITION_LABELS: Record<UserPosition, string> = {
  STUDENT: "Student",
  STAFF: "Staff",
  GUEST: "Guest",
  GUEST_SPEAKER: "Guest Speaker",
};

interface ScannedAttendee {
  id: string;
  name: string;
  position: UserPosition | null;
  wristband: string | null;
}

interface RegistrantSuggestion {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  position: string | null;
}

export function QrScanner({
  event,
  volunteerId,
  onClose,
}: {
  event: EventRecord;
  volunteerId: string;
  onClose: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const rafRef = React.useRef<number | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const lockedRef = React.useRef(false);

  const [mode, setMode] = React.useState<Mode>("scan");
  const [phase, setPhase] = React.useState<Phase>("scanning");
  const [attendee, setAttendee] = React.useState<ScannedAttendee | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<RegistrantSuggestion[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [searching, setSearching] = React.useState(false);
  const searchSeq = React.useRef(0);

  const stopCamera = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const resetInput = React.useCallback(() => {
    lockedRef.current = false;
    setAttendee(null);
    setError(null);
    setPhase("scanning");
  }, []);

  // Resolve an attendee from either a scanned user id or a manually entered
  // email, then apply the exact same registration checks for both paths.
  const resolveAttendee = React.useCallback(
    async (input: { userId: string } | { email: string }) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setPhase("loading");
      setError(null);
      setShowSuggestions(false);
      try {
        const supabase = createClient();
        const { data: profile } =
          "userId" in input
            ? await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .eq("id", input.userId)
                .maybeSingle()
            : await supabase
                .from("profiles")
                .select("id, first_name, last_name")
                .eq("email", input.email.trim().toLowerCase())
                .maybeSingle();

        if (!profile) {
          setAttendee(null);
          setPhase("no-registration");
          return;
        }

        // "*" rather than naming wristband_color, so check-in keeps working
        // before supabase/fixes/wristbands.sql has been run.
        const { data: registration } = await supabase
          .from("registrations")
          .select("*")
          .eq("event_id", event.id)
          .eq("attendee_id", profile.id)
          .maybeSingle();

        const name = `${profile.first_name ?? ""} ${
          profile.last_name ?? ""
        }`.trim();

        if (!registration || registration.status !== "CONFIRMED") {
          setAttendee({
            id: profile.id,
            name,
            position: (registration?.position as UserPosition) ?? null,
            wristband: null,
          });
          setPhase("no-registration");
          return;
        }

        setAttendee({
          id: profile.id,
          name,
          position: registration.position as UserPosition,
          wristband: (registration.wristband_color as string | null) ?? null,
        });
        setPhase("found");
      } catch (err) {
        console.error(err);
        setError("Could not look up that attendee. Please try again.");
        setPhase("no-registration");
      }
    },
    [event.id],
  );

  React.useEffect(() => {
    // Only run the camera while scanning. In email mode it stays off so the
    // device isn't held open and the form can take over the screen.
    if (mode !== "scan") return;

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const tick = () => {
          if (cancelled) return;
          const v = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext("2d");
          if (v && canvas && ctx && v.readyState === v.HAVE_ENOUGH_DATA) {
            const width = 320;
            const height =
              Math.round((v.videoHeight / v.videoWidth) * width) || 240;
            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(v, 0, 0, width, height);
            const image = ctx.getImageData(0, 0, width, height);
            const code = jsQR(image.data, width, height);
            if (code?.data) {
              void resolveAttendee({ userId: code.data.trim() });
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.error(err);
        setError("Camera access was denied or is unavailable.");
      }
    })();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [mode, resolveAttendee, stopCamera]);

  // Debounced registrant search for the manual email field. Runs only while
  // typing in email mode, ignores stale responses, and caps the payload.
  React.useEffect(() => {
    if (mode !== "email" || phase !== "scanning") return;
    const term = email.trim();
    if (term.length < 2) return;

    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const supabase = createClient();
        const { data, error: rpcError } = await supabase.rpc(
          "search_event_registrants",
          { p_event_id: event.id, p_term: term, p_limit: 6 },
        );
        if (seq !== searchSeq.current) return;
        if (rpcError) throw rpcError;
        const rows = (data ?? []) as RegistrantSuggestion[];
        setSuggestions(rows);
        setShowSuggestions(rows.length > 0);
      } catch {
        if (seq === searchSeq.current) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [email, mode, phase, event.id]);

  function selectSuggestion(suggestion: RegistrantSuggestion) {
    setEmail(suggestion.email ?? "");
    setSuggestions([]);
    setShowSuggestions(false);
    void resolveAttendee({ userId: suggestion.id });
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setSuggestions([]);
    setShowSuggestions(false);
    setSearching(false);
    resetInput();
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    await resolveAttendee({ email: value });
  }

  async function checkIn() {
    if (!attendee) return;
    setPhase("loading");
    try {
      const supabase = createClient();

      // Only one check-in per attendee per calendar day. If a record already
      // exists for today, stop and tell the operator.
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const { data: existing, error: checkError } = await supabase
        .from("attendance")
        .select("id")
        .eq("event_id", event.id)
        .eq("attendee_id", attendee.id)
        .gte("created_at", dayStart.toISOString())
        .lt("created_at", dayEnd.toISOString())
        .maybeSingle();
      if (checkError) throw checkError;

      if (existing) {
        setPhase("already-checked-in");
        return;
      }

      const { error: insertError } = await supabase
        .from("attendance")
        .insert({
          event_id: event.id,
          volunteer_id: volunteerId,
          attendee_id: attendee.id,
        });
      if (insertError) throw insertError;
      toast.success(`${attendee.name} checked in.`);
      setPhase("checked-in");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Could not check in attendee.",
      );
      setPhase("found");
    }
  }

  const resetLabel = mode === "scan" ? "Scan next" : "Next attendee";

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          mode === "email" && "opacity-0",
        )}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute inset-0 flex flex-col">
        <header className="relative z-10 bg-white/90 px-4 py-3 text-center">
          <p className="text-base font-semibold text-primary">
            {event.title}
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-primary/70">
            Check-in
          </p>
          <div className="mx-auto mt-3 inline-flex rounded-full bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("scan")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                mode === "scan"
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              <ScanLine className="size-3.5" />
              Scan QR
            </button>
            <button
              type="button"
              onClick={() => switchMode("email")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                mode === "email"
                  ? "bg-primary text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900",
              )}
            >
              <Mail className="size-3.5" />
              Enter email
            </button>
          </div>
        </header>

        <div className="relative flex flex-1 items-center justify-center">
          {mode === "scan" && (
            <div className="size-64 rounded-2xl border-4 border-white shadow-[0_0_0_9999px_rgba(255,255,255,0.65)]">
              {phase === "scanning" && (
                <ScanLine className="mx-auto mt-28 size-10 text-primary/50" />
              )}
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close scanner"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/90 text-primary shadow"
          >
            <X className="size-5" />
          </button>
        </div>

        <footer className="relative z-10 space-y-3 bg-white/95 p-4">
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          {phase === "scanning" && mode === "scan" && (
            <p className="text-center text-sm text-gray-600">
              Point the camera at an attendee&apos;s QR badge.
            </p>
          )}

          {phase === "scanning" && mode === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="relative">
                {showSuggestions && (
                  <div className="absolute inset-x-0 bottom-full z-20 mb-2 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                    {suggestions.map((suggestion) => {
                      const suggestionName =
                        [suggestion.first_name, suggestion.last_name]
                          .filter(Boolean)
                          .join(" ") ||
                        suggestion.email ||
                        "Attendee";
                      return (
                        <button
                          key={suggestion.id}
                          type="button"
                          onClick={() => selectSuggestion(suggestion)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                            {initials(
                              suggestion.first_name ?? "",
                              suggestion.last_name ?? "",
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-900">
                              {suggestionName}
                            </span>
                            {suggestion.email && (
                              <span className="block truncate text-xs text-gray-500">
                                {suggestion.email}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoFocus
                  placeholder="Name or email…"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    if (value.trim().length < 2) {
                      setSuggestions([]);
                      setShowSuggestions(false);
                      setSearching(false);
                    }
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setShowSuggestions(false);
                  }}
                  className="h-11 pr-9 text-base"
                />
                {searching && (
                  <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-gray-400" />
                )}
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={!email.trim()}
              >
                <Search className="size-5" />
                Find attendee
              </Button>
            </form>
          )}

          {phase === "loading" && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-600">
              <Loader2 className="size-4 animate-spin" />
              Checking attendee...
            </div>
          )}

          {phase === "found" && attendee && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(
                    attendee.name.split(" ")[0],
                    attendee.name.split(" ")[1],
                  )}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-900">
                    {attendee.name || "Attendee"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {attendee.position
                      ? POSITION_LABELS[attendee.position]
                      : "Attendee"}
                  </p>
                </div>
              </div>
              <WristbandNotice color={attendee.wristband} />
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-28"
                  onClick={resetInput}
                >
                  Cancel
                </Button>
                <Button
                  size="lg"
                  onClick={checkIn}
                  className="flex-1 border-transparent bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  <CheckCircle2 className="size-5" />
                  Check-in
                </Button>
              </div>
            </div>
          )}

          {phase === "no-registration" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-destructive">
                  <XCircle className="size-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    No registration found
                  </p>
                  <p className="text-sm text-muted-foreground">
                    This attendee is not registered for this event.
                  </p>
                </div>
              </div>
              <Button size="lg" className="w-full" onClick={resetInput}>
                <ScanLine className="size-5" />
                {resetLabel}
              </Button>
            </div>
          )}

          {phase === "checked-in" && attendee && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {attendee.name || "Attendee"} checked in
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Attendance recorded successfully.
                  </p>
                </div>
              </div>
              <WristbandNotice color={attendee.wristband} />
              <Button size="lg" className="w-full" onClick={resetInput}>
                <ScanLine className="size-5" />
                {resetLabel}
              </Button>
            </div>
          )}

          {phase === "already-checked-in" && attendee && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Info className="size-6" />
                </span>
                <div>
                  <p className="text-base font-semibold text-gray-900">
                    {attendee.name || "Attendee"} already checked in
                  </p>
                  <p className="text-sm text-muted-foreground">
                    They have already been checked in today.
                  </p>
                </div>
              </div>
              <WristbandNotice color={attendee.wristband} />
              <Button size="lg" className="w-full" onClick={resetInput}>
                <ScanLine className="size-5" />
                {resetLabel}
              </Button>
            </div>
          )}

          <Button variant="ghost" className="w-full" onClick={onClose}>
            <UserRound className="size-4" />
            Close scanner
          </Button>
        </footer>
      </div>
    </div>
  );
}

function WristbandNotice({ color }: { color: string | null }) {
  const colors = parseWristbands(color);
  if (colors.length === 0) return null;
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
        {colors.length === 1
          ? "Give wristband"
          : `Give ${colors.length} wristbands`}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {colors.map((c) => (
          <span key={c} className="flex items-center gap-2">
            <span
              className="size-7 shrink-0 rounded-full border border-gray-300 bg-gray-200"
              style={{ backgroundColor: wristbandSwatch(c) }}
            />
            <span className="text-base font-semibold text-gray-900">{c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

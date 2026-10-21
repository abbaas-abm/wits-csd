"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { OtpInput } from "@/components/auth/OtpInput";
import { createClient } from "@/lib/supabase/client";

const emailSchema = z.object({
  email: z
    .string()
    .min(1, "Your email is required")
    .email("Enter a valid email address"),
});

type EmailValues = z.infer<typeof emailSchema>;

export function AuthGateway({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();

  const [step, setStep] = React.useState<"email" | "otp">("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function dispatchOtp(targetEmail: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: targetEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/onboarding`
            : undefined,
      },
    });
    if (error) throw error;
  }

  async function onSubmitEmail(values: EmailValues) {
    setSending(true);
    try {
      const target = values.email.trim();
      await dispatchOtp(target);
      setEmail(target);
      setOtp("");
      setStep("otp");
      setCooldown(30);
      toast.success("We sent a 6-digit code to your email.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not send the code. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function resolveDestination(userId: string, userEmail?: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("onboarding, role")
      .eq("id", userId)
      .maybeSingle();

    if (!data) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          email: userEmail ?? email,
          role: "user",
          onboarding: "PERSONAL_DETAILS",
        },
        { onConflict: "id" },
      );
      return "/onboarding";
    }

    if (data.onboarding === "DONE") {
      if (data.role === "admin") {
        return redirectTo && redirectTo.startsWith("/admin")
          ? redirectTo
          : "/admin";
      }
      return redirectTo && redirectTo.startsWith("/") ? redirectTo : "/user";
    }
    return "/onboarding";
  }

  async function verify(code: string) {
    if (code.length !== 6) return;
    setVerifying(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;

      const destination = data.user
        ? await resolveDestination(data.user.id, data.user.email)
        : "/onboarding";

      toast.success("Verified. Welcome to the CSD.");
      router.refresh();
      router.push(destination);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "That code is invalid or expired.",
      );
      setOtp("");
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setResending(true);
    try {
      await dispatchOtp(email);
      setCooldown(30);
      toast.success("A new code is on its way.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not resend the code.",
      );
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div className="pointer-events-none fixed inset-0 hidden pwa:block">
        <Image
          src="/wits-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-primary/85" />
      </div>

      <aside className="relative hidden flex-col justify-between bg-primary p-10 text-white lg:flex">
        <Image
          src="/wits-logo-light.png"
          alt="University of the Witwatersrand"
          width={164}
          height={100}
          priority
          className="h-12 w-auto self-start"
        />
        <div>
          <h2 className="text-2xl font-semibold leading-tight text-white">
            Centre for Student Development
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/80">
            Integrating leadership, civic engagement, governance and
            persistence support to create empowered, well-rounded Wits
            graduates.
          </p>
        </div>
        <p className="text-xs text-white/60">
          University of the Witwatersrand, Johannesburg
        </p>
      </aside>

      <div className="relative z-10 flex flex-col">
        <div className="flex items-center justify-center bg-primary px-6 py-5 lg:hidden">
          <Image
            src="/wits-logo-light.png"
            alt="University of the Witwatersrand"
            width={148}
            height={90}
            priority
            className="h-10 w-auto"
          />
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-sm">
            {step === "email" ? (
              <div key="email" className="animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight pwa:text-white">
                    Sign in or create your account
                  </h1>
                  <p className="text-sm text-muted-foreground pwa:text-white/80">
                    Enter your email. We will send you a one-time code, so no
                    password is needed.
                  </p>
                </div>

                <form
                  onSubmit={form.handleSubmit(onSubmitEmail)}
                  className="mt-6 space-y-4"
                >
                  <div className="space-y-2">
                    <InputGroup className="h-11 pwa:border-white/30 pwa:bg-white/10">
                      <InputGroupAddon
                        align="inline-start"
                        className="pwa:text-white/70"
                      >
                        <Mail />
                      </InputGroupAddon>
                      <InputGroupInput
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        aria-invalid={Boolean(form.formState.errors.email)}
                        className="pwa:text-white pwa:placeholder:text-white/50"
                        {...form.register("email")}
                      />
                    </InputGroup>
                    {form.formState.errors.email && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="h-11 w-full pwa:bg-white pwa:text-primary pwa:hover:bg-slate-100"
                    disabled={sending}
                  >
                    {sending && (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    )}
                    {sending ? "Sending code..." : "Continue with email"}
                  </Button>
                </form>

                <p className="mt-6 text-center text-xs text-muted-foreground pwa:text-white/60">
                  By continuing you agree to Wits University&apos;s policies and
                  terms of use.
                </p>
              </div>
            ) : (
              <div key="otp" className="animate-in fade-in duration-300">
                <div className="space-y-1.5">
                  <h1 className="text-2xl font-semibold tracking-tight pwa:text-white">
                    Enter your verification code
                  </h1>
                  <p className="text-sm text-muted-foreground pwa:text-white/80">
                    We sent a 6-digit code to{" "}
                    <span className="font-medium text-foreground pwa:text-white">
                      {email}
                    </span>
                    . It expires in 10 minutes.
                  </p>
                </div>

                <div className="mt-6">
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    onComplete={verify}
                    disabled={verifying}
                  />
                </div>

                <Button
                  className="mt-5 h-11 w-full pwa:bg-white pwa:text-primary pwa:hover:bg-slate-100"
                  onClick={() => verify(otp)}
                  disabled={verifying || otp.length !== 6}
                >
                  {verifying && (
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                  )}
                  {!verifying && <ShieldCheck data-icon="inline-start" />}
                  {verifying ? "Verifying..." : "Verify and continue"}
                </Button>

                <div className="mt-4 flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp("");
                    }}
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground pwa:text-white/80 pwa:hover:text-white"
                  >
                    <ArrowLeft className="size-4" />
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={cooldown > 0 || resending}
                    className="font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50 pwa:text-white pwa:hover:text-white"
                  >
                    {resending
                      ? "Resending..."
                      : cooldown > 0
                        ? `Resend in ${cooldown}s`
                        : "Resend code"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

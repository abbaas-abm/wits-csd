"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  FACULTY_OPTIONS,
  GENDER_OPTIONS,
  RESIDENCE_OPTIONS,
  WITS_RESIDENCE_OPTION,
  WITS_RESIDENCE_OPTIONS,
  YEAR_OPTIONS,
} from "@/lib/profile-options";
import type { Profile, UserPosition } from "@/lib/types";

type Values = {
  first_name: string;
  last_name: string;
  gender: string;
  phone_number: string;
  position: UserPosition | "";
  person_number: string;
  faculty: string;
  course_of_study: string;
  year_of_study: string;
  place_of_residence: string;
  university_res: string;
};

type QuestionKey = keyof Values;

interface Question {
  key: QuestionKey;
  question: string;
  hint?: string;
  type: "text" | "tel" | "select" | "position";
  placeholder?: string;
  options?: string[];
  optional?: boolean;
}

const PERSONAL_QUESTIONS: Question[] = [
  {
    key: "first_name",
    question: "What is your first name?",
    type: "text",
    placeholder: "e.g. Thandi",
  },
  {
    key: "last_name",
    question: "And your surname?",
    type: "text",
    placeholder: "e.g. Mokoena",
  },
  {
    key: "gender",
    question: "How do you identify?",
    type: "select",
    options: [...GENDER_OPTIONS],
  },
  {
    key: "phone_number",
    question: "What is your contact number?",
    hint: "Used only for event logistics and reminders.",
    type: "tel",
    placeholder: "e.g. 072 123 4567",
  },
];

function academicQuestions(
  position: UserPosition | "",
  placeOfResidence: string,
): Question[] {
  const base: Question[] = [
    {
      key: "position",
      question: "How are you joining us?",
      type: "position",
    },
  ];

  if (position === "GUEST" || position === "GUEST_SPEAKER") {
    return base;
  }

  if (position === "STAFF") {
    return [
      ...base,
      {
        key: "person_number",
        question: "What is your staff ID number?",
        type: "text",
        placeholder: "e.g. 1234567",
      },
    ];
  }

  const studentQuestions: Question[] = [
    ...base,
    {
      key: "person_number",
      question: "What is your student number?",
      type: "text",
      placeholder: "e.g. 1234567",
    },
    {
      key: "faculty",
      question: "Which faculty are you in?",
      type: "select",
      options: FACULTY_OPTIONS,
    },
    {
      key: "course_of_study",
      question: "What are you studying?",
      type: "text",
      placeholder: "e.g. BSc Computer Science",
    },
    {
      key: "year_of_study",
      question: "Which year of study are you in?",
      type: "select",
      options: YEAR_OPTIONS,
    },
    {
      key: "place_of_residence",
      question: "What is your current place of residence?",
      type: "select",
      options: RESIDENCE_OPTIONS,
    },
  ];

  if (placeOfResidence === WITS_RESIDENCE_OPTION) {
    studentQuestions.push({
      key: "university_res",
      question: "Which Wits University residence do you currently live in?",
      type: "select",
      options: WITS_RESIDENCE_OPTIONS,
    });
  }

  return studentQuestions;
}

export function OnboardingFlow({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<"PERSONAL" | "ACADEMIC">(
    profile.onboarding === "ACADEMIC_DETAILS" ? "ACADEMIC" : "PERSONAL",
  );
  const [index, setIndex] = React.useState(0);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<Values>({
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    gender: profile.gender ?? "",
    phone_number: profile.phone_number ?? "",
    position: profile.position ?? "",
    person_number: profile.person_number ?? "",
    faculty: profile.faculty ?? "",
    course_of_study: profile.course_of_study ?? "",
    year_of_study: profile.year_of_study ?? "",
    place_of_residence: profile.place_of_residence ?? "",
    university_res: profile.university_res ?? "",
  });

  const questions =
    phase === "PERSONAL"
      ? PERSONAL_QUESTIONS
      : academicQuestions(values.position, values.place_of_residence);

  const totalEstimate =
    PERSONAL_QUESTIONS.length +
    academicQuestions(values.position || "STUDENT", values.place_of_residence)
      .length;

  const completed =
    phase === "PERSONAL" ? index : PERSONAL_QUESTIONS.length + index;
  const progress = Math.round((completed / totalEstimate) * 100);

  const question = questions[Math.min(index, questions.length - 1)];
  const isLast =
    phase === "PERSONAL"
      ? index === PERSONAL_QUESTIONS.length - 1
      : index >= questions.length - 1;

  const currentValue = values[question?.key ?? "first_name"];

  function setValue(key: QuestionKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function validate(): boolean {
    if (!question) return true;
    const value = String(currentValue ?? "").trim();
    if (question.type === "position" && !value) {
      toast.error("Please choose an option to continue.");
      return false;
    }
    if (question.optional) return true;
    if (value.length < 1) {
      toast.error("This field is required.");
      return false;
    }
    if (
      question.key === "phone_number" &&
      value.replace(/\D/g, "").length < 9
    ) {
      toast.error("Please enter a valid contact number.");
      return false;
    }
    return true;
  }

  async function savePersonal() {
    const supabase = createClient();
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        gender: values.gender || null,
        phone_number: values.phone_number.trim() || null,
        onboarding: "ACADEMIC_DETAILS",
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  async function saveAcademic() {
    const supabase = createClient();
    const isStudent = values.position === "STUDENT";
    const isGuest =
      values.position === "GUEST" || values.position === "GUEST_SPEAKER";
    const { error } = await supabase.from("profiles").upsert(
      {
        id: profile.id,
        email: profile.email,
        position: values.position || null,
        person_number: isGuest ? null : values.person_number.trim() || null,
        faculty: isStudent ? values.faculty || null : null,
        course_of_study: isStudent
          ? values.course_of_study.trim() || null
          : null,
        year_of_study: isStudent ? values.year_of_study || null : null,
        place_of_residence: isStudent
          ? values.place_of_residence || null
          : null,
        university_res:
          isStudent && values.place_of_residence === WITS_RESIDENCE_OPTION
            ? values.university_res || null
            : null,
        onboarding: "DONE",
      },
      { onConflict: "id" },
    );
    if (error) throw error;
  }

  async function goNext() {
    if (!validate()) return;

    if (!isLast) {
      setIndex((i) => i + 1);
      return;
    }

    setSaving(true);
    try {
      if (phase === "PERSONAL") {
        await savePersonal();
        setPhase("ACADEMIC");
        setIndex(0);
        toast.success("Great. Now let's finish your academic details.");
      } else {
        await saveAcademic();
        toast.success("Your profile is complete. Welcome to the CSD.");
        router.refresh();
        router.push(profile.role === "admin" ? "/admin" : "/user");
      }
    } catch (error) {
      // Supabase errors are plain objects, not Error instances.
      console.error("Onboarding save failed:", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "";
      toast.error(
        message.includes("profiles_phone_number_key")
          ? "This contact number is already linked to another account. Please use a different number, or sign in with the email you used before."
          : message || "Could not save your details. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    if (index > 0) {
      setIndex((i) => i - 1);
      return;
    }
    if (phase === "ACADEMIC") {
      setPhase("PERSONAL");
      setIndex(PERSONAL_QUESTIONS.length - 1);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && question?.type !== "select") {
      event.preventDefault();
      goNext();
    }
  }

  return (
    <Card className="border-gray-200 p-7 sm:p-9">
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-gray-500">
          <span>
            Step {phase === "PERSONAL" ? "1" : "2"} of 2 ·{" "}
            {phase === "PERSONAL" ? "Personal details" : "Academic details"}
          </span>
          <span className="text-primary">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-3" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${phase}-${index}`}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
        >
          <div className="mb-6 flex items-start gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-medium text-white">
              {completed + 1}
            </span>
            <div>
              <h2 className="text-xl font-semibold leading-snug text-gray-900 sm:text-2xl">
                {question?.question}
              </h2>
              {question?.hint && (
                <p className="mt-1.5 text-sm text-gray-500">{question.hint}</p>
              )}
            </div>
          </div>

          <div onKeyDown={handleKeyDown}>
            {question?.type === "position" ? (
              <div className="grid gap-3">
                {(
                  [
                    {
                      value: "STUDENT",
                      badge: "S",
                      label: "Student",
                      description: "Currently enrolled at Wits",
                    },
                    {
                      value: "STAFF",
                      badge: "F",
                      label: "Staff",
                      description: "Wits employee or academic",
                    },
                    {
                      value: "GUEST",
                      badge: "G",
                      label: "Guest",
                      description: "External or non-university guest",
                    },
                  ] as {
                    value: UserPosition;
                    badge: string;
                    label: string;
                    description: string;
                  }[]
                ).map((option) => {
                  const active = values.position === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue("position", option.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                        active
                          ? "border-primary bg-blue-50"
                          : "border-gray-200 bg-white hover:bg-slate-50",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-md text-sm font-medium",
                          active
                            ? "bg-primary text-white"
                            : "bg-slate-100 text-gray-600",
                        )}
                      >
                        {option.badge}
                      </span>
                      <span className="flex-1">
                        <span className="block font-medium text-gray-900">
                          {option.label}
                        </span>
                        <span className="block text-xs text-gray-500">
                          {option.description}
                        </span>
                      </span>
                      {active && (
                        <Check className="ml-auto size-5 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : question?.type === "select" ? (
              <Select
                value={String(currentValue)}
                onValueChange={(value) => {
                  if (question) setValue(question.key, value);
                }}
              >
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  {question.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                autoFocus
                type={question?.type === "tel" ? "tel" : "text"}
                inputMode={question?.type === "tel" ? "tel" : "text"}
                placeholder={question?.placeholder}
                value={String(currentValue)}
                onChange={(e) => {
                  if (question) setValue(question.key, e.target.value);
                }}
                className="h-12 text-base"
              />
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={goBack}
          disabled={phase === "PERSONAL" && index === 0}
          className="disabled:opacity-30"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button type="button" size="lg" onClick={goNext} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : isLast ? (
            <Check className="size-4" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {saving ? "Saving..." : isLast ? "Finish" : "Next"}
        </Button>
      </div>

      <p className="mt-5 text-center text-xs text-gray-400">
        Press Enter to continue. Your information is stored securely.
      </p>
    </Card>
  );
}

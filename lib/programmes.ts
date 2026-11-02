/**
 * Static content for the homepage: the kinds of programmes and events the
 * Development and Leadership Unit hosts on this platform. Deliberately about
 * what students can attend, not about the unit itself — that lives on the
 * official DLU site (DLU_SITE).
 */
export const DLU_SITE = "https://www.wits.ac.za/students/development-and-leadership-unit/";

export const DLU_EMAIL = "Programmes.DLU@wits.ac.za";

export const DLU_CONTACT = {
  office: "First floor, Student Union Building (Matrix), East Campus",
  phone: "+27 (0)11 717 9234",
  instagram: { handle: "@dlu_wits", href: "https://www.instagram.com/dlu_wits/" },
};

// The three ways the DLU builds its programmes, and the ideas they explore,
// as described on the official DLU site.
export const APPROACHES = [
  {
    title: "Customised Programming",
    text: "Sessions shaped with a student structure or group around what its leaders need.",
  },
  {
    title: "Experiential Learning",
    text: "Learning by doing: camps, projects and immersive experiences beyond the lecture hall.",
  },
  {
    title: "Critical Engagement",
    text: "Spaces to think, debate and question with peers, staff and guest speakers.",
  },
];

export const THEMES = [
  "Excellence",
  "Innovation",
  "Collaboration",
  "Impact",
  "Diversity",
  "Leading in relation to others",
];

export type FeatureIcon = "calendar" | "ticket" | "qr" | "messages" | "pen" | "star";

export const PLATFORM_FEATURES: { title: string; icon: FeatureIcon; text: string }[] = [
  {
    title: "Event pages",
    icon: "calendar",
    text: "Dates, venue, the full programme and speakers for every DLU event.",
  },
  {
    title: "Registration",
    icon: "ticket",
    text: "Reserve a seat in a few taps and see all your registrations in one dashboard.",
  },
  {
    title: "QR check-in",
    icon: "qr",
    text: "A personal event pass that our support team scans at the door.",
  },
  {
    title: "Live Q&A",
    icon: "messages",
    text: "Send questions to speakers during a session, straight from your phone.",
  },
  {
    title: "Pledges & reflections",
    icon: "pen",
    text: "Commit to what you'll do next and share what you took away.",
  },
  {
    title: "Feedback",
    icon: "star",
    text: "Tell us how it went, so the next programme is better.",
  },
];

export type ProgrammeIcon =
  | "compass"
  | "messages"
  | "users"
  | "rocket"
  | "sparkles"
  | "award";

export interface Programme {
  title: string;
  icon: ProgrammeIcon;
  text: string;
  formats: string[];
}

export const FLAGSHIP = {
  eyebrow: "Flagship programme",
  title: "Emerging Leaders Programme",
  text: "A three-month experiential leadership journey that has run for almost two decades. Participants learn about leading in relation to others, team dynamics and project management, then put it into practice through a legacy project of their own.",
  stages: [
    { title: "Winter Leadership Camp", text: "A one-week residential camp that opens the programme." },
    { title: "Legacy project", text: "Participants design and run a project using design thinking." },
    { title: "Legacy Project Symposium", text: "Projects are presented to peers, staff and partners." },
  ],
  outcome: "Wits Short Course Certificate on completion",
};

export const PROGRAMMES: Programme[] = [
  {
    title: "Personal & Leadership Development",
    icon: "compass",
    text: "Workshops and seminars for students who want to grow personally and lead with purpose.",
    formats: ["Leadership workshops", "Skills seminars", "Leadership camps"],
  },
  {
    title: "Critical Engagements",
    icon: "messages",
    text: "Dialogues that take on contemporary social, political and academic questions with students, staff and guest speakers.",
    formats: ["Roundtables", "Panel discussions", "Dialogues & debates"],
  },
  {
    title: "Customised Programming",
    icon: "users",
    text: "Development sessions designed with student structures around what their leaders need.",
    formats: ["House Committees", "Student councils", "Clubs & societies"],
  },
  {
    title: "Entrepreneurship Hub",
    icon: "rocket",
    text: "Sessions that help students build an entrepreneurial mindset and turn ideas into ventures.",
    formats: ["Masterclasses", "Pitch sessions", "Networking forums"],
  },
  {
    title: "Campus Activations",
    icon: "sparkles",
    text: "Interactive experiences on campus that connect students with brands and industry.",
    formats: ["Brand activations", "Campus campaigns", "Giveaways"],
  },
  {
    title: "Recognition & Conferences",
    icon: "award",
    text: "Annual moments that celebrate student leadership and bring student leaders together.",
    formats: ["Student Leadership Awards", "Student Leadership Conference"],
  },
];

export const HOW_IT_WORKS = [
  {
    title: "Find an event",
    text: "Browse upcoming programmes and open any event for its details, programme and speakers.",
  },
  {
    title: "Register with your account",
    text: "Sign in once and reserve your seat. Your registrations are kept together in your dashboard.",
  },
  {
    title: "Show your pass at the door",
    text: "Your personal QR pass gets you checked in quickly on the day.",
  },
  {
    title: "Take part",
    text: "Follow the programme, ask questions and share feedback during and after the session.",
  },
];

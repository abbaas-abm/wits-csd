/**
 * Static content for the 2026 Student Leadership Awards, shown on the
 * homepage and the About page. The venue is deliberately not published —
 * the ceremony is by invitation only.
 */
export const AWARDS = {
  year: 2026,
  title: "Student Leadership Awards",
  // Matches the event's start time in admin (17:30 SAST).
  date: "2026-10-23T17:30:00+02:00",
  dateLabel: "Friday, 23 October 2026 · 17:30",
  dateShort: "23 October 2026",
};

// Wording below is taken from the official 2026 SLA information pack.
export const AWARDS_ABOUT =
  "The Student Leadership Awards seek to recognise the contribution of students in co-curricular and extra-curricular activities, entrepreneurial and innovative thinking, social impact and selfless contributions to the Wits community, and communities beyond the University. In celebrating our students, we pay particular attention to acknowledging students who have displayed distinctive leadership attributes in line with the mission and values of the University, and who give meaning to the idea of #WitsForGood.";

export const AWARDS_ENQUIRIES = {
  email: "Programmes.DLU@wits.ac.za",
  subject: "SLA 2026",
};

export const AWARDS_THEMES = [
  {
    title: "Academic Engagement Leadership",
    text: "Students who take ownership of their learning journey by actively pursuing academic excellence, and who create space for their peers to feel supported and to voice challenges about their academic success.",
  },
  {
    title: "Peer Leadership",
    text: "Students who share knowledge by inspiring and motivating others through mentoring, advocacy, sport and peer support, modelling consistent, value-based leadership centred on service.",
  },
  {
    title: "Thought Leadership",
    text: "Reflective and reflexive leaders who demonstrate agency in their context, provide unique guidance, inspire innovation and influence others through advocacy, awareness raising, dialogue and debate.",
  },
  {
    title: "Service Leadership",
    text: "Individual and collective acts of service in response to the challenges and needs within communities, showing shared responsibility and responsiveness through social development.",
  },
  {
    title: "Collaborative Leadership",
    text: "Structures that remain active through their collective leadership, drawing on the skills in their student and university networks, inviting different voices into decisions and partnering on delivery.",
  },
  {
    title: "Innovative and Entrepreneurial Leadership",
    text: "Leaders who apply creativity to inspire people and spearhead projects, finding new approaches, especially in times of ambiguity and uncertainty, and extending themselves into uncharted areas.",
  },
];

export const AWARDS_CATEGORIES = [
  "Most Outstanding School Student Council",
  "Most Outstanding Student Leader in a School Student Council",
  "Most Outstanding Class Representative",
  "Most Outstanding Student Leader at a Postgraduate Level",
  "Most Outstanding Student in Peer Mentorship",
  "Most Outstanding Student Leader Advocating for Students Living with Disabilities",
  "Most Outstanding Contribution made by an SRC Member/Members",
  "Most Outstanding Student Leader in a University Residence House Committee",
  "Most Outstanding House Committee",
  "Most Outstanding Student Club, Society or Organisation (CSO)",
  "Most Outstanding Project/Initiative by a House Committee",
  "Most Outstanding Project in a School Student Council",
  "Most Outstanding Community Engagement Project by a Club/Society",
  "Champion of Service",
  "Sports Student Leader of the Year",
  "Most Outstanding Student Leader or Student Leadership Structure in Promoting Critical Thinking and Thought Leadership",
  "Social Innovator",
  "Student Entrepreneur of the Year",
];

export const AWARDS_PHOTOS = {
  hero: { src: "/awards/hero-group.jpg", alt: "Award recipients celebrating on stage" },
  cheque: {
    src: "/awards/vc-leader-cheque.jpg",
    alt: "The Vice-Chancellor's Student Leader of the Year receiving the award",
  },
  team: { src: "/awards/team-award.jpg", alt: "A student leadership team with their award" },
  society: { src: "/awards/society-award.jpg", alt: "A student society celebrating its award on stage" },
  winners: { src: "/awards/winners-group.jpg", alt: "Award winners with their certificates and medals" },
  certificate: { src: "/awards/certificate.jpg", alt: "A student leader receiving a certificate and trophy" },
  trophy: { src: "/awards/trophy.jpg", alt: "A student leader holding a trophy" },
  handshake: { src: "/awards/handshake.jpg", alt: "An award recipient shaking hands with a presenter" },
};

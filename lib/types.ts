export type UserPosition = "STUDENT" | "STAFF" | "GUEST" | "GUEST_SPEAKER";
export type UserRole = "user" | "volunteer" | "admin";
export type OnboardingStep = "PERSONAL_DETAILS" | "ACADEMIC_DETAILS" | "DONE";

export type EventMode = "ONLINE" | "IN_PERSON";
export type EventStatus = "OPEN" | "CLOSED" | "ENDED";
export type RegistrationStatus = "CONFIRMED" | "CANCELLED";
export type ProgramBlockType =
  | "KEYNOTE"
  | "PANEL_DISCUSSION"
  | "WORKSHOP"
  | "NETWORKING"
  | "BREAK"
  | "ENTERTAINMENT"
  | "QA_SESSION"
  | "OTHER";

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone_number: string | null;
  position: UserPosition | null;
  role: UserRole;
  gender: string | null;
  person_number: string | null;
  faculty: string | null;
  course_of_study: string | null;
  year_of_study: string | null;
  place_of_residence: string | null;
  university_res: string | null;
  onboarding: OnboardingStep;
  created_at: string;
  updated_at: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description: string | null;
  theme: string | null;
  about: string | null;
  start_date: string;
  end_date: string;
  venue: string | null;
  mode: EventMode;
  status: EventStatus;
  featured_image_url: string | null;
  featured_image_key: string | null;
  cover_image_url: string | null;
  cover_image_key: string | null;
  has_information: boolean;
  has_about: boolean;
  has_programme: boolean;
  has_speakers: boolean;
  has_media: boolean;
  has_pledges: boolean;
  has_reflections: boolean;
  has_feedback: boolean;
  has_featured: boolean;
  has_side_notch: boolean;
  has_questions: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventFeatured {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export interface Speaker {
  id: string;
  event_id: string | null;
  first_name: string;
  last_name: string;
  gender: string | null;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
  speaker_order: number | null;
  created_at: string;
}

export interface ProgramBlock {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  display_order: number;
  day_number: number;
  type: ProgramBlockType;
  created_at: string;
}

export type GalleryMediaType = "image" | "video";

export interface EventGalleryImage {
  id: string;
  event_id: string;
  file_name: string;
  /** Image file, or a video's poster (or the video file itself). */
  image_url: string;
  object_key: string | null;
  display_order: number;
  album: string | null;
  media_type: GalleryMediaType;
  /** YouTube link or uploaded video file; null for images. */
  video_url: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  event_id: string | null;
  text: string;
  created_at: string;
}

export interface AnnouncementWithEvent extends Announcement {
  event: { id: string; title: string } | null;
}

export interface Reflection {
  id: string;
  event_id: string | null;
  user_id: string | null;
  content: string;
  created_at: string;
}

export interface ReflectionWithUser extends Reflection {
  user: { first_name: string | null; last_name: string | null } | null;
}

export interface Pledge {
  id: string;
  user_id: string | null;
  event_id: string | null;
  pledge_text: string;
  pledge_document_url: string | null;
  created_at: string;
}

export interface PledgeWithUser extends Pledge {
  user: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
}

export interface Registration {
  id: string;
  attendee_id: string;
  event_id: string;
  position: UserPosition | null;
  status: RegistrationStatus;
  attendee_tag_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Feedback {
  id: string;
  event_id: string;
  attendee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface QnaQuestion {
  id: string;
  event_id: string;
  user_id: string;
  speaker_id: string | null;
  question: string;
  answered: boolean;
  created_at: string;
  updated_at: string;
}

export interface QnaQuestionWithRelations extends QnaQuestion {
  user: { first_name: string | null; last_name: string | null } | null;
  speaker: {
    first_name: string;
    last_name: string;
    title: string | null;
    avatar_url: string | null;
  } | null;
}

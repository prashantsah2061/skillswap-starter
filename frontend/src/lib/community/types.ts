export type Skill = { id: string; name: string; category_id: string | null };
export type Category = { id: string; name: string };
export type Selection = {
  skill_id: string;
  direction: "teach" | "learn";
  level: "beginner" | "intermediate" | "advanced";
};
export type Member = {
  id: string;
  display_name: string;
  city: string;
  bio: string;
  visible: boolean;
  onboarded: boolean;
  user_skills?: Selection[];
};
export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  preview: string | null;
  latest_at: string;
  unread: number;
  member?: Member;
};
export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type Session = {
  id: string;
  match_id: string;
  proposer_id: string;
  partner?: { id: string; display_name: string };
  topic: string;
  starts_at: string;
  duration_minutes: number;
  notes: string;
  meeting_url: string;
  status: "pending" | "accepted" | "declined" | "cancelled" | "completed";
};
export type CommunityState = {
  userId: string;
  profile: Member;
  selections: Selection[];
  skills: Skill[];
  categories: Category[];
  counts: Record<string, number>;
};

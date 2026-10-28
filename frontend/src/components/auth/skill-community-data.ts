export type AvatarKind = "programmer" | "guitarist" | "chef" | "artist" | "athlete" | "tutor" | "scientist" | "photographer" | "dancer" | "gardener" | "business" | "maker";
export type CommunitySkill = { id: AvatarKind; name: string; category: string; detail: string; color: string; skin: string; hair: string; shirt: string };
export const communitySkills: CommunitySkill[] = [
  { id: "programmer", name: "Creative coding", category: "Technology", detail: "Make ideas come to life", color: "#7abfff", skin: "#bd7957", hair: "#292b4a", shirt: "#7d9de4" },
  { id: "guitarist", name: "Playing guitar", category: "Music", detail: "Find your own rhythm", color: "#ffc47c", skin: "#eab895", hair: "#64413b", shirt: "#cda0e5" },
  { id: "chef", name: "Home cooking", category: "Cooking", detail: "A little love in every recipe", color: "#ffac9b", skin: "#89543e", hair: "#332a35", shirt: "#f5dfc1" },
  { id: "artist", name: "Painting", category: "Arts", detail: "See things in a new color", color: "#dba8ff", skin: "#e4a68a", hair: "#34334f", shirt: "#d69bc0" },
  { id: "athlete", name: "Basketball", category: "Sports", detail: "Build confidence, one shot at a time", color: "#ffbc71", skin: "#704731", hair: "#27252d", shirt: "#7fbab0" },
  { id: "tutor", name: "Everyday Spanish", category: "Languages", detail: "Open a whole new conversation", color: "#8fe0db", skin: "#c88b65", hair: "#493c43", shirt: "#80bfc3" },
  { id: "scientist", name: "Science experiments", category: "Science", detail: "Stay curious about the world", color: "#9fc7ff", skin: "#f0c6a4", hair: "#d9d5e6", shirt: "#dbe9f2" },
  { id: "photographer", name: "Photography", category: "Photography", detail: "Capture a different perspective", color: "#eeabdc", skin: "#ad7050", hair: "#352e41", shirt: "#b6a2de" },
  { id: "dancer", name: "Dance", category: "Movement", detail: "Express yourself through movement", color: "#f8a5bd", skin: "#6b4334", hair: "#2a293a", shirt: "#e39cb5" },
  { id: "gardener", name: "Growing a garden", category: "Practical skills", detail: "Grow something good together", color: "#a7dd9f", skin: "#dba47a", hair: "#6e625b", shirt: "#9abc83" },
  { id: "business", name: "Small business", category: "Business", detail: "Turn a passion into a plan", color: "#aaaaff", skin: "#8d583e", hair: "#292c41", shirt: "#aaa3de" },
  { id: "maker", name: "Everyday repairs", category: "Practical skills", detail: "Fix it, make it, share it", color: "#e3c78f", skin: "#f0bca0", hair: "#9d6647", shirt: "#c6a17c" },
];
export const desktopSlots = [{ x: .16, y: .17 }, { x: .50, y: .15 }, { x: .84, y: .17 }, { x: .15, y: .51 }, { x: .85, y: .51 }, { x: .31, y: .84 }, { x: .69, y: .84 }];
export const compactSlots = [{ x: .23, y: .22 }, { x: .77, y: .22 }, { x: .23, y: .77 }, { x: .77, y: .77 }];

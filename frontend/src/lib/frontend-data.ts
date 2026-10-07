// Fictional, frontend-only fixtures. Backend services intentionally remain separate.
export const categories = [
  {
    id: "living",
    name: "Everyday & living",
    icon: "⌂",
    examples: "Cooking · Budgeting · Home repair",
    subtitle: "Little skills for a richer everyday life.",
    skills: ["Cooking", "Budgeting", "Home repair"],
  },
  {
    id: "technical",
    name: "Technical skills",
    icon: "⌘",
    examples: "Python · Web development · Excel",
    subtitle: "Build something new, one skill at a time.",
    skills: [
      "Python",
      "Web development",
      "Excel",
      "SQL",
      "Figma",
      "Git & GitHub",
    ],
  },
  {
    id: "creative",
    name: "Creative skills",
    icon: "✿",
    examples: "Photography · Design · Music",
    subtitle: "Make space for your next creative idea.",
    skills: ["Photography", "UI design", "Guitar"],
  },
  {
    id: "languages",
    name: "Languages",
    icon: "☏",
    examples: "Spanish · French · Nepali",
    subtitle: "A new language. A whole new connection.",
    skills: ["Spanish", "French", "Nepali"],
  },
  {
    id: "wellness",
    name: "Wellness & movement",
    icon: "♧",
    examples: "Yoga · Dance · Fitness",
    subtitle: "Move, recharge, and grow together.",
    skills: ["Yoga", "Dance", "Fitness"],
  },
  {
    id: "career",
    name: "Career & business",
    icon: "▥",
    examples: "Public speaking · Resume writing · Marketing",
    subtitle: "Turn what you know into new opportunities.",
    skills: ["Public speaking", "Resume writing", "Marketing"],
  },
];
export const skillDetails: Record<
  string,
  { icon: string; description: string; group: string; level: string }
> = {
  Python: {
    icon: "Py",
    description:
      "A versatile programming language for data analysis, automation and building real-world projects.",
    group: "Coding",
    level: "Beginner friendly",
  },
  "Web development": {
    icon: "</>",
    description:
      "Learn to build modern websites with HTML, CSS and JavaScript.",
    group: "Coding",
    level: "All levels",
  },
  Excel: {
    icon: "X",
    description:
      "Work with data, create powerful spreadsheets and automate tasks with formulas.",
    group: "Data",
    level: "Beginner friendly",
  },
  SQL: {
    icon: "▤",
    description:
      "Query and analyse data to find insights and make better decisions.",
    group: "Data",
    level: "Intermediate",
  },
  Figma: {
    icon: "●",
    description:
      "Design modern user interfaces, collaborate in real time and bring ideas to life.",
    group: "Design tools",
    level: "Beginner friendly",
  },
  "Git & GitHub": {
    icon: "⑂",
    description:
      "Version control your projects and collaborate with confidence.",
    group: "Coding",
    level: "All levels",
  },
};
export const partners = [
  {
    id: "maya",
    name: "Maya Chen",
    city: "Newark, NJ",
    photo: "maya",
    bio: "I build with Python and want to learn how to design better interfaces. Let’s turn our ideas into something real.",
    teaches: ["Python", "SQL", "Excel", "Git & GitHub"],
    learns: ["Figma", "UI design"],
    mutual: true,
  },
  {
    id: "jordan",
    name: "Jordan Rivera",
    city: "Brooklyn, NY",
    photo: "jordan",
    bio: "Curious developer, weekend photographer, and a big believer in learning by doing.",
    teaches: ["Python", "Web development", "Photography"],
    learns: ["Figma", "Guitar"],
    mutual: false,
  },
  {
    id: "sam",
    name: "Sam Park",
    city: "Jersey City, NJ",
    photo: "alex",
    bio: "Always up for a new project. I’d love to trade coding tips for a little design inspiration.",
    teaches: ["Python", "Git & GitHub", "SQL"],
    learns: ["Figma", "Spanish"],
    mutual: true,
  },
  {
    id: "riley",
    name: "Riley Taylor",
    city: "New York, NY",
    photo: "jordan",
    bio: "Sharing the little things I’ve learned, from cooking to creative projects.",
    teaches: [
      "Cooking",
      "Budgeting",
      "Home repair",
      "Yoga",
      "Dance",
      "Fitness",
      "Guitar",
      "Spanish",
      "French",
      "Nepali",
      "Public speaking",
      "Resume writing",
      "Marketing",
      "Figma",
      "UI design",
      "Excel",
    ],
    learns: ["Figma", "Photography", "Python"],
    mutual: true,
  },
];
export type DemoProfile = {
  name: string;
  bio: string;
  city: string;
  photo: string;
  teaches: string[];
  learns: string[];
};
export type DemoMessage = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};
export type DemoSession = {
  id: string;
  partner: string;
  learn: string;
  teach: string;
  date: string;
  time: string;
  past: boolean;
};
export type DemoState = {
  profile: DemoProfile;
  matches: string[];
  messages: Record<string, DemoMessage[]>;
  sessions: DemoSession[];
};
export const initialDemo: DemoState = {
  profile: {
    name: "Alex Morgan",
    city: "Newark, NJ",
    photo: "alex",
    bio: "Designer, curious learner, and coffee enthusiast. I love helping people bring their ideas to life.",
    teaches: ["Figma", "UI design"],
    learns: ["Python"],
  },
  matches: ["maya"],
  messages: {
    maya: [
      {
        id: "1",
        text: "Hey Alex! Excited to swap Python for Figma with you.",
        mine: false,
        time: "10:24 AM",
      },
      {
        id: "2",
        text: "Me too! I’d love to start with Python basics.",
        mine: true,
        time: "10:26 AM",
      },
      {
        id: "3",
        text: "Perfect. We can build a little skill tracker together ☺",
        mine: false,
        time: "10:28 AM",
      },
    ],
  },
  sessions: [
    {
      id: "first",
      partner: "maya",
      learn: "Python",
      teach: "Figma",
      date: "2026-10-08",
      time: "13:00",
      past: false,
    },
    {
      id: "past",
      partner: "maya",
      learn: "SQL",
      teach: "UI design",
      date: "2026-09-29",
      time: "14:00",
      past: true,
    },
  ],
};

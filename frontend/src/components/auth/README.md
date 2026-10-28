Login/signup forms go here. Use client components only for interactive form behavior.

The illustrated login community is independent of authentication:

- `skill-community-data.ts` defines twelve fields, original-character colors, and responsive positions.
- `skill-avatar.tsx` contains original layered SVG characters made for this project; there are no third-party illustration/animation licenses or animation runtimes.
- `skill-scene.tsx` handles seven desktop/four phone cards, eight-second rotation, drag/keyboard/select-pair examples, live Motion-value SVG lines, and interaction/visibility/reduced-motion pauses.
- Character-specific CSS in `login.css` animates hands, tools, and poses. It does not bounce whole cards. The connection message is explicitly a demonstration, not a real match.

The community does not call Supabase or change login, signup, MFA, or recovery logic. Keep character changes isolated from the authentication actions.

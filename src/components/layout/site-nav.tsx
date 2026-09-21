import Link from "next/link";
export function SiteNav(){return <nav className="nav" aria-label="Main navigation"><Link className="brand" href="/">SkillSwap</Link><Link href="/discover">Discover</Link><Link href="/matches">Matches</Link><Link href="/messages">Messages</Link><Link href="/profile">My profile</Link><Link href="/login">Log in</Link></nav>}

import { demoProfiles } from "@/lib/demo-data";
import { SkillCard } from "@/components/discover/skill-card";
export default function Discover(){return <><h1>Discover skills</h1><p>Find someone you can learn from and teach in return.</p><div className="grid">{demoProfiles.map(p=><SkillCard key={p.id} profile={p}/>)}</div></>}

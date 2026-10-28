"use client";

import type { ReactNode } from "react";
import type { CommunitySkill } from "./skill-community-data";

// Original SVG illustrations made for SkillSwap. Each activity has independently
// animated hands/props; no external images, animation runtime, or user likenesses.
function Head({ skill, x = 66, y = 31, hat = false }: { skill: CommunitySkill; x?: number; y?: number; hat?: boolean }) {
  return <g className="avatar-head" style={{ transformOrigin: `${x}px ${y}px` }}>
    <path d={`M${x-13} ${y+1} Q${x-19} ${y-22} ${x} ${y-20} Q${x+20} ${y-21} ${x+14} ${y+6}`} fill={skill.hair} />
    <rect x={x-5} y={y+10} width="10" height="13" rx="4" fill={skill.skin} />
    <ellipse cx={x} cy={y} rx="13" ry="16" fill={skill.skin} />
    <path d={`M${x-14} ${y-3} Q${x-10} ${y-20} ${x+10} ${y-13} L${x+15} ${y-4} Q${x+6} ${y-8} ${x+1} ${y-13} Q${x-3} ${y-5} ${x-14} ${y-3}`} fill={skill.hair} />
    <path d={`M${x-5} ${y+1}h1 M${x+5} ${y+1}h1`} stroke="#343047" strokeWidth="2" strokeLinecap="round" />
    <path d={`M${x-3} ${y+8}q3 3 6 0`} stroke="#744a47" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    {skill.id === "scientist" && <g stroke="#6d7097" strokeWidth="1.4" fill="none"><circle cx={x-5} cy={y+1} r="4" /><circle cx={x+6} cy={y+1} r="4" /><path d={`M${x-1} ${y+1}h3`} /></g>}
    {skill.id === "tutor" && <path d={`M${x-14} ${y-3} Q${x-8} ${y-27} ${x+9} ${y-15} L${x+16} ${y+17} L${x+9} ${y+13} L${x+9} ${y-9}`} fill={skill.hair} />}
    {skill.id === "dancer" && <circle cx={x-9} cy={y-19} r="7" fill={skill.hair} />}
    {hat && <><path d={`M${x-16} ${y-10}v-10q-9-12 2-15q8-7 15 0q12-5 14 7q10 3 1 13v5Z`} fill="#fff2dc" /><rect x={x-16} y={y-14} width="32" height="6" rx="2" fill="#e8d5bc" /></>}
  </g>;
}
function Arm({ children, className = "", origin = "66px 57px" }: { children: ReactNode; className?: string; origin?: string }) {
  return <g className={`avatar-action ${className}`} style={{ transformOrigin: origin }}>{children}</g>;
}
export function SkillAvatar({ skill }: { skill: CommunitySkill }) {
  const kind = skill.id;
  const standing = ["dancer", "athlete", "gardener"].includes(kind);
  return <svg className={`community-avatar avatar-${kind}`} viewBox="0 0 150 118" fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="77" cy="110" rx="50" ry="5" fill={skill.color} opacity=".1" />
    <circle cx="76" cy="54" r="45" fill={skill.color} opacity=".09" />
    <g strokeLinecap="round" strokeLinejoin="round">
      {standing ? <>
        <g className={kind === "dancer" ? "avatar-dance-legs" : ""} style={{ transformOrigin: "70px 81px" }}><path d="M63 77L58 106M77 77l10 29" stroke="#495477" strokeWidth="11" /><path d="M53 108h10m19 0h12" stroke={skill.color} strokeWidth="6" /></g>
      </> : <><path d="M55 84v21m24-21 10 21" stroke="#485275" strokeWidth="10" /><path d="M48 108h14m23 0h13" stroke="#8a91b7" strokeWidth="6" /></>}
      <g className={kind === "dancer" ? "avatar-dance-body" : ""} style={{ transformOrigin: "68px 78px" }}>
        <path d="M49 55q17-12 34 0l5 31H46Z" fill={skill.shirt} />
        {kind === "chef" && <path d="M57 52v15h20V52M55 65h24v22H55Z" fill="#a2b9bc" />}
        <Head skill={skill} hat={kind === "chef"} />
        {kind === "programmer" && <>
          <path d="M49 58 40 79h21m21-21 12 21H74" stroke={skill.shirt} strokeWidth="9" />
          <Arm className="avatar-type-left" origin="59px 79px"><path d="m56 78 10 3" stroke={skill.skin} strokeWidth="6" /></Arm><Arm className="avatar-type-right" origin="82px 79px"><path d="m82 78-10 3" stroke={skill.skin} strokeWidth="6" /></Arm>
          <path d="M53 65h53l-5 28H60Z" fill="#636b9b" stroke="#aebcde" strokeWidth="1.5" /><path d="M57 93h48" stroke="#bbc5e3" strokeWidth="4" /><path d="m77 75-5 5 5 4m10-9 5 5-5 4" stroke="#9ddce8" strokeWidth="2" /><path d="M30 96h91" stroke="#8e91b6" strokeWidth="4" /><Arm className="avatar-type-left" origin="63px 90px"><path d="m58 90 10 1" stroke={skill.skin} strokeWidth="4" /></Arm><Arm className="avatar-type-right" origin="87px 90px"><path d="m89 90-10 1" stroke={skill.skin} strokeWidth="4" /></Arm>
        </>}
        {kind === "guitarist" && <>
          <path d="m81 56 9 16" stroke={skill.shirt} strokeWidth="9" /><path d="m87 70 23-15" stroke={skill.skin} strokeWidth="6" />
          <g transform="rotate(-24 80 80)"><path d="M66 69q-14-10-18 2q-4 10 8 13q-14 10 1 16q14 5 17-10q14 5 15-6q2-12-11-10Z" fill="#d99b5d" stroke="#f2c58b" strokeWidth="1.5" /><circle cx="70" cy="82" r="6" fill="#7f5446" /><path d="M77 81h39" stroke="#c18a59" strokeWidth="7" /><path d="M62 80h55m-55 3h55" stroke="#f9ddb3" strokeWidth=".8" /></g>
          <Arm className="avatar-strum" origin="49px 58px"><path d="m49 58-8 14 27 11" stroke={skill.shirt} strokeWidth="9" /><path d="m62 80 9 5" stroke={skill.skin} strokeWidth="6" /></Arm><g className="avatar-note"><path d="M115 24v15m0-15 9-2v13" stroke="#ffd6a0" strokeWidth="2" /><ellipse cx="112" cy="40" rx="4" ry="3" fill="#ffd6a0" /><ellipse cx="121" cy="36" rx="4" ry="3" fill="#ffd6a0" /></g>
        </>}
        {kind === "chef" && <>
          <path d="m49 59-8 20 18 4m23-23 13 16" stroke={skill.shirt} strokeWidth="8" /><path d="m48 82 11 1" stroke={skill.skin} strokeWidth="6" />
          <path d="M62 80h45q-3 21-22 21T62 80" fill="#cd8e83" /><ellipse cx="84" cy="80" rx="22" ry="5" fill="#f2c89e" /><Arm className="avatar-stir" origin="87px 68px"><path d="m94 66-12 18" stroke="#a57b59" strokeWidth="3" /><path d="m92 69-6 7" stroke={skill.skin} strokeWidth="6" /></Arm><path d="M38 103h82" stroke="#8f83a5" strokeWidth="4" /><g className="avatar-steam"><path d="M75 66q-5-5 0-10m13 10q-5-5 0-10" stroke="#eed5cf" strokeWidth="1.5" opacity=".7" /></g>
        </>}
        {kind === "artist" && <>
          <path d="m49 59-6 16 19 8" stroke={skill.shirt} strokeWidth="8" /><ellipse cx="55" cy="85" rx="15" ry="9" fill="#e7ba9c" /><circle cx="49" cy="82" r="2.5" fill="#9bd8d3" /><circle cx="58" cy="88" r="2.5" fill="#b6a2ff" />
          <path d="m101 38-14 68m16-68 15 68m-28-14h23" stroke="#b8947b" strokeWidth="3" /><rect x="90" y="38" width="37" height="48" rx="3" fill="#f4dfcc" /><path d="m93 77 12-14 8 7 10-19" stroke="#9faedb" strokeWidth="5" /><circle cx="100" cy="49" r="5" fill="#e4a6b8" />
          <Arm className="avatar-paint" origin="80px 56px"><path d="m81 57 4 13 14-9" stroke={skill.shirt} strokeWidth="8" /><path d="m96 62 8-4" stroke={skill.skin} strokeWidth="5" /><path d="m101 59 8-9" stroke="#6e6682" strokeWidth="2" /></Arm>
        </>}
        {kind === "athlete" && <>
          <path d="M61 53v30m12-30v30" stroke="#c6e0cb" strokeWidth="1.5" /><text x="61" y="75" fill="#f5eadb" fontSize="14" fontFamily="sans-serif" fontWeight="700">8</text><path d="m48 57-10 19m44-19 13 12" stroke={skill.skin} strokeWidth="7" />
          <Arm className="avatar-dribble-arm" origin="83px 57px"><path d="m83 57 15 17 11-5" stroke={skill.skin} strokeWidth="7" /></Arm><g className="avatar-ball"><circle cx="112" cy="88" r="12" fill="#ecaa6b" stroke="#c27b55" strokeWidth="1.2" /><path d="M100 88h24m-12-12v24m-8-20q12 6 16 17" stroke="#aa6d50" strokeWidth="1" /></g>
        </>}
        {kind === "tutor" && <>
          <rect x="88" y="12" width="51" height="44" rx="7" fill="#435e73" stroke="#88b8b5" /><text x="96" y="31" fill="#c7e8cf" fontSize="10" fontFamily="sans-serif">¡Hola!</text><path d="M97 40h30" stroke="#accad3" strokeWidth="2" /><path d="m49 59-8 20 19 8" stroke={skill.shirt} strokeWidth="8" /><path d="M43 80h30l-4 15H46Z" fill="#d3e5ce" />
          <Arm className="avatar-teach" origin="82px 55px"><path d="m82 55 13 10 10-13" stroke={skill.shirt} strokeWidth="8" /><path d="m103 54 5-10" stroke={skill.skin} strokeWidth="5" /></Arm><path d="M93 58v45m40-45v45" stroke="#638994" strokeWidth="2" />
        </>}
        {kind === "scientist" && <>
          <path d="m60 51 5 34 9-34m-9 34v4" stroke="#91a8ba" strokeWidth="1.5" /><path d="m49 59-7 20 20 7" stroke={skill.shirt} strokeWidth="8" /><path d="M37 103h88" stroke="#8d9ab5" strokeWidth="4" />
          <path d="M94 68h12v15l10 15q2 5-7 5H91q-8 0-5-5l8-15Z" fill="#b3e1df" opacity=".8" /><path d="M89 92h21l5 9H86Z" fill="#85c9ba" />
          <Arm className="avatar-experiment" origin="82px 58px"><path d="m82 58 12 8 12-19" stroke={skill.shirt} strokeWidth="8" /><path d="m106 48 5-10" stroke={skill.skin} strokeWidth="5" /><path d="m111 35 4 16" stroke="#b6dfe6" strokeWidth="5" /></Arm><g className="avatar-bubbles" stroke="#c6f0c1"><circle cx="99" cy="86" r="2" /><circle cx="104" cy="77" r="2" /><circle cx="98" cy="67" r="1.5" /></g>
        </>}
        {kind === "photographer" && <>
          <path d="M54 53q10 32 25 2" stroke="#6a638a" strokeWidth="2" /><g className="avatar-camera" style={{ transformOrigin: "73px 64px" }}><path d="m48 58 9-12 13 5m13 7 11-10-11-5" stroke={skill.shirt} strokeWidth="8" /><path d="m58 46 10 4m14-7-6 6" stroke={skill.skin} strokeWidth="6" /><rect x="59" y="36" width="32" height="24" rx="5" fill="#4b4c72" stroke="#c5b4e2" strokeWidth="1.5" /><circle cx="76" cy="48" r="8" fill="#92a3ce" /><circle cx="76" cy="48" r="5" fill="#3a425f" /><path d="M64 40h4" stroke="#c8dae5" strokeWidth="2" /><path className="avatar-flash" d="m100 35 7-5m-5 13h8" stroke="#f7dba2" strokeWidth="2" /></g>
        </>}
        {kind === "dancer" && <>
          <path d="M46 77h41l10 14q-28 10-59 0Z" fill="#bd7ca5" /><Arm className="avatar-dance-arms" origin="65px 57px"><path d="m48 57-14-8 7-20m42 28 15-18 13 2" stroke={skill.skin} strokeWidth="7" /></Arm><path d="M113 25v12m0-12 7-2v10" stroke="#edb8d5" strokeWidth="1.5" /><circle cx="110" cy="38" r="3" fill="#edb8d5" />
        </>}
        {kind === "gardener" && <>
          <path d="m47 57-9 21m45-21 7 13" stroke={skill.shirt} strokeWidth="8" /><path d="M109 91v-23m0 12q-18-2-17-14q17 0 17 14m0-6q14-1 15-13q-16 0-15 13" stroke="#a5cc94" fill="#719f87" strokeWidth="2" /><path d="M94 91h30l-5 18h-20Z" fill="#c99781" />
          <Arm className="avatar-water" origin="87px 64px"><path d="m87 64 7 11" stroke={skill.skin} strokeWidth="6" /><path d="m84 74 17-3 5 13-16 4Z" fill="#8bafc0" /><path d="m104 78 10 3-5 6" stroke="#8bafc0" strokeWidth="4" /><path d="M89 74q-8-13 3-14q8 0 8 11" stroke="#8bafc0" strokeWidth="2" /></Arm><g className="avatar-drops" stroke="#a2dde4" strokeWidth="1.5"><path d="m112 86 2 5m2-6 3 6m1-7 4 5" /></g>
        </>}
        {kind === "business" && <>
          <rect x="92" y="26" width="44" height="57" rx="5" fill="#444d7e" stroke="#999fd1" /><path d="M100 72V58m10 14V49m10 23V41" stroke="#b2cee4" strokeWidth="5" /><path d="M89 88h51" stroke="#a29dc9" strokeWidth="2" /><Arm className="avatar-present" origin="82px 58px"><path d="m82 58 11 10 16-15" stroke={skill.shirt} strokeWidth="8" /><path d="m107 55 9-9" stroke={skill.skin} strokeWidth="5" /></Arm><path d="m49 60-8 18 21 10" stroke={skill.shirt} strokeWidth="8" /><rect x="40" y="81" width="22" height="15" rx="2" fill="#d4d2e8" />
        </>}
        {kind === "maker" && <>
          <path d="m49 59-8 20 17 3" stroke={skill.shirt} strokeWidth="8" /><path d="M37 96h90m-78 0v13m66-13v13" stroke="#a4928b" strokeWidth="4" /><rect x="58" y="81" width="48" height="13" rx="3" fill="#d4b38b" /><path d="M75 79v7" stroke="#cfd6e5" strokeWidth="2" />
          <Arm className="avatar-hammer" origin="82px 57px"><path d="m82 57 8 14-10 6" stroke={skill.shirt} strokeWidth="8" /><path d="m81 76-5 3" stroke={skill.skin} strokeWidth="6" /><path d="m79 75 7-20" stroke="#b29076" strokeWidth="3" /><path d="m80 52 14 4" stroke="#a9b6ce" strokeWidth="6" /></Arm>
        </>}
      </g>
    </g>
  </svg>;
}

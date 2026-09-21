import { NextResponse } from "next/server";
export function notImplemented(feature:string){return NextResponse.json({error:{code:"NOT_IMPLEMENTED",message:`${feature} is a scaffold endpoint. Implement it before use.`}},{status:501,headers:{"Cache-Control":"no-store"}})}

import {readOperation,writeOperation} from "../../../../../../../shared/server/legacy-routes";
export async function GET(req:Request,ctx:{params:Promise<{matchId:string}>}){return readOperation(req,"messages",{match:(await ctx.params).matchId})}
export async function POST(req:Request,ctx:{params:Promise<{matchId:string}>}){return writeOperation(req,"send",{match:(await ctx.params).matchId})}

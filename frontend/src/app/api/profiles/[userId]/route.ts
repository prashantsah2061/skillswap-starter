import {readOperation} from "../../../../../../shared/server/legacy-routes";
export async function GET(req:Request,ctx:{params:Promise<{userId:string}>}){return readOperation(req,"member",{id:(await ctx.params).userId})}

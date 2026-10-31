import {readOperation} from "../../../../../shared/server/legacy-routes";
export async function GET(req:Request){return readOperation(req,"sessions")}

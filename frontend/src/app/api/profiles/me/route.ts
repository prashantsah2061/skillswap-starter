import {readOperation,writeOperation} from "../../../../../../shared/server/legacy-routes";
export async function GET(req:Request){return readOperation(req,"me")}
export async function PATCH(req:Request){return writeOperation(req,"profile")}

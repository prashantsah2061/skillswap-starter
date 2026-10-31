import {writeOperation} from "../../../../../shared/server/legacy-routes";
export async function POST(req:Request){return writeOperation(req,"swipe")}

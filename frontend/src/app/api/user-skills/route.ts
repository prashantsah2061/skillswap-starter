import {readOperation,writeOperation} from "../../../../../shared/server/legacy-routes";
export async function GET(req:Request){return readOperation(req,"user-skills")}
export async function POST(req:Request){return writeOperation(req,"selection")}
export async function DELETE(req:Request){return writeOperation(req,"selection",{remove:true})}

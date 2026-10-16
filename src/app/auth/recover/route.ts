import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return NextResponse.redirect(new URL("/recuperar-senha", request.url), 303);
}

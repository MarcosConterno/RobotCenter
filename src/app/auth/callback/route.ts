import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const destination = new URL("/recuperar-senha", request.url);
  destination.searchParams.set("error", "O link é inválido ou expirou. Solicite um novo.");
  return NextResponse.redirect(destination);
}

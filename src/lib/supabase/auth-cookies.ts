import { NextResponse, type NextRequest } from "next/server";

export function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "refresh_token_not_found"
    || (typeof candidate.message === "string" && candidate.message.toLowerCase().includes("refresh token not found"));
}

function isSupabaseAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll()
    .filter(({ name }) => isSupabaseAuthCookie(name))
    .forEach(({ name }) => {
      request.cookies.delete(name);
      response.cookies.set(name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
        sameSite: "lax",
      });
    });

  return response;
}

export function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  return target;
}

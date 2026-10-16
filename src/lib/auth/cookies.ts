import { NextResponse, type NextRequest } from "next/server";

function isLegacyAuthCookie(name: string) {
  return name.startsWith("sb-") && name.includes("-auth-token");
}

export function clearLegacyAuthCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll()
    .filter(({ name }) => isLegacyAuthCookie(name))
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

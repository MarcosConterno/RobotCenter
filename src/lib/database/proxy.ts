import { NextRequest, NextResponse } from "next/server";
import { getAppSessionFromRequest } from "@/lib/postgres/session";

const AUTH_PATHS = ["/auth", "/api/auth", "/login", "/recuperar-senha"];
const PUBLIC_PATHS = ["/login", "/recuperar-senha", "/redefinir-senha", "/auth/login", "/auth/recover", "/auth/callback"];

function isStaticAsset(pathname: string) {
  return pathname.startsWith("/_next/")
    || pathname === "/favicon.ico"
    || pathname === "/robots.txt"
    || pathname === "/sitemap.xml"
    || /\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map|woff2?)$/i.test(pathname);
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (isStaticAsset(pathname)) return NextResponse.next({ request });

  let session;
  try {
    session = await getAppSessionFromRequest(request);
  } catch {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "O banco de dados está indisponível." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return new NextResponse("O banco de dados está indisponível.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const isAuthPath = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!session && !isPublicPath && !pathname.startsWith("/api/auth/")) {
    if (isApiPath(pathname)) {
      return NextResponse.json(
        { error: "Sessão necessária." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session && isAuthPath && !pathname.startsWith("/api/auth/")) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

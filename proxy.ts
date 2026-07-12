import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** RSC から returnTo を組み立てられるよう、リクエスト path をヘッダに載せる。 */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-pathname",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png).*)",
  ],
};

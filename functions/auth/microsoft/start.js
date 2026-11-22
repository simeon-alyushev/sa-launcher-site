// Старые ссылки /auth/microsoft/start (без JavaScript) ведут на страницу входа вместо 404.
export function onRequest({ request }) { return Response.redirect(new URL('/#login', request.url).toString(), 302); }

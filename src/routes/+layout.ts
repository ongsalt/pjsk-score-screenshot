import { dev } from "$app/environment";

export const prerender = !dev;
export const ssr = !dev;
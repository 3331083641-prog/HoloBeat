/** Vite base is optional under Node's pure-data tests. */
export function assetUrl(path: string): string {
  const base = (import.meta as {env?:{BASE_URL?:string}}).env?.BASE_URL ?? '/';
  return base.replace(/\/?$/, '/') + path.replace(/^\//,'');
}

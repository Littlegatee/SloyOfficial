/** Публичная ссылка на пост (для шаринга и буфера обмена). */
export function getPostShareUrl(postId: string) {
  if (typeof window === "undefined") return `/p/${postId}`;
  return `${window.location.origin}/p/${postId}`;
}

/** Deep link for future mobile app (fallback is web URL). */
export function getPostDeepLink(postId: string) {
  const web = getPostShareUrl(postId);
  return {
    app: `sloy://post/${postId}`,
    web,
  };
}

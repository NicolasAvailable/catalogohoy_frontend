// Single source of truth for "is this URL a video?" detection. We store
// images and videos in the same `products.photos: text[]` column, so every
// render path needs to discriminate. Centralizing the regex means that if
// Supabase Storage ever changes URL format (or we want to accept new
// extensions), we update ONE place.
//
// Supported video extensions: only the ones we accept at upload time. If
// you add a new extension to the uploader's `accept` list, add it here too.
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv)(?:\?|$|#)/i;

export type MediaType = 'image' | 'video';

export function getMediaType(url: string | null | undefined): MediaType {
  if (!url) return 'image';
  return VIDEO_EXT.test(url) ? 'video' : 'image';
}

export function isVideoUrl(url: string | null | undefined): boolean {
  return getMediaType(url) === 'video';
}

export function isImageUrl(url: string | null | undefined): boolean {
  return getMediaType(url) === 'image';
}

/** First image URL in the list, or `null` if all entries are videos.
 *  Used by the public catalog grid to pick a static cover instead of
 *  rendering a heavy `<video>` element in every card. */
export function firstImageUrl(urls: readonly string[] | null | undefined): string | null {
  if (!urls) return null;
  for (const u of urls) {
    if (isImageUrl(u)) return u;
  }
  return null;
}

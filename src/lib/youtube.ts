export function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return u.pathname.slice(1).split('/')[0] || null;
    }
    if (host.endsWith('youtube.com') || host === 'm.youtube.com') {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'live') {
        return parts[1] || null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url?: string | null): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYouTubeThumbnail(url?: string | null): string | null {
  const id = getYouTubeId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

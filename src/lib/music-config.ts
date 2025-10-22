/**
 * Music configuration for video backgrounds
 *
 * To add music files:
 * 1. Place MP3 files in public/music/ directory
 * 2. Follow naming convention: {genre}-{number}.mp3
 * 3. Update the MUSIC_TRACKS object below if needed
 */

export const MUSIC_TRACKS = {
  lofi: [
    { file: "/music/lofi-1.mp3", name: "Lo-Fi Chill 1" },
    { file: "/music/lofi-2.mp3", name: "Lo-Fi Chill 2" },
    { file: "/music/lofi-3.mp3", name: "Lo-Fi Chill 3" },
  ],
  classical: [
    { file: "/music/classical-1.mp3", name: "Classical 1" },
    { file: "/music/classical-2.mp3", name: "Classical 2" },
    { file: "/music/classical-3.mp3", name: "Classical 3" },
  ],
  breakbeat: [
    { file: "/music/breakbeat-1.mp3", name: "Breakbeat 1" },
    { file: "/music/breakbeat-2.mp3", name: "Breakbeat 2" },
    { file: "/music/breakbeat-3.mp3", name: "Breakbeat 3" },
  ],
  funk: [
    { file: "/music/funk-1.mp3", name: "Funk 1" },
    { file: "/music/funk-2.mp3", name: "Funk 2" },
    { file: "/music/funk-3.mp3", name: "Funk 3" },
  ],
  jazz: [
    { file: "/music/jazz-1.mp3", name: "Jazz 1" },
    { file: "/music/jazz-2.mp3", name: "Jazz 2" },
    { file: "/music/jazz-3.mp3", name: "Jazz 3" },
  ],
  pop: [
    { file: "/music/pop-1.mp3", name: "Pop 1" },
    { file: "/music/pop-2.mp3", name: "Pop 2" },
    { file: "/music/pop-3.mp3", name: "Pop 3" },
  ],
  rock: [
    { file: "/music/rock-1.mp3", name: "Rock 1" },
    { file: "/music/rock-2.mp3", name: "Rock 2" },
    { file: "/music/rock-3.mp3", name: "Rock 3" },
  ],
  metal: [
    { file: "/music/metal-1.mp3", name: "Metal 1" },
    { file: "/music/metal-2.mp3", name: "Metal 2" },
    { file: "/music/metal-3.mp3", name: "Metal 3" },
  ],
  ambient: [
    { file: "/music/ambient-1.mp3", name: "Ambient 1" },
    { file: "/music/ambient-2.mp3", name: "Ambient 2" },
    { file: "/music/ambient-3.mp3", name: "Ambient 3" },
  ],
};

/**
 * Get a random music track for a given genre
 */
export function getMusicTrack(genre: string): string | null {
  if (genre === "none" || !genre) {
    return null;
  }

  const tracks = MUSIC_TRACKS[genre as keyof typeof MUSIC_TRACKS];
  if (!tracks || tracks.length === 0) {
    return null;
  }

  // Pick a random track from the genre
  const randomIndex = Math.floor(Math.random() * tracks.length);
  return tracks[randomIndex].file;
}

/**
 * Get music track name for attribution
 */
export function getMusicTrackName(genre: string): string | null {
  if (genre === "none" || !genre) {
    return null;
  }

  const tracks = MUSIC_TRACKS[genre as keyof typeof MUSIC_TRACKS];
  if (!tracks || tracks.length === 0) {
    return null;
  }

  // For now, just return the genre name
  // In the future, this could track which specific file was used
  return genre.charAt(0).toUpperCase() + genre.slice(1);
}

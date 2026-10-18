/** v4.2: the phone camera and the tap-to-count tally. */

/** "2 fewer than recorded", or "All 80 counted" when the tally matches the head count. */
export function tallyVerdict(counted: number, recorded: number): string {
  const gap = counted - recorded;
  if (gap === 0) return `All ${recorded} counted`;
  return gap < 0 ? `${-gap} fewer than recorded` : `${gap} more than recorded`;
}

/** A plain-English reason the camera didn't start. */
export function cameraError(err: unknown): string {
  switch ((err as { name?: string })?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Bellwether wasn’t allowed to use the camera. Allow the camera for this site in your browser settings, then try again.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.';
    case 'NotReadableError':
      return 'Another app is using the camera: close it, then try again.';
    default:
      return 'The camera could not start. Try again, or use another browser.';
  }
}

/** True where a page may use the camera: browsers only allow it over HTTPS (or on this computer). */
export const cameraAvailable = () =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** The back camera if there is one (the one pointing at the animals), without sound. */
export function startCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
    audio: false,
  });
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Snapshots are scaled down to this width so they stay well under the 5 MB upload limit. */
const MAX_SNAPSHOT_WIDTH = 1600;

/** The video's current frame as a JPEG `data:` URL. */
export async function captureFrame(video: HTMLVideoElement): Promise<string> {
  const scale = Math.min(1, MAX_SNAPSHOT_WIDTH / (video.videoWidth || MAX_SNAPSHOT_WIDTH));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((video.videoWidth || 1280) * scale);
  canvas.height = Math.round((video.videoHeight || 720) * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser can’t take snapshots');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

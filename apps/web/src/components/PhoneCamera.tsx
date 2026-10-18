import { useMutation } from '@apollo/client';
import { useEffect, useRef, useState } from 'react';
import { cameraAvailable, cameraError, captureFrame, startCamera, stopCamera } from '../camera';
import { errorMessage } from '../errors';
import { ADD_DOCUMENT } from '../graphql/documents';
import { Icon } from './Icon';

/** "2026-06-01T09:05" → "1 Jun 2026, 09:05" and "2026-06-01-0905" */
function stamp(now: Date) {
  const text = now.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const pad = (n: number) => String(n).padStart(2, '0');
  const file = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return { text, file };
}

/**
 * v4.2: the phone (or laptop) camera as a live view of the animals, with snapshots saved to the
 * farm's documents. Nothing is recorded or sent anywhere until a snapshot is taken.
 */
export function PhoneCamera({
  farmId,
  farmName,
  groups,
  canSave,
}: {
  farmId: string;
  farmName: string;
  groups: Array<{ id: string; name: string }>;
  canSave: boolean;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [groupId, setGroupId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addDocument, { loading }] = useMutation(ADD_DOCUMENT);

  // Turn the camera off when leaving the page.
  useEffect(() => () => stopCamera(stream), [stream]);

  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      void video.current.play().catch(() => undefined);
    }
  }, [stream]);

  async function start() {
    setError(null);
    setMessage(null);
    if (!cameraAvailable()) {
      setError(
        'This browser can’t use the camera here. Cameras only work on a secure (https) page.',
      );
      return;
    }
    try {
      setStream(await startCamera());
    } catch (err) {
      setError(cameraError(err));
    }
  }

  function stop() {
    stopCamera(stream);
    setStream(null);
  }

  async function snapshot() {
    if (!video.current) return;
    setError(null);
    setMessage(null);
    try {
      const contentBase64 = await captureFrame(video.current);
      const group = groups.find((g) => g.id === groupId);
      const when = stamp(new Date());
      await addDocument({
        variables: {
          input: {
            farmId,
            petId: null,
            groupId: group?.id ?? null,
            taggedAnimalId: null,
            kind: 'PHOTO',
            title: `Snapshot: ${group?.name ?? farmName}, ${when.text}`,
            fileName: `snapshot-${when.file}.jpg`,
            contentBase64,
            documentDate: null,
            expiresOn: null,
            notes: null,
          },
        },
      });
      setMessage('Snapshot saved to Documents');
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section className="panel phone-camera" aria-label="Phone camera">
      <h2>
        <Icon name="camera" size={20} /> Phone camera
      </h2>
      <p className="muted">
        Use this phone as a camera on the animals. Snapshots are saved to the farm’s documents;
        nothing else is recorded.
      </p>
      <div className={`phone-camera__view${stream ? ' is-live' : ''}`}>
        {stream ? (
          <video ref={video} muted playsInline autoPlay aria-label="Live camera view" />
        ) : (
          <p>Camera off</p>
        )}
      </div>
      <div className="actions">
        {stream ? (
          <>
            {canSave && (
              <>
                <label>
                  Photo of
                  <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                    <option value="">The farm</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={snapshot} disabled={loading}>
                  <Icon name="camera" size={18} /> Take a snapshot
                </button>
              </>
            )}
            <button type="button" className="secondary" onClick={stop}>
              Stop the camera
            </button>
          </>
        ) : (
          <button type="button" onClick={start}>
            <Icon name="camera" size={18} /> Start the camera
          </button>
        )}
      </div>
      {message && <p className="success">{message}</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

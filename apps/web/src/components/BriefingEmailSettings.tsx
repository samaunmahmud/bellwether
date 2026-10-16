import { useMutation, useQuery } from '@apollo/client';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../errors';
import { BRIEFING_PREFERENCES, SET_BRIEFING_PREFERENCES } from '../graphql/briefing';

interface Preferences {
  emailEnabled: boolean;
  sendAt: string;
  alwaysSend: boolean;
}

function SettingsForm({ farmId, initial }: { farmId: string; initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [save] = useMutation(SET_BRIEFING_PREFERENCES);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await save({ variables: { farmId, input: prefs } });
      setStatus('Saved');
    } catch (err) {
      setStatus(errorMessage(err));
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Email settings">
      <label className="toggle">
        <input
          type="checkbox"
          checked={prefs.emailEnabled}
          onChange={(e) => setPrefs({ ...prefs, emailEnabled: e.target.checked })}
        />
        Email me this briefing every day
      </label>
      <label>
        Send at (UK time)
        <input
          type="time"
          value={prefs.sendAt}
          onChange={(e) => setPrefs({ ...prefs, sendAt: e.target.value })}
          required
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={prefs.alwaysSend}
          onChange={(e) => setPrefs({ ...prefs, alwaysSend: e.target.checked })}
        />
        Send even when nothing is flagged
      </label>
      {status && <p aria-live="polite">{status}</p>}
      <button type="submit">Save email settings</button>
    </form>
  );
}

/** FR-4.3: the user's daily email settings for one farm. */
export function BriefingEmailSettings({ farmId }: { farmId: string }) {
  const { data, error } = useQuery<{ briefingPreferences: Preferences }>(BRIEFING_PREFERENCES, {
    variables: { farmId },
  });
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  if (!data) return null;
  const { emailEnabled, sendAt, alwaysSend } = data.briefingPreferences;
  return <SettingsForm farmId={farmId} initial={{ emailEnabled, sendAt, alwaysSend }} />;
}

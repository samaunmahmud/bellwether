import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BriefingEmailSettings } from '../src/components/BriefingEmailSettings';
import { BRIEFING_PREFERENCES, SET_BRIEFING_PREFERENCES } from '../src/graphql/briefing';

const prefs = (overrides = {}) => ({
  __typename: 'BriefingPreferences',
  emailEnabled: true,
  sendAt: '06:00',
  alwaysSend: false,
  ...overrides,
});

describe('BriefingEmailSettings (FR-4.3)', () => {
  it('shows the saved settings and saves changes', async () => {
    const saved = vi.fn(() => ({
      data: { setBriefingPreferences: prefs({ sendAt: '07:30', alwaysSend: true }) },
    }));
    const mocks: MockedResponse[] = [
      {
        request: { query: BRIEFING_PREFERENCES, variables: { farmId: 'farm1' } },
        result: { data: { briefingPreferences: prefs() } },
      },
      {
        request: {
          query: SET_BRIEFING_PREFERENCES,
          variables: {
            farmId: 'farm1',
            input: { emailEnabled: true, sendAt: '07:30', alwaysSend: true },
          },
        },
        result: saved,
      },
    ];
    render(
      <MockedProvider mocks={mocks}>
        <BriefingEmailSettings farmId="farm1" />
      </MockedProvider>,
    );

    const time = await screen.findByLabelText('Send at (UK time)');
    expect(time).toHaveValue('06:00');
    expect(screen.getByLabelText('Email me this briefing every day')).toBeChecked();

    fireEvent.change(time, { target: { value: '07:30' } });
    await userEvent.click(screen.getByLabelText('Send even when nothing is flagged'));
    await userEvent.click(screen.getByRole('button', { name: 'Save email settings' }));

    await vi.waitFor(() => expect(saved).toHaveBeenCalled());
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });
});

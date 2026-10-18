import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ADD_CAMERA, FARM_CAMERAS_QUERY } from '../src/graphql/cameras';
import { ADD_DOCUMENT } from '../src/graphql/documents';
import { RECORD_OBSERVATION } from '../src/graphql/records';
import { CamerasPage } from '../src/pages/CamerasPage';
import { routerFuture } from '../src/routerFuture';

vi.mock('../src/camera', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/camera')>()),
  captureFrame: vi.fn(async () => 'data:image/jpeg;base64,/9j/4A=='),
}));

const shed = {
  __typename: 'Camera',
  id: 'c1',
  name: 'Lambing shed',
  url: 'https://cams.example.com/shed',
  notes: 'Login on the office wall',
  field: null,
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' },
};

const page = (cameras: unknown[], myRole = 'OWNER'): MockedResponse => ({
  request: { query: FARM_CAMERAS_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        myRole,
        fields: [{ __typename: 'Field', id: 'fd1', name: 'Top' }],
        groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Ewes', headCount: 80 }],
      },
      cameras,
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1/cameras']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/cameras" element={<CamerasPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

function fakeCamera(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(getUserMedia) },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
}

afterEach(() => {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  vi.restoreAllMocks();
});

describe('CamerasPage (v4.2)', () => {
  it('opens a CCTV camera’s own viewer in a new tab', async () => {
    renderWith([page([shed])]);
    const card = await screen.findByRole('article', { name: 'Lambing shed' });
    const link = within(card).getByRole('link', { name: /Open Lambing shed/ });
    expect(link).toHaveAttribute('href', 'https://cams.example.com/shed');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(card).getByText(/Ewes/)).toBeInTheDocument();
  });

  it('adds a camera link', async () => {
    const input = {
      farmId: 'f1',
      name: 'Yard',
      url: 'yard.example.com',
      fieldId: 'fd1',
      groupId: null,
      notes: null,
    };
    const added = {
      ...shed,
      id: 'c2',
      name: 'Yard',
      url: 'https://yard.example.com',
      group: null,
      notes: null,
    };
    renderWith([
      page([]),
      {
        request: { query: ADD_CAMERA, variables: { input } },
        result: { data: { addCamera: added } },
      },
      page([added]),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a camera' }));
    await userEvent.type(screen.getByLabelText('Name'), 'Yard');
    await userEvent.type(screen.getByLabelText(/Viewer web address/), 'yard.example.com');
    await userEvent.selectOptions(screen.getByLabelText('Field'), 'fd1');
    await userEvent.click(screen.getByRole('button', { name: 'Save camera' }));
    expect(await screen.findByRole('article', { name: 'Yard' })).toBeInTheDocument();
  });

  it('counts a group with taps, compares it with the head count and saves the check', async () => {
    vi.useFakeTimers({ now: new Date('2026-06-01T09:00:00'), toFake: ['Date'] });
    const input = {
      groupId: 'g1',
      date: '2026-06-01',
      type: 'Head count check',
      note: 'Counted 3 of 80: 77 fewer than recorded',
    };
    renderWith([
      page([]),
      {
        request: { query: RECORD_OBSERVATION, variables: { input } },
        result: { data: { recordObservation: { __typename: 'Observation', id: 'o1' } } },
      },
    ]);
    const tally = await screen.findByRole('region', { name: 'Count animals' });
    await userEvent.selectOptions(within(tally).getByLabelText('Group'), 'g1');
    const one = within(tally).getByRole('button', { name: 'Count one' });
    for (let i = 0; i < 4; i++) await userEvent.click(one);
    await userEvent.click(within(tally).getByRole('button', { name: 'Take one off' }));
    expect(within(tally).getByRole('status')).toHaveTextContent('3 of 80');
    expect(within(tally).getByText('77 fewer than recorded')).toBeInTheDocument();
    await userEvent.click(within(tally).getByRole('button', { name: 'Save this count' }));
    expect(await within(tally).findByText(/Saved to Ewes/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('says so when every animal is counted', async () => {
    renderWith([page([])]);
    const tally = await screen.findByRole('region', { name: 'Count animals' });
    await userEvent.selectOptions(within(tally).getByLabelText('Group'), 'g1');
    const one = within(tally).getByRole('button', { name: 'Count one' });
    for (let i = 0; i < 80; i++) await userEvent.click(one);
    expect(within(tally).getByText('All 80 counted')).toBeInTheDocument();
  });

  it('takes a snapshot with the phone camera and saves it as a photo document', async () => {
    const stop = vi.fn();
    fakeCamera(async () => ({ getTracks: () => [{ stop }] }));
    renderWith([
      page([]),
      {
        request: { query: ADD_DOCUMENT },
        variableMatcher: (v: { input: Record<string, unknown> }) =>
          v.input.kind === 'PHOTO' &&
          v.input.farmId === 'f1' &&
          v.input.groupId === 'g1' &&
          v.input.contentBase64 === 'data:image/jpeg;base64,/9j/4A==' &&
          String(v.input.fileName).endsWith('.jpg'),
        result: { data: { addDocument: { __typename: 'Document', id: 'd1' } } },
      } as MockedResponse,
    ]);
    const cam = await screen.findByRole('region', { name: 'Phone camera' });
    await userEvent.click(within(cam).getByRole('button', { name: 'Start the camera' }));
    await userEvent.selectOptions(within(cam).getByLabelText('Photo of'), 'g1');
    await userEvent.click(await within(cam).findByRole('button', { name: 'Take a snapshot' }));
    expect(await within(cam).findByText(/Snapshot saved to Documents/)).toBeInTheDocument();
    await userEvent.click(within(cam).getByRole('button', { name: 'Stop the camera' }));
    expect(stop).toHaveBeenCalled();
  });

  it('explains when the camera is refused or unavailable', async () => {
    fakeCamera(async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    });
    renderWith([page([])]);
    const cam = await screen.findByRole('region', { name: 'Phone camera' });
    await userEvent.click(within(cam).getByRole('button', { name: 'Start the camera' }));
    expect(await within(cam).findByRole('alert')).toHaveTextContent(/allow the camera/i);
  });

  it('lets viewers watch and count but not change links or save', async () => {
    renderWith([page([shed], 'VIEWER')]);
    const card = await screen.findByRole('article', { name: 'Lambing shed' });
    expect(within(card).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add a camera' })).not.toBeInTheDocument();
    const tally = screen.getByRole('region', { name: 'Count animals' });
    expect(within(tally).getByRole('button', { name: 'Count one' })).toBeInTheDocument();
    expect(
      within(tally).queryByRole('button', { name: 'Save this count' }),
    ).not.toBeInTheDocument();
  });
});

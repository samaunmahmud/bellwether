import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EMERGENCY_QUERY } from '../src/graphql/keeping';
import { EmergencyPage } from '../src/pages/EmergencyPage';
import { routerFuture } from '../src/routerFuture';

const contact = (over: Record<string, unknown>) => ({
  __typename: 'Contact',
  id: 'c1',
  kind: 'VET',
  name: 'Dale Vets',
  phone: '01539 000000',
  emergencyPhone: null,
  email: null,
  website: null,
  address: null,
  notes: null,
  farmName: 'Hill Farm',
  ...over,
});

const mock = (emergencyContacts: unknown[]): MockedResponse => ({
  request: { query: EMERGENCY_QUERY },
  result: {
    data: {
      emergencyContacts,
      farms: [{ __typename: 'Farm', id: 'f1', name: 'Hill Farm', postcode: 'LA9 4DQ' }],
      animals: [{ __typename: 'Animal', id: 'p1', name: 'Bess', postcode: 'UB8 3PH' }],
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter future={routerFuture}>
        <EmergencyPage />
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('EmergencyPage (v4)', () => {
  it('puts a one-tap call button for each vet first, out-of-hours lines labelled', async () => {
    renderWith([
      mock([
        contact({ id: 'c2', name: 'Night Vets', emergencyPhone: '07700 900000' }),
        contact({}),
      ]),
    ]);
    const night = await screen.findByRole('article', { name: 'Night Vets' });
    expect(
      within(night).getByRole('link', { name: /Call out of hours 07700 900000/ }),
    ).toHaveAttribute('href', 'tel:07700900000');
    const day = screen.getByRole('article', { name: 'Dale Vets' });
    expect(within(day).getByRole('link', { name: /Call 01539 000000/ })).toHaveAttribute(
      'href',
      'tel:01539000000',
    );
  });

  it('says how to find a vet when none is saved, near each farm and pet', async () => {
    renderWith([mock([])]);
    expect(await screen.findByText(/No vet saved yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find a vet/ })).toHaveAttribute(
      'href',
      expect.stringMatching(/findavet\.rcvs\.org\.uk/),
    );
    expect(screen.getByRole('link', { name: /Vets near Hill Farm/ })).toHaveAttribute(
      'href',
      expect.stringContaining('LA9%204DQ'),
    );
    expect(screen.getByRole('link', { name: /Vets near Bess/ })).toBeInTheDocument();
  });

  it('never gives treatment advice, only who to call', async () => {
    renderWith([mock([])]);
    expect(await screen.findByText(/not veterinary advice/i)).toBeInTheDocument();
  });
});

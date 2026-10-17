import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ADD_CONTACT, FARM_CONTACTS_QUERY } from '../src/graphql/keeping';
import { ContactsPage } from '../src/pages/ContactsPage';
import { routerFuture } from '../src/routerFuture';

const feed = {
  __typename: 'Contact',
  id: 'c1',
  kind: 'FEED',
  name: 'Bale Feeds',
  phone: '01539 111111',
  emergencyPhone: null,
  email: 'orders@bale.example.com',
  website: 'https://bale.example.com',
  address: null,
  notes: 'Delivers Tuesdays',
  farmName: 'Hill Farm',
};

const page = (contacts: unknown[], myRole = 'OWNER'): MockedResponse => ({
  request: { query: FARM_CONTACTS_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: { __typename: 'Farm', id: 'f1', name: 'Hill Farm', postcode: 'LA9 4DQ', myRole },
      contacts,
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1/contacts']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/contacts" element={<ContactsPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('ContactsPage (v4)', () => {
  it('shows each contact with call, email and website links, grouped by kind', async () => {
    renderWith([page([feed])]);
    const group = await screen.findByRole('region', { name: 'Feed merchants' });
    const card = within(group).getByRole('article', { name: 'Bale Feeds' });
    expect(within(card).getByRole('link', { name: /Call 01539 111111/ })).toHaveAttribute(
      'href',
      'tel:01539111111',
    );
    expect(within(card).getByRole('link', { name: /orders@bale/ })).toHaveAttribute(
      'href',
      'mailto:orders@bale.example.com',
    );
    const site = within(card).getByRole('link', { name: /Website/ });
    expect(site).toHaveAttribute('href', 'https://bale.example.com');
    expect(site).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(card).getByText('Delivers Tuesdays')).toBeInTheDocument();
  });

  it('adds a supplier with their website', async () => {
    const input = {
      farmId: 'f1',
      kind: 'FEED',
      name: 'Bale Feeds',
      phone: '01539 111111',
      emergencyPhone: null,
      email: null,
      website: 'bale.example.com',
      address: null,
      notes: null,
    };
    renderWith([
      page([]),
      {
        request: { query: ADD_CONTACT, variables: { input } },
        result: { data: { addContact: feed } },
      },
      page([feed]),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add a contact' }));
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'FEED');
    await userEvent.type(screen.getByLabelText('Name'), 'Bale Feeds');
    await userEvent.type(screen.getByLabelText('Phone'), '01539 111111');
    await userEvent.type(screen.getByLabelText('Website'), 'bale.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save contact' }));
    expect(await screen.findByRole('article', { name: 'Bale Feeds' })).toBeInTheDocument();
  });

  it('offers searches for vets, merchants and markets near the farm', async () => {
    renderWith([page([])]);
    expect(
      await screen.findByRole('link', { name: /Agricultural and feed merchants/ }),
    ).toHaveAttribute('href', expect.stringContaining('openstreetmap.org/search'));
  });

  it('lets viewers read but not change contacts', async () => {
    renderWith([page([feed], 'VIEWER')]);
    await screen.findByRole('article', { name: 'Bale Feeds' });
    expect(screen.queryByRole('button', { name: 'Add a contact' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
  });
});

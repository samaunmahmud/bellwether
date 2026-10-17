import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CommandPalette, paletteItems } from '../src/components/CommandPalette';
import { PALETTE_QUERY } from '../src/graphql/v3';
import { routerFuture } from '../src/routerFuture';

const data = {
  farms: [
    {
      __typename: 'Farm',
      id: 'f1',
      name: 'Hill Farm',
      groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Mule ewes' }],
      fields: [{ __typename: 'Field', id: 'fd1', name: 'Top Fell' }],
    },
  ],
  animals: [{ __typename: 'Animal', id: 'p1', name: 'Rex', species: 'dog' }],
};

describe('CommandPalette (v3)', () => {
  it('offers the current farm’s pages, groups, fields and pets', () => {
    const items = paletteItems(data, 'f1');
    expect(items[0]).toEqual({ label: 'Dashboard', hint: 'Hill Farm', to: '/farms/f1' });
    expect(items).toContainEqual({
      label: 'Mule ewes',
      hint: 'Group · Hill Farm',
      to: '/groups/g1',
    });
    expect(items).toContainEqual({ label: 'Rex', hint: 'Pet · dog', to: '/pets/p1' });
  });

  it('filters as you type and goes to the chosen result with Enter', async () => {
    const onClose = vi.fn();
    render(
      <MockedProvider mocks={[{ request: { query: PALETTE_QUERY }, result: { data } }]}>
        <MemoryRouter future={routerFuture}>
          <CommandPalette open onClose={onClose} farmId="f1" />
          <Routes>
            <Route path="/" element={null} />
            <Route path="/groups/:id" element={<p>Group page</p>} />
          </Routes>
        </MemoryRouter>
      </MockedProvider>,
    );
    // With nothing typed, the current farm's pages come first
    expect(await screen.findByRole('option', { name: /Dashboard/ })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('combobox', { name: 'Search' }), 'mule');
    expect(await screen.findByRole('option', { name: /Mule ewes/ })).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalled();
    expect(await screen.findByText('Group page')).toBeInTheDocument();
  });
});

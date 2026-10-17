import { MockedProvider } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GroupTaggedAnimals } from '../src/components/GroupTaggedAnimals';
import { GROUP_TAGGED_QUERY } from '../src/graphql/keeping';
import { routerFuture } from '../src/routerFuture';

const mock = (taggedAnimals: unknown[]) => ({
  request: { query: GROUP_TAGGED_QUERY, variables: { id: 'g1' } },
  result: { data: { livestockGroup: { __typename: 'LivestockGroup', id: 'g1', taggedAnimals } } },
});

const renderWith = (taggedAnimals: unknown[]) =>
  render(
    <MockedProvider mocks={[mock(taggedAnimals)]}>
      <MemoryRouter future={routerFuture}>
        <GroupTaggedAnimals groupId="g1" farmId="f1" />
      </MemoryRouter>
    </MockedProvider>,
  );

describe('GroupTaggedAnimals (v4)', () => {
  it('lists the group’s tagged animals with their ages', async () => {
    renderWith([
      { __typename: 'TaggedAnimal', id: 'a1', tag: 'UK 1', name: 'Clover', ageMonths: 26 },
    ]);
    expect(await screen.findByRole('heading', { name: 'Tagged animals (1)' })).toBeInTheDocument();
    expect(screen.getByText('Clover').closest('li')).toHaveTextContent('UK 1 · 2 years 2 months');
    expect(screen.getByRole('link', { name: /All tagged animals/ })).toHaveAttribute(
      'href',
      '/farms/f1/animals',
    );
  });

  it('shows nothing for a group without any', async () => {
    const { container } = renderWith([]);
    await new Promise((r) => setTimeout(r, 0));
    expect(container).toBeEmptyDOMElement();
  });
});

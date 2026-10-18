import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { ADD_DOCUMENT, DOCUMENT_FILE, FARM_DOCUMENTS_QUERY } from '../src/graphql/documents';
import { DocumentsPage } from '../src/pages/DocumentsPage';
import { routerFuture } from '../src/routerFuture';

const licence = {
  __typename: 'Document',
  id: 'd1',
  kind: 'MOVEMENT',
  title: 'Movement licence',
  fileName: 'licence.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 2048,
  documentDate: '2026-05-20',
  expiresOn: '2026-06-11',
  daysToExpiry: 10,
  notes: 'Ewes to Kendal mart',
  uploadedAt: '2026-06-01T09:00:00.000Z',
  farmName: 'Hill Farm',
  petName: null,
  group: { __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' },
  taggedAnimal: { __typename: 'TaggedAnimal', id: 't1', tag: 'UK 1' },
};

const page = (documents: unknown[], myRole = 'OWNER'): MockedResponse => ({
  request: { query: FARM_DOCUMENTS_QUERY, variables: { farmId: 'f1' } },
  result: {
    data: {
      farm: {
        __typename: 'Farm',
        id: 'f1',
        name: 'Hill Farm',
        myRole,
        groups: [{ __typename: 'LivestockGroup', id: 'g1', name: 'Ewes' }],
      },
      taggedAnimals: [{ __typename: 'TaggedAnimal', id: 't1', tag: 'UK 1', status: 'ON_FARM' }],
      documents,
    },
  },
});

function renderWith(mocks: MockedResponse[]) {
  return render(
    <MockedProvider mocks={mocks}>
      <MemoryRouter initialEntries={['/farms/f1/documents']} future={routerFuture}>
        <Routes>
          <Route path="/farms/:id/documents" element={<DocumentsPage />} />
        </Routes>
      </MemoryRouter>
    </MockedProvider>,
  );
}

describe('DocumentsPage (v4)', () => {
  it('lists documents with their kind, links, size and an expiry warning in words', async () => {
    renderWith([page([licence])]);
    const card = await screen.findByRole('article', { name: 'Movement licence' });
    expect(within(card).getByText('Movement')).toBeInTheDocument();
    expect(within(card).getByText('For Ewes · UK 1')).toBeInTheDocument();
    expect(within(card).getByText(/2 KB/)).toBeInTheDocument();
    expect(within(card).getByText('Expires in 10 days')).toBeInTheDocument();
    expect(within(card).getByText('Ewes to Kendal mart')).toBeInTheDocument();
    // The warning is repeated at the top of the page
    expect(screen.getByRole('region', { name: 'Expiring soon' })).toHaveTextContent(
      'Movement licence',
    );
  });

  it('finds documents by title, tag or kind', async () => {
    renderWith([
      page([
        licence,
        {
          ...licence,
          id: 'd2',
          title: 'Feed invoice',
          kind: 'RECEIPT',
          taggedAnimal: null,
          group: null,
          expiresOn: null,
          daysToExpiry: null,
          notes: null,
        },
      ]),
    ]);
    await screen.findByRole('article', { name: 'Feed invoice' });
    await userEvent.type(screen.getByRole('searchbox', { name: /Search documents/ }), 'uk 1');
    expect(screen.queryByRole('article', { name: 'Feed invoice' })).not.toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Movement licence' })).toBeInTheDocument();
  });

  it('uploads a PDF linked to an animal', async () => {
    const input = {
      farmId: 'f1',
      petId: null,
      groupId: null,
      taggedAnimalId: 't1',
      kind: 'HEALTH',
      title: null,
      fileName: 'blood test.pdf',
      contentBase64: 'data:application/pdf;base64,JVBERi0xLjc=',
      documentDate: null,
      expiresOn: null,
      notes: null,
    };
    const added = { ...licence, id: 'd3', kind: 'HEALTH', title: 'blood test' };
    renderWith([
      page([]),
      {
        request: { query: ADD_DOCUMENT, variables: { input } },
        result: { data: { addDocument: added } },
      },
      page([added]),
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload a document' }));
    await userEvent.upload(
      screen.getByLabelText(/File/),
      new File(['%PDF-1.7'], 'blood test.pdf', { type: 'application/pdf' }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'HEALTH');
    await userEvent.selectOptions(screen.getByLabelText('Animal'), 't1');
    await userEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(await screen.findByRole('article', { name: 'blood test' })).toBeInTheDocument();
  });

  it('refuses a file over 5 MB before uploading it', async () => {
    renderWith([page([])]);
    await userEvent.click(await screen.findByRole('button', { name: 'Upload a document' }));
    await userEvent.upload(
      screen.getByLabelText(/File/),
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.pdf', { type: 'application/pdf' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/5 MB/);
  });

  it('saves the file to the device', async () => {
    const createObjectURL = vi.fn(() => 'blob:doc');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderWith([
      page([licence], 'VIEWER'),
      {
        request: { query: DOCUMENT_FILE, variables: { id: 'd1' } },
        result: {
          data: {
            documentFile: {
              __typename: 'DocumentFile',
              fileName: 'licence.pdf',
              mimeType: 'application/pdf',
              contentBase64: 'JVBERi0xLjc=',
            },
          },
        },
      },
    ]);
    const card = await screen.findByRole('article', { name: 'Movement licence' });
    await userEvent.click(within(card).getByRole('button', { name: /Save Movement licence/ }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    click.mockRestore();
  });

  it('lets viewers open documents but not upload, change or delete them', async () => {
    renderWith([page([licence], 'VIEWER')]);
    const card = await screen.findByRole('article', { name: 'Movement licence' });
    expect(within(card).getByRole('button', { name: /Open Movement licence/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Upload a document' })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});

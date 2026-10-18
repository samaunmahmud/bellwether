import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PetDocuments } from '../src/components/PetDocuments';
import { ADD_DOCUMENT, PET_DOCUMENTS_QUERY } from '../src/graphql/documents';

const policy = {
  __typename: 'Document',
  id: 'd1',
  kind: 'INSURANCE',
  title: 'Pet insurance',
  fileName: 'policy.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 8,
  documentDate: null,
  expiresOn: null,
  daysToExpiry: null,
  notes: null,
  uploadedAt: '2026-06-01T09:00:00.000Z',
  farmName: null,
  petName: 'Bess',
  group: null,
  taggedAnimal: null,
};

const list = (documents: unknown[]): MockedResponse => ({
  request: { query: PET_DOCUMENTS_QUERY, variables: { petId: 'p1' } },
  result: { data: { documents } },
});

describe('PetDocuments (v4)', () => {
  it('uploads a pet’s document with no group or animal to link', async () => {
    const input = {
      farmId: null,
      petId: 'p1',
      groupId: null,
      taggedAnimalId: null,
      kind: 'INSURANCE',
      title: 'Pet insurance',
      fileName: 'policy.pdf',
      contentBase64: 'data:application/pdf;base64,JVBERi0xLjc=',
      documentDate: null,
      expiresOn: '2027-03-01',
      notes: null,
    };
    render(
      <MockedProvider
        mocks={[
          list([]),
          {
            request: { query: ADD_DOCUMENT, variables: { input } },
            result: { data: { addDocument: policy } },
          },
          list([policy]),
        ]}
      >
        <PetDocuments petId="p1" />
      </MockedProvider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Upload a document' }));
    expect(screen.queryByLabelText('Group')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Animal')).not.toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText(/File/),
      new File(['%PDF-1.7'], 'policy.pdf', { type: 'application/pdf' }),
    );
    await userEvent.selectOptions(screen.getByLabelText('Kind'), 'INSURANCE');
    await userEvent.type(screen.getByLabelText('Title'), 'Pet insurance');
    await userEvent.type(screen.getByLabelText('Expires on'), '2027-03-01');
    await userEvent.click(screen.getByRole('button', { name: 'Save document' }));
    expect(await screen.findByRole('article', { name: 'Pet insurance' })).toBeInTheDocument();
  });
});

import { useMutation, useQuery } from '@apollo/client';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { PageHero } from '../components/photos';
import {
  SEX_LABELS,
  STATUS_LABELS,
  TaggedAnimalForm,
  type TaggedValues,
} from '../components/TaggedAnimalForm';
import { useToast } from '../components/Toasts';
import { formatAge, fullDate } from '../dates';
import {
  ADD_TAGGED_ANIMAL,
  DELETE_TAGGED_ANIMAL,
  TAGGED_ANIMALS_QUERY,
  UPDATE_TAGGED_ANIMAL,
} from '../graphql/keeping';
import { canWork } from '../roles';
import type { AnimalStatus, FarmRole, Species, TaggedAnimal } from '../types';

interface Data {
  farm: {
    id: string;
    name: string;
    myRole: FarmRole;
    groups: Array<{ id: string; name: string; species: Species }>;
  } | null;
  taggedAnimals: TaggedAnimal[];
}

const tagKey = (s: string) => s.replace(/\s+/g, '').toUpperCase();

/** v4: a farm's individually tagged animals, beside the group head counts. */
export function TaggedAnimalsPage() {
  const { id = '' } = useParams();
  const refetch = { refetchQueries: [{ query: TAGGED_ANIMALS_QUERY, variables: { farmId: id } }] };
  const { data, loading, error } = useQuery<Data>(TAGGED_ANIMALS_QUERY, {
    variables: { farmId: id },
  });
  const [addAnimal] = useMutation(ADD_TAGGED_ANIMAL, { ...refetch, awaitRefetchQueries: true });
  const [updateAnimal] = useMutation(UPDATE_TAGGED_ANIMAL, refetch);
  const [deleteAnimal] = useMutation(DELETE_TAGGED_ANIMAL, refetch);
  const [show, setShow] = useState<AnimalStatus | 'ALL'>('ON_FARM');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const toast = useToast();

  if (loading) return <p aria-live="polite">Loading animals…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const canEdit = canWork(farm.myRole);
  const label = (a: TaggedAnimal) => a.name ?? a.tag;

  const animals = data.taggedAnimals.filter(
    (a) =>
      (show === 'ALL' || a.status === show) &&
      (!search.trim() || tagKey(a.tag).includes(tagKey(search))),
  );
  const onFarm = data.taggedAnimals.filter((a) => a.status === 'ON_FARM').length;

  async function add({ status: _s, statusDate: _d, ...values }: TaggedValues) {
    await addAnimal({ variables: { input: { farmId: farm!.id, ...values } } });
    setEditing(null);
    toast(`${values.name ?? values.tag} added`);
  }

  async function update(a: TaggedAnimal, { species: _species, ...values }: TaggedValues) {
    await updateAnimal({ variables: { id: a.id, input: values } });
    setEditing(null);
    toast(`${values.name ?? values.tag} updated`);
  }

  async function remove(a: TaggedAnimal) {
    if (!window.confirm(`Delete ${label(a)}? To keep its history, mark it sold or died instead.`))
      return;
    await deleteAnimal({ variables: { id: a.id } });
  }

  const editForm = editing && editing !== 'new' && data.taggedAnimals.find((a) => a.id === editing);

  return (
    <section>
      <PageHero photo="lambs" eyebrow={<Link to={`/farms/${farm.id}`}>{farm.name}</Link>}>
        <div>
          <h1>Tagged animals</h1>
          <p>
            Animals with their own ear tag or ID: ages, breeds and where they are. {onFarm} on the
            farm.
          </p>
        </div>
      </PageHero>

      <div className="toolbar">
        <label>
          Show
          <select value={show} onChange={(e) => setShow(e.target.value as AnimalStatus | 'ALL')}>
            {Object.entries(STATUS_LABELS).map(([k, text]) => (
              <option key={k} value={k}>
                {text}
              </option>
            ))}
            <option value="ALL">All</option>
          </select>
        </label>
        <label>
          Find a tag
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="e.g. 700001"
          />
        </label>
        {canEdit && editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')}>
            <Icon name="plus" size={18} /> Add an animal
          </button>
        )}
      </div>

      {editing === 'new' && (
        <TaggedAnimalForm groups={farm.groups} onSubmit={add} onCancel={() => setEditing(null)} />
      )}
      {editForm && (
        <TaggedAnimalForm
          key={editForm.id}
          initial={editForm}
          groups={farm.groups}
          onSubmit={(values) => update(editForm, values)}
          onCancel={() => setEditing(null)}
        />
      )}

      {data.taggedAnimals.length === 0 ? (
        <p className="empty">
          No tagged animals yet. Groups still keep head counts; add animals here when you want to
          follow one on its own, such as a cow, a ram or a pedigree ewe.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="records tagged-table" aria-label="Tagged animals">
            <thead>
              <tr>
                <th scope="col">Tag</th>
                <th scope="col">Name</th>
                <th scope="col">Sex</th>
                <th scope="col">Breed</th>
                <th scope="col">Age</th>
                <th scope="col">Group</th>
                <th scope="col">Status</th>
                {canEdit && (
                  <th scope="col">
                    <span className="visually-hidden">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => (
                <tr key={a.id} className={a.status === 'ON_FARM' ? undefined : 'is-gone'}>
                  <th scope="row" className="tag-cell">
                    {a.tag}
                  </th>
                  <td>{a.name ?? '–'}</td>
                  <td>{SEX_LABELS[a.sex]}</td>
                  <td>{a.breed ?? '–'}</td>
                  <td title={a.dateOfBirth ? `Born ${fullDate(a.dateOfBirth)}` : undefined}>
                    {formatAge(a.ageMonths)}
                  </td>
                  <td>
                    {a.group ? <Link to={`/groups/${a.group.id}`}>{a.group.name}</Link> : '–'}
                  </td>
                  <td>
                    {a.status === 'ON_FARM'
                      ? STATUS_LABELS.ON_FARM
                      : `${STATUS_LABELS[a.status]}${a.statusDate ? ` ${fullDate(a.statusDate)}` : ''}`}
                  </td>
                  {canEdit && (
                    <td className="row-actions">
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setEditing(a.id)}
                        aria-label={`Edit ${label(a)}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="link-button link-button--danger"
                        onClick={() => remove(a)}
                        aria-label={`Delete ${label(a)}`}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {animals.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="muted">
                    No animals match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

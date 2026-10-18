import { useQuery } from '@apollo/client';
import { Link, useParams } from 'react-router-dom';
import { CameraLinks } from '../components/CameraLinks';
import { HeadCounter } from '../components/HeadCounter';
import { PageHero } from '../components/photos';
import { PhoneCamera } from '../components/PhoneCamera';
import { FARM_CAMERAS_QUERY } from '../graphql/cameras';
import { canWork } from '../roles';
import type { Camera, FarmRole } from '../types';

interface Data {
  farm: {
    id: string;
    name: string;
    myRole: FarmRole;
    fields: Array<{ id: string; name: string }>;
    groups: Array<{ id: string; name: string; headCount: number }>;
  } | null;
  cameras: Camera[];
}

/** v4.2: watch the animals (CCTV links and the phone camera) and count them. */
export function CamerasPage() {
  const { id = '' } = useParams();
  const { data, loading, error } = useQuery<Data>(FARM_CAMERAS_QUERY, {
    variables: { farmId: id },
  });
  if (loading) return <p aria-live="polite">Loading cameras…</p>;
  if (error)
    return (
      <p className="error" role="alert">
        {error.message}
      </p>
    );
  const farm = data?.farm;
  if (!farm) return <h1>Farm not found</h1>;
  const canEdit = canWork(farm.myRole);

  return (
    <section>
      <PageHero photo="lambs" eyebrow={<Link to={`/farms/${farm.id}`}>{farm.name}</Link>}>
        <div>
          <h1>Cameras and counting</h1>
          <p>Check on the animals from your phone, and count a group against its head count.</p>
        </div>
      </PageHero>
      <div className="cameras-layout">
        <PhoneCamera farmId={farm.id} farmName={farm.name} groups={farm.groups} canSave={canEdit} />
        <HeadCounter groups={farm.groups} canSave={canEdit} />
      </div>
      <CameraLinks
        farmId={farm.id}
        cameras={data.cameras}
        fields={farm.fields}
        groups={farm.groups}
        canEdit={canEdit}
        refetch={{ query: FARM_CAMERAS_QUERY, variables: { farmId: farm.id } }}
      />
    </section>
  );
}

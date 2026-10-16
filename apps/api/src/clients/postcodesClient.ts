export interface Location {
  postcode: string;
  latitude: number;
  longitude: number;
  region: string | null;
}

export interface PostcodeClient {
  /** Returns null when the postcode does not exist. Throws when the service is unavailable. */
  lookup(postcode: string): Promise<Location | null>;
}

interface PostcodesIoResponse {
  status: number;
  result?: {
    postcode: string;
    latitude: number | null;
    longitude: number | null;
    region: string | null;
    admin_district: string | null;
  };
}

/** Client for postcodes.io. Response shape checked against a live response on 16 October 2026. */
export function createPostcodesIoClient(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
): PostcodeClient {
  return {
    async lookup(postcode) {
      const res = await fetchFn(`${baseUrl}/postcodes/${encodeURIComponent(postcode)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`postcodes.io responded ${res.status}`);

      const body = (await res.json()) as PostcodesIoResponse;
      const r = body.result;
      if (!r || r.latitude === null || r.longitude === null) return null;

      return {
        postcode: r.postcode,
        latitude: r.latitude,
        longitude: r.longitude,
        region: r.region ?? r.admin_district ?? null,
      };
    },
  };
}

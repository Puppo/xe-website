import type { APIRoute } from 'astro';
import { loadMemberships } from '../../lib/memberships';
import { memberSummaries } from '../../lib/people';

export const GET: APIRoute = async ({ site }) => {
  const { people, membership } = await loadMemberships();
  return Response.json(memberSummaries(people, site, membership));
};

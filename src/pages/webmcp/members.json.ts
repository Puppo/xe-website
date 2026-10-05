import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { memberSummaries } from '../../lib/people';

export const GET: APIRoute = async ({ site }) => {
  const people = await getCollection(
    'people',
    ({ data }) => data.published && data.roles.includes('member'),
  );
  return Response.json(memberSummaries(people, site));
};

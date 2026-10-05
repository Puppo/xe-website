import type { APIRoute } from 'astro';
import { loadPeopleContext } from '../../lib/people-content';
import { memberSummaries } from '../../lib/people';

export const GET: APIRoute = async ({ site }) => {
  const { people, context } = await loadPeopleContext();
  return Response.json(memberSummaries(people, site, context));
};

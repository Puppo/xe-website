import { getCollection } from 'astro:content';
import { createMembershipContext } from './people';

/** Load all profiles so historical and unpublished references are validated too. */
export async function loadMemberships() {
  const [people, memberships] = await Promise.all([
    getCollection('people'),
    getCollection('memberships'),
  ]);
  return { people, membership: createMembershipContext(memberships, people) };
}

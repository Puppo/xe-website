import { getCollection } from 'astro:content';
import { createMembershipContext, createSpeakerIds } from './people';
import type { PeopleContext } from './people';

/** Load all profiles and published event references for derived public roles. */
export async function loadPeopleContext() {
  const [people, memberships, events] = await Promise.all([
    getCollection('people'),
    getCollection('memberships'),
    getCollection('events', ({ data }) => !data.draft),
  ]);
  const context: PeopleContext = {
    ...createMembershipContext(memberships, people),
    speakerIds: createSpeakerIds(events),
  };
  return { people, context };
}

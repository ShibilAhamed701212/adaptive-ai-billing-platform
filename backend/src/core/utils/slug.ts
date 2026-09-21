import { OrganizationModel } from '../../models/Organization.model';

/**
 * Generates a collision-resistant, unique organization slug. A short random suffix alone
 * can collide on the unique slug index (surfacing as a raw 409 to the user), so
 * uniqueness is settled with a retry loop against the database.
 */
export async function makeUniqueOrgSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'org';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    if (!(await OrganizationModel.exists({ slug: candidate }))) {
      return candidate;
    }
  }
  throw Object.assign(new Error('Could not generate a unique organization slug, please try again'), {
    statusCode: 409,
    code: 'SLUG_GENERATION_FAILED',
  });
}

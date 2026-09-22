import { listProjects } from '../repositories/projects.js';
import { listDesigns } from '../repositories/designs.js';
import { createContentStudio } from '../marketing/content-studio.js';
import { getInstagramConnection, getMembershipRole } from '../repositories/social-connections.js';

export async function contentStudio(workshop, query) {
  const [projects, designs, instagramConnection, membershipRole] = await Promise.all([
    listProjects(workshop.id), listDesigns(workshop.id), getInstagramConnection(workshop.id), getMembershipRole(workshop.id),
  ]);
  const designTypes = designs.reduce((result, design) => {
    (result[design.project_id] ||= new Set()).add(design.type);
    return result;
  }, {});
  return createContentStudio({
    workshop,
    projects,
    designTypes,
    initialProjectId: query?.get('project') || null,
    instagramConnection,
    canPublishInstagram: membershipRole === 'admin',
  });
}

import { listProjects } from '../repositories/projects.js';
import { listDesigns } from '../repositories/designs.js';
import { createContentStudio } from '../marketing/content-studio.js';
import { loadInstagramCapability, getMembershipRole } from '../repositories/social-connections.js';

export async function contentStudio(workshop, query) {
  const [projects, designs] = await Promise.all([listProjects(workshop.id), listDesigns(workshop.id)]);
  const instagram = await loadInstagramCapability(workshop.id);
  const instagramConnection = instagram.kind === 'available' ? instagram.connection : null;
  let membershipRole = null;
  if (instagramConnection?.status === 'connected') {
    try { membershipRole = await getMembershipRole(workshop.id); }
    catch (error) { console.error('[Instagram] No se pudo comprobar el rol de publicación.', error); }
  }
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

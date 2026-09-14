import { PageHeader } from "@/components/admin/PageHeader";
import { ExperienceManager } from "@/components/admin/ExperienceManager";
import { listExperiences } from "@/lib/repo/content";

export default async function ExperiencePage() {
  return (
    <>
      <PageHeader
        title="Experience"
        description="The timeline in your About chapter. Newest first reads best."
      />
      <ExperienceManager experiences={await listExperiences()} />
    </>
  );
}

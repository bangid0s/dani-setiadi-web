import { PageHeader } from "@/components/admin/PageHeader";
import { ExperienceManager } from "@/components/admin/ExperienceManager";
import { listExperiences } from "@/lib/repo/content";

import { FormSuccess } from "@/components/admin/form";

export default async function ExperiencePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <PageHeader
        title="Experience"
        description="The timeline in your About chapter. Newest first reads best."
      />
      {sp.msg && <FormSuccess message={sp.msg} />}
      <ExperienceManager experiences={await listExperiences()} />
    </>
  );
}

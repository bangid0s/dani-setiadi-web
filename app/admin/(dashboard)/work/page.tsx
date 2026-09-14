import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionForm } from "@/components/admin/SectionForm";
import { Field, Toggle, Card, FieldRow } from "@/components/admin/form";
import { workSection } from "@/lib/repo/content";
import { LIMITS } from "@/lib/validation";

export default function WorkAdminPage() {
  const section = workSection();
  const c = section?.content;
  if (!c) return <p>Work chapter is missing. Run the seed script.</p>;

  return (
    <>
      <PageHeader
        title="Work chapter"
        description="The heading and settings for the portfolio chapter. The projects themselves live under Projects."
        actions={
          <Link
            href="/admin/projects"
            className="adm-btn adm-btn-secondary"
          >
            Go to Projects
          </Link>
        }
      />
      <SectionForm sectionKey="work" label="Work">
        <Card title="Heading">
          <div className="space-y-4">
            <Field
              label="Chapter label"
              name="__label"
              defaultValue={section.label}
              max={32}
              hint="The number in front of it is added automatically."
              width="sm"
            />
            <FieldRow>
              <Field
                label="Lead line"
                name="lead"
                defaultValue={c.lead}
                rec={LIMITS.headingLead.rec}
                max={LIMITS.headingLead.max}
                width="sm"
              />
              <Field
                label="Keyword line"
                name="keyword"
                defaultValue={c.keyword}
                rec={LIMITS.headingKeyword.rec}
                max={LIMITS.headingKeyword.max}
                hint="Shown in orange."
                width="sm"
              />
            </FieldRow>
            <Field
              label="Intro line"
              name="intro"
              multiline
              rows={2}
              defaultValue={c.intro ?? ""}
              max={240}
              hint="Optional."
            />
          </div>
        </Card>

        <Card title="Featured block">
          <div className="space-y-4">
            <Toggle
              label="Show featured rows above the gallery"
              name="showFeatured"
              defaultChecked={c.showFeatured}
              hint="Star up to three projects in the Projects list to fill these rows."
            />
            <Field
              label="“See all work” button label"
              name="seeAllLabel"
              defaultValue={c.seeAllLabel}
              max={32}
            width="sm" />
          </div>
        </Card>
      </SectionForm>
    </>
  );
}

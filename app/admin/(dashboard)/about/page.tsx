import { PageHeader } from "@/components/admin/PageHeader";
import { SectionForm } from "@/components/admin/SectionForm";
import { Field, Toggle, Card, FieldRow } from "@/components/admin/form";
import { aboutSection } from "@/lib/repo/content";
import { LIMITS } from "@/lib/validation";
import Link from "next/link";

export default async function AboutAdminPage() {
  const section = await aboutSection();
  const c = section?.content;
  if (!c) return <p>About chapter is missing. Run the seed script.</p>;

  return (
    <>
      <PageHeader
        title="About"
        description="Your “Let’s Connect” chapter — the bio, tools, availability and experience."
      />
      <SectionForm sectionKey="about" label="About">
        <Card title="Heading" description="A quiet lead line in ink over a loud keyword in orange.">
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
          </div>
        </Card>

        <Card
          title="Bio"
          description="Use **double asterisks** for bold, *single* for italic and [text](https://link) for links."
        >
          <Field
            label="Bio"
            name="bio"
            multiline
            rows={6}
            defaultValue={c.bio}
            rec={LIMITS.bio.rec}
            max={LIMITS.bio.max}
            hint={`aim for ${LIMITS.bio.recMin}–${LIMITS.bio.rec} characters`}
          />
        </Card>

        <Card title="Tools and experience">
          <div className="space-y-4">
            <Field label="Tools label" name="toolsLabel" defaultValue={c.toolsLabel} max={24} width="sm" />
            <Toggle label="Show the tools row" name="showTools" defaultChecked={c.showTools} />
            <Field
              label="Experience heading"
              name="experienceHeading"
              defaultValue={c.experienceHeading}
              max={32}
            width="sm" />
            <Toggle
              label="Show the availability pill"
              name="showAvailability"
              defaultChecked={c.showAvailability}
            />
            <Field label="CV button label" name="cvLabel" defaultValue={c.cvLabel} max={32} width="sm" />
            <p className="text-[13px] text-muted">
              Edit the entries themselves under{" "}
              <Link href="/admin/experience" className="underline decoration-signal decoration-2 underline-offset-2">
                Experience
              </Link>{" "}
              and{" "}
              <Link href="/admin/tools" className="underline decoration-signal decoration-2 underline-offset-2">
                Tools
              </Link>
              . The availability wording lives in{" "}
              <Link href="/admin/settings" className="underline decoration-signal decoration-2 underline-offset-2">
                Settings
              </Link>
              .
            </p>
          </div>
        </Card>
      </SectionForm>
    </>
  );
}

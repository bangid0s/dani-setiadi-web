import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { SectionForm } from "@/components/admin/SectionForm";
import { Field, Toggle, Select, Card, FieldRow } from "@/components/admin/form";
import { contactSection } from "@/lib/repo/content";
import { LIMITS } from "@/lib/validation";

export default function ContactAdminPage() {
  const section = contactSection();
  const c = section?.content;
  if (!c) return <p>Contact chapter is missing. Run the seed script.</p>;

  return (
    <>
      <PageHeader
        title="Contact"
        description="How visitors reach you. The addresses themselves are in Settings."
      />
      <SectionForm sectionKey="contact" label="Contact">
        <Card title="Heading and text">
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
              label="Short text"
              name="text"
              multiline
              rows={3}
              defaultValue={c.text ?? ""}
              max={400}
            />
          </div>
        </Card>

        <Card title="Channels">
          <div className="space-y-3">
            <Toggle label="Show email" name="showEmail" defaultChecked={c.showEmail} />
            <Toggle label="Show WhatsApp" name="showWhatsApp" defaultChecked={c.showWhatsApp} />
            <Toggle label="Show social links" name="showSocials" defaultChecked={c.showSocials} />
            <Toggle label="Show the CV button" name="showCv" defaultChecked={c.showCv} />
            <Select
              label="Preferred channel for the main button"
              name="primaryChannel"
              defaultValue={c.primaryChannel}
              options={[
                { value: "whatsapp", label: "WhatsApp" },
                { value: "email", label: "Email" },
              ]}
            />
            <p className="text-[13px] text-muted">
              Set your email address, WhatsApp number and social links in{" "}
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

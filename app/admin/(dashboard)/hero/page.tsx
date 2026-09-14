import { PageHeader } from "@/components/admin/PageHeader";
import { SectionForm } from "@/components/admin/SectionForm";
import { Field, NumberField, Select, Toggle, Card, FieldRow } from "@/components/admin/form";
import { MediaField } from "@/components/media/MediaField";
import { heroSection } from "@/lib/repo/content";
import { getMedia } from "@/lib/repo/media";
import { LIMITS } from "@/lib/validation";

export default async function HeroAdminPage() {
  const section = await heroSection();
  const c = section?.content;
  if (!c) return <p>Hero chapter is missing. Run the seed script.</p>;

  return (
    <>
      <PageHeader
        title="Hero"
        description="The first thing a visitor sees: the greeting, your name, what you do and where you are."
      />
      <SectionForm sectionKey="hero" label="Hero">
        <Card title="Greeting and name">
          <div className="space-y-4">
            <Field
              label="Chapter label"
              name="__label"
              hint="The number in front of it is added automatically."
              defaultValue={section.label}
              max={32}
              width="sm"
            />
            <Select
              label="Greeting style"
              name="greetingMode"
              defaultValue={c.greetingMode}
              hint="SVG keeps your custom lettering exact."
              options={[
                { value: "text", label: "Text in the script font" },
                { value: "svg", label: "SVG lettering (upload below)" },
              ]}
            />
            <Field
              label="Greeting text"
              name="greetingText"
              defaultValue={c.greetingText}
              rec={LIMITS.greetingText.rec}
              max={LIMITS.greetingText.max}
              hint="Also read aloud by screen readers."
              width="sm"
            />
            <MediaField
              name="greetingSvgId"
              label="Greeting lettering (SVG)"
              hint="Only used when the greeting style above is set to SVG."
              initial={await getMedia(c.greetingSvgId)}
              allow={{ upload: true, svgOnly: true }}
            />
            <Field
              label="Display name"
              name="displayName"
              defaultValue={c.displayName}
              rec={LIMITS.displayName.rec}
              max={LIMITS.displayName.max}
              hint="Over 14 characters, the hero switches to two lines."
              required
              width="md"
            />
            <FieldRow>
              <Select
                label="Name layout"
                name="nameLayout"
                defaultValue={c.nameLayout}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "one-line", label: "One line" },
                  { value: "two-lines", label: "Two lines" },
                ]}
              />
              <NumberField
                label="Name size"
                name="nameScale"
                step={0.01}
                min={0.9}
                max={1.1}
                defaultValue={c.nameScale ?? 1}
                hint="Between 0.9 and 1.1."
              />
            </FieldRow>
          </div>
        </Card>

        <Card title="Role and location">
          <div className="space-y-4">
            <Field
              label="Role line"
              name="roleLine"
              defaultValue={c.roleLine}
              rec={LIMITS.roleLine.rec}
              max={LIMITS.roleLine.max}
              width="md"
            />
            <Field
              label="Location line"
              name="locationLine"
              defaultValue={c.locationLine}
              rec={LIMITS.locationLine.rec}
              max={LIMITS.locationLine.max}
              width="md"
            />
            <Toggle
              label="Show the location pin icon"
              name="showLocationIcon"
              defaultChecked={c.showLocationIcon}
            />
          </div>
        </Card>

        <Card
          title="Portrait"
          description="A transparent cutout (PNG or WebP with alpha) looks best — the site adds the soft shadow."
        >
          <div className="space-y-4">
            <MediaField
              name="portraitId"
              label="Portrait image"
              initial={await getMedia(c.portraitId)}
              allow={{ upload: true, url: true }}
            />
            <Select
              label="Portrait style"
              name="portraitStyle"
              defaultValue={c.portraitStyle}
              options={[
                { value: "cutout", label: "Transparent cutout" },
                { value: "matched-photo", label: "Photo with a cream-matched background" },
              ]}
            />
            <FieldRow cols={3}>
              <NumberField
                label="Horizontal position"
                name="portraitPositionX"
                min={0}
                max={100}
                defaultValue={c.portraitPosition?.x ?? 53}
                hint="Percent from the left edge."
              />
              <NumberField
                label="Vertical anchor"
                name="portraitPositionY"
                min={0}
                max={100}
                defaultValue={c.portraitPosition?.y ?? 100}
                hint="Percent — 100 sits on the bottom edge."
              />
              <NumberField
                label="Scale"
                name="portraitScale"
                step={0.01}
                min={0.5}
                max={1.5}
                defaultValue={c.portraitScale ?? 1}
              />
            </FieldRow>
          </div>
        </Card>
      </SectionForm>
    </>
  );
}

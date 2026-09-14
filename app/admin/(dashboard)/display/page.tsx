import { PageHeader } from "@/components/admin/PageHeader";
import { DisplaySettingsForm } from "@/components/admin/DisplaySettingsForm";
import { getSettings } from "@/lib/repo/content";

export default function DisplayPage() {
  return (
    <>
      <PageHeader
        title="Display settings"
        description="How the portfolio grid behaves: layout, columns, spacing and how many items load at a time."
      />
      <DisplaySettingsForm settings={getSettings().gallery} />
    </>
  );
}

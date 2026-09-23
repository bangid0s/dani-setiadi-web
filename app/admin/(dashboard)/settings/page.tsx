import { PageHeader } from "@/components/admin/PageHeader";
import { SettingsForms } from "@/components/admin/SettingsForms";
import { getSettings } from "@/lib/repo/content";
import { listAdmins, currentAdmin } from "@/lib/auth";

export default async function SettingsPage() {
  const [me, settings, admins] = await Promise.all([
    currentAdmin(),
    getSettings(),
    listAdmins(),
  ]);
  return (
    <>
      <PageHeader
        title="Settings"
        description="Contact details, availability, search listing, wording and account access."
      />
      <SettingsForms
        settings={settings}
        admins={admins}
        currentUserId={me?.userId ?? ""}
      />
    </>
  );
}

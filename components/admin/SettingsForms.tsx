"use client";

import { useActionState, useState } from "react";
import {
  saveSiteSettingsAction, saveAvailabilityAction, saveSocialLinksAction,
  saveUiLabelsAction, setCvAction, changePasswordAction, inviteAdminAction,
  removeAdminAction, type ActionState,
} from "@/app/admin/actions";
import {
  Field, Select, Toggle, Submit, Card, FormError, FormSuccess, FieldRow,
} from "@/components/admin/form";
import { MediaField } from "@/components/media/MediaField";
import { LIMITS } from "@/lib/validation";
import type { AdminUser, SiteSettings } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function SettingsForms({
  settings,
  admins,
  currentUserId,
}: {
  settings: SiteSettings;
  admins: AdminUser[];
  currentUserId: string;
}) {
  return (
    <div className="space-y-6">
      <ContactSettings settings={settings} />
      <AvailabilitySettings settings={settings} />
      <SocialSettings settings={settings} />
      <CvSettings settings={settings} />
      <SeoSettings settings={settings} />
      <LabelSettings settings={settings} />
      <AccountSettings admins={admins} currentUserId={currentUserId} />
    </div>
  );
}

function ContactSettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSiteSettingsAction, initial);
  return (
    <Card title="Contact" description="Used by the contact chapter, the buttons and the footer.">
      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <input type="hidden" name="siteTitlePattern" value={settings.siteTitlePattern} />
        <input type="hidden" name="metaDescription" value={settings.metaDescription} />
        <Field label="Email address" name="contactEmail" type="email" defaultValue={settings.contactEmail} max={120} width="md" />
        <Field
          label="WhatsApp number"
          name="whatsappE164"
          defaultValue={settings.whatsappE164}
          max={20}
          hint="International format, starting with +. For Indonesia that looks like +6281234567890."
          width="sm"
        />
        <Field
          label="Prefilled WhatsApp message"
          name="whatsappMessage"
          multiline
          rows={2}
          defaultValue={settings.whatsappMessage}
          max={300}
        />
        <Toggle
          label="Show a floating WhatsApp button on mobile"
          name="showFloatingWhatsApp"
          defaultChecked={settings.showFloatingWhatsApp}
        />
        <Submit pending={pending}>Save contact details</Submit>
      </form>
    </Card>
  );
}

function AvailabilitySettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveAvailabilityAction, initial);
  const a = settings.availability;
  return (
    <Card
      title="Availability"
      description="The pill in the navigation and the About chapter."
    >
      <div id="availability" />
      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <Select
          label="Status"
          name="status"
          defaultValue={a.status}
          options={[
            { value: "open", label: "Open for work" },
            { value: "limited", label: "Limited availability" },
            { value: "closed", label: "Not taking work" },
          ]}
        />
        <Field
          label="Pill label"
          name="label"
          defaultValue={a.label}
          rec={LIMITS.pillLabel.rec}
          max={LIMITS.pillLabel.max}
          hint="Shown in capitals."
          width="sm"
        />
        <Field
          label="Caption under the pill"
          name="caption"
          defaultValue={a.caption}
          rec={LIMITS.pillCaption.rec}
          max={LIMITS.pillCaption.max}
          width="md"
        />
        <Field
          label="Where the pill links"
          name="linkTarget"
          defaultValue={a.linkTarget}
          max={300}
          hint="Type contact, whatsapp or email — or paste a full web address."
          width="md"
        />
        <Toggle
          label="Hide the pill completely when the status is “not taking work”"
          name="hideWhenClosed"
          defaultChecked={a.hideWhenClosed}
        />
        <Submit pending={pending}>Save availability</Submit>
      </form>
    </Card>
  );
}

function SocialSettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSocialLinksAction, initial);
  const [rows, setRows] = useState(
    settings.socialLinks.length
      ? settings.socialLinks
      : [{ platform: "", label: "", url: "", showInFooter: true, showInContact: true }],
  );

  return (
    <Card title="Social links">
      <form action={action} className="space-y-3">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        {rows.map((row, i) => (
          <div key={i} className="rounded-[var(--radius-admin)] border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)]">
              <input
                name="platform"
                defaultValue={row.platform}
                placeholder="Platform (e.g. Instagram)"
                aria-label={`Platform ${i + 1}`}
                className="adm-input min-w-32 flex-1"
              />
              <input
                name="label"
                defaultValue={row.label}
                placeholder="Shown as (optional)"
                aria-label={`Label ${i + 1}`}
                className="adm-input min-w-32 flex-1"
              />
              <input
                name="url"
                type="url"
                defaultValue={row.url}
                placeholder="https://…"
                aria-label={`Address ${i + 1}`}
                className="adm-input min-w-48 flex-[2]"
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="hidden" name={`footer-${i}`} value="0" />
                <input type="checkbox" name={`footer-${i}`} value="1" defaultChecked={row.showInFooter} className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]" />
                In the footer
              </label>
              <label className="flex items-center gap-2 text-[13px] text-ink">
                <input type="hidden" name={`contact-${i}`} value="0" />
                <input type="checkbox" name={`contact-${i}`} value="1" defaultChecked={row.showInContact} className="size-[18px] shrink-0 rounded-[4px] accent-[var(--color-signal)]" />
                In the contact chapter
              </label>
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="ml-auto text-[13px] text-ember underline decoration-2 underline-offset-2"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setRows([...rows, { platform: "", label: "", url: "", showInFooter: true, showInContact: true }])
          }
          className="adm-link text-[13px]"
        >
          Add another link
        </button>
        <div>
          <Submit pending={pending}>Save social links</Submit>
        </div>
      </form>
    </Card>
  );
}

function CvSettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(setCvAction, initial);
  const [path, setPath] = useState(settings.cvPath ?? "");
  const [filename, setFilename] = useState(settings.cvFilename ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.append("file", file);
    body.append("kind", "pdf");
    const res = await fetch("/api/media/upload", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That file couldn’t be uploaded.");
      return;
    }
    setPath(data.path);
    setFilename(data.filename);
  };

  return (
    <Card title="CV" description="The PDF behind your “Download CV” button. Up to 10 MB.">
      <form action={action} className="space-y-3">
        <FormError message={state.error ?? error} />
        <FormSuccess message={state.success} />
        <input type="hidden" name="cvPath" value={path} />
        <input type="hidden" name="cvFilename" value={filename} />
        {path ? (
          <p className="text-[14px] text-ink">
            Current:{" "}
            <a href={path} target="_blank" rel="noreferrer" className="underline decoration-signal decoration-2 underline-offset-2">
              {filename || "CV.pdf"}
            </a>
          </p>
        ) : (
          <p className="text-[14px] text-muted">No CV uploaded yet.</p>
        )}
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="block w-full text-[13.5px] text-muted file:mr-3 file:cursor-pointer file:rounded-[var(--radius-admin)] file:border-0 file:bg-signal file:px-3.5 file:py-2 file:text-[13.5px] file:font-semibold file:text-ink hover:file:bg-ember hover:file:text-cream"
        />
        {busy ? <p className="text-[13px] text-muted">Uploading…</p> : null}
        <div className="flex gap-2">
          <Submit pending={pending}>Save CV</Submit>
          {path ? (
            <button
              type="button"
              onClick={() => {
                setPath("");
                setFilename("");
              }}
              className="adm-btn adm-btn-secondary"
            >
              Remove
            </button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

function SeoSettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveSiteSettingsAction, initial);
  return (
    <Card title="Search and sharing" description="How your site looks in Google and when shared in chat.">
      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <input type="hidden" name="contactEmail" value={settings.contactEmail} />
        <input type="hidden" name="whatsappE164" value={settings.whatsappE164} />
        <input type="hidden" name="whatsappMessage" value={settings.whatsappMessage} />
        <input type="hidden" name="showFloatingWhatsApp" value={settings.showFloatingWhatsApp ? "1" : "0"} />
        <Field
          label="Page title pattern"
          name="siteTitlePattern"
          defaultValue={settings.siteTitlePattern}
          max={80}
          hint="%s is replaced by the name of each page."
          width="md"
        />
        <Field
          label="Site description"
          name="metaDescription"
          multiline
          rows={3}
          defaultValue={settings.metaDescription}
          rec={160}
          max={300}
        />
        <MediaField
          name="ogImageId"
          label="Share image"
          hint="1200 × 630 pixels works best."
          initial={settings.ogImage}
          allow={{ upload: true, url: true }}
        />
        <MediaField
          name="faviconId"
          label="Favicon"
          hint="Square, at least 512 pixels."
          initial={settings.favicon}
          allow={{ upload: true }}
        />
        <Submit pending={pending}>Save search settings</Submit>
      </form>
    </Card>
  );
}

function LabelSettings({ settings }: { settings: SiteSettings }) {
  const [state, action, pending] = useActionState(saveUiLabelsAction, initial);
  const l = settings.uiLabels;
  return (
    <Card title="Wording" description="Every button and message on the site.">
      <form action={action} className="space-y-4">
        <FormError message={state.error} />
        <FormSuccess message={state.success} />
        <FieldRow>
          <Field label="“Load more” button" name="loadMore" defaultValue={l.loadMore} max={32} />
          <Field label="“View project” link" name="viewProject" defaultValue={l.viewProject} max={32} />
          <Field label="“Download CV” button" name="downloadCv" defaultValue={l.downloadCv} max={32} />
          <Field label="“All” filter chip" name="allFilter" defaultValue={l.allFilter} max={24} />
          <Field label="“Back to top”" name="backToTop" defaultValue={l.backToTop} max={24} />
          <Field label="Mobile menu button" name="menu" defaultValue={l.menu} max={16} />
          <Field label="Skip link" name="skipToContent" defaultValue={l.skipToContent} max={32} />
          <Field label="When an image fails" name="imageUnavailable" defaultValue={l.imageUnavailable} max={48} />
        </FieldRow>
        <Field label="When there’s no work yet" name="emptyWork" defaultValue={l.emptyWork} max={120} />

        <fieldset className="rounded-[var(--radius-admin)] border border-line p-3">
          <legend className="px-1 text-[13px] font-semibold text-ink">404 page</legend>
          <FieldRow>
            <Field label="Script line" name="notFoundLead" defaultValue={l.notFoundLead} max={24} />
            <Field label="Big line" name="notFoundKeyword" defaultValue={l.notFoundKeyword} max={16} />
          </FieldRow>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Message" name="notFoundText" defaultValue={l.notFoundText} max={160} />
            <Field label="Button" name="notFoundCta" defaultValue={l.notFoundCta} max={32} />
          </div>
        </fieldset>

        <Field label="Footer credit line" name="footerCredit" defaultValue={l.footerCredit} max={80} />
        <Toggle label="Show the footer credit" name="showFooterCredit" defaultChecked={l.showFooterCredit} />
        <Submit pending={pending}>Save wording</Submit>
      </form>
    </Card>
  );
}

function AccountSettings({
  admins,
  currentUserId,
}: {
  admins: AdminUser[];
  currentUserId: string;
}) {
  const [pwState, pwAction, pwPending] = useActionState(changePasswordAction, initial);
  const [inviteState, inviteAction, invitePending] = useActionState(inviteAdminAction, initial);

  return (
    <Card title="Account" description="Your password, and who else can sign in.">
      <form action={pwAction} className="space-y-4">
        <FormError message={pwState.error} />
        <FormSuccess message={pwState.success} />
        <FieldRow>
          <Field label="New password" name="password" type="password" autoComplete="new-password" hint="At least 10 characters." />
          <Field label="Repeat it" name="confirm" type="password" autoComplete="new-password" />
        </FieldRow>
        <Submit pending={pwPending}>Change password</Submit>
      </form>

      <div className="mt-6 border-t border-line pt-5">
        <p className="text-[13px] font-semibold text-ink">Who can sign in</p>
        <ul className="mt-2 divide-y divide-line">
          {admins.map((a) => (
            <li key={a.userId} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0 truncate text-[14px] text-ink">
                {a.email}
                <span className="ml-2 text-[12px] capitalize text-muted">{a.role}</span>
                {a.userId === currentUserId ? <span className="ml-2 text-[12px] text-muted">you</span> : null}
              </span>
              {a.userId !== currentUserId && admins.length > 1 ? (
                <form action={removeAdminAction}>
                  <input type="hidden" name="userId" value={a.userId} />
                  <button type="submit" className="shrink-0 text-[13px] font-medium text-ember underline decoration-2 underline-offset-2 hover:opacity-80">
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>

        <form action={inviteAction} className="mt-4 space-y-4">
          <FormError message={inviteState.error} />
          <FormSuccess message={inviteState.success} />
          <FieldRow cols={3}>
            <Field label="Name" name="name" max={80} />
            <Field label="Email" name="email" type="email" max={120} />
            <Field label="Starting password" name="password" hint="At least 10 characters." />
          </FieldRow>
          <Submit pending={invitePending} variant="outline">
            Give access
          </Submit>
        </form>
      </div>
    </Card>
  );
}

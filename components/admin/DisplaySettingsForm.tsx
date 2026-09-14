"use client";

import { useActionState } from "react";
import { saveDisplaySettingsAction, type ActionState } from "@/app/admin/actions";
import {
  NumberField, Select, Toggle, Submit, Card, FormError, FormSuccess, FormGuards,
} from "@/components/admin/form";
import type { GallerySettings } from "@/lib/types";

const initial: ActionState = { error: null, success: null };

export function DisplaySettingsForm({ settings }: { settings: GallerySettings }) {
  const [state, action, pending] = useActionState(saveDisplaySettingsAction, initial);

  return (
    <form action={action} data-guard className="space-y-6">
      <FormGuards />
      <FormError message={state.error} />
      <FormSuccess message={state.success} />

      <Card
        title="Layout"
        description="Masonry keeps every artwork at its own shape — best when your work mixes square posts, tall posters and wide videos."
      >
        <div className="space-y-4">
          <Select
            label="Gallery layout"
            name="layout"
            defaultValue={settings.layout}
            options={[
              { value: "masonry", label: "Masonry — native shapes, staggered columns" },
              { value: "grid", label: "Uniform grid — everything cropped to one shape" },
            ]}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField label="Columns — desktop" name="colDesktop" min={2} max={4} defaultValue={settings.columns.desktop} />
            <NumberField label="Columns — tablet" name="colTablet" min={1} max={3} defaultValue={settings.columns.tablet} />
            <NumberField label="Columns — mobile" name="colMobile" min={1} max={2} defaultValue={settings.columns.mobile} />
          </div>
          <Select
            label="Spacing between items"
            name="gap"
            defaultValue={settings.gap}
            options={[
              { value: "S", label: "Small" },
              { value: "M", label: "Medium" },
              { value: "L", label: "Large" },
            ]}
          />
          <Select
            label="Caption style"
            name="captionStyle"
            defaultValue={settings.captionStyle}
            options={[
              { value: "below", label: "Below the image" },
              { value: "overlay", label: "Overlay on hover (always visible on touch)" },
            ]}
          />
        </div>
      </Card>

      <Card title="How much to show">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Items on the home page" name="pageHome" min={3} max={48} defaultValue={settings.pageSize.home} />
            <NumberField label="Items per page on /work" name="pageWork" min={6} max={48} defaultValue={settings.pageSize.work} />
          </div>
          <Toggle label="Show category filters" name="showFilters" defaultChecked={settings.showFilters} />
          <Toggle
            label="Include featured projects in the gallery too"
            name="includeFeatured"
            defaultChecked={settings.includeFeatured}
          />
          <Select
            label="Default behaviour when a card is clicked"
            name="defaultOpenAs"
            defaultValue={settings.defaultOpenAs}
            hint="Each project can override this."
            options={[
              { value: "auto", label: "Auto — lightbox for single images, page for case studies" },
              { value: "lightbox", label: "Always open the lightbox" },
              { value: "page", label: "Always open the project page" },
            ]}
          />
        </div>
      </Card>

      <div className="adm-actionbar -mx-5 px-5 lg:-mx-10 lg:px-10">
        <Submit pending={pending}>Save display settings</Submit>
      </div>
    </form>
  );
}

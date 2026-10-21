'use client';

import * as React from 'react';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { APP_SECTIONS, type SectionToggles } from '@/lib/app-sections';

/**
 * APP MANAGER — control what buyers and sellers can reach in the normal app.
 *
 * Buyers and sellers share one app for now; this page switches individual
 * sections off per role, which removes the nav entry and blocks the route.
 *
 * What this is NOT, stated plainly so nobody relies on it as a security
 * control: this hides a surface from the app. It does not revoke API
 * authorization, and it is not a substitute for the admin role boundary. If a
 * section holds something that must never be reachable, remove the permission
 * at the data layer as well.
 */
export default function AdminAppManagerPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const [toggles, setToggles] = React.useState<SectionToggles>({});
  const [saved, setSaved] = React.useState<SectionToggles>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Admin-gated API: the Bearer token is required, otherwise this page 403s
  // and looks broken even when configuration is perfectly healthy.
  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/app-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 403) throw new Error('This account is not an admin.');
      if (!res.ok) throw new Error('Could not load app configuration.');
      const data = (await res.json()) as { sections?: SectionToggles };
      const next = data.sections ?? {};
      setToggles(next);
      setSaved(next);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'App configuration unavailable',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const dirty = React.useMemo(
    () => JSON.stringify(toggles) !== JSON.stringify(saved),
    [toggles, saved]
  );

  const disabledCount = React.useMemo(
    () => APP_SECTIONS.filter((s) => toggles[s.id] === false).length,
    [toggles]
  );

  async function save() {
    if (!user) return;
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/app-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sections: toggles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Save failed.');
      setSaved(data.sections ?? toggles);
      setToggles(data.sections ?? toggles);
      toast({ title: 'App sections saved', description: 'Users will see the change on their next navigation.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not save',
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  const setAll = (value: boolean) => {
    const next: SectionToggles = {};
    for (const section of APP_SECTIONS) next[section.id] = value;
    setToggles(next);
  };

  return (
    <AdminLayout>
      <div className="vn-page-enter flex-1 space-y-8 p-4 md:p-8 lg:p-10 max-w-5xl">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            SYSTEM
          </p>
          <h1 className="font-grotesk text-xl md:text-2xl font-semibold text-foreground tracking-wide">
            APP MANAGER
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Switch off any section of the buyer and seller app. Disabled sections lose
            their menu entry and their routes redirect back to the user's own home.
            Nothing is deleted — switch it back on to restore it.
          </p>
        </div>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-foreground/80">
              This controls what the <strong>app</strong> shows buyers and sellers. It does
              not change API permissions or admin access, so it is a surface control rather
              than a security boundary. Disabling a section can also remove the only way a
              user can reach something they are entitled to — buyers and sellers share one
              app for now, so check both roles before switching off shared features.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div>
              <CardTitle className="font-grotesk">App sections</CardTitle>
              <CardDescription>
                {loading
                  ? 'Loading…'
                  : disabledCount === 0
                    ? 'All sections are currently enabled.'
                    : `${disabledCount} section${disabledCount === 1 ? '' : 's'} disabled.`}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setAll(true)} disabled={loading || saving}>
                Enable all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAll(false)} disabled={loading || saving}>
                Disable all
              </Button>
              <Button variant="outline" size="icon" onClick={load} disabled={loading || saving} aria-label="Reload">
                <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-1">
            {loading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading sections…
              </div>
            ) : (
              APP_SECTIONS.map((section) => {
                const on = toggles[section.id] !== false;
                return (
                  <div
                    key={section.id}
                    className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{section.label}</p>
                        {section.roles.map((role) => (
                          <Badge key={role} variant="secondary" className="text-[10px] uppercase tracking-wider">
                            {role}
                          </Badge>
                        ))}
                        {on ? (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600">
                            <Eye className="h-3 w-3" /> Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            <EyeOff className="h-3 w-3" /> Hidden
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{section.description}</p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        {section.prefixes.join('  ')}
                      </p>
                    </div>
                    <Switch
                      checked={on}
                      disabled={saving}
                      onCheckedChange={(checked) =>
                        setToggles((prev) => ({ ...prev, [section.id]: checked }))
                      }
                      aria-label={`${on ? 'Disable' : 'Enable'} ${section.label}`}
                    />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
          {dirty && (
            <Button variant="ghost" onClick={() => setToggles(saved)} disabled={saving}>
              Discard
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-grotesk">
              <Smartphone className="h-4 w-4" /> Installable application
            </CardTitle>
            <CardDescription>
              The app is a Progressive Web App. It installs from this site — no separate
              binary is produced, and there is nothing to download or rebuild.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => window.open('/app-preview', '_blank', 'noopener')}
              >
                <Download className="mr-2 h-4 w-4" /> Open the app shell
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const url = new URL('/manifest.json', window.location.origin);
                  const a = document.createElement('a');
                  a.href = url.toString();
                  a.download = 'vidnov-manifest.json';
                  a.click();
                }}
              >
                <Download className="mr-2 h-4 w-4" /> Download manifest
              </Button>
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                Android / Chrome — “Install Vidnov App” in the buyer or seller sidebar.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                iOS / Safari — Share → Add to Home Screen.
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                The installed app launches at <code className="font-mono">/app-preview</code> and keeps its
                own login session, separate from the website.
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
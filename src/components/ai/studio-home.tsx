'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser, useUserProfile } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Clapperboard,
  Coins,
  Film,
  Image as ImageIcon,
  Images,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiStudioWorkspace, type StudioMode, type AiJobSummary } from './studio-workspace';
import { GenerationHistory, type AiJobView } from './generation-history';
import { GenerationQueue } from './generation-queue';
import { AiCreationViewer } from './creation-viewer';

/**
 * VIDNOV AI STUDIO — HOME (spec §1–13).
 *
 * One page that holds the whole creation system:
 *   tool cards → workspace → queue → My Creations → Generation History,
 * plus the AI Points balance. Everything talks to the gateway, so swapping
 * the engine (Wan2.1 on your GPU, Gemini today) never changes this UI.
 */

type Pricing = Record<string, { points: number; maxDurationSeconds?: number }>;

interface ToolCard {
  mode: StudioMode;
  name: string;
  description: string;
  inputType: string;
  outputType: string;
  engine: string;
  icon: typeof Film;
  grad: string;
}

const TOOLS: ToolCard[] = [
  {
    mode: 'text-to-video',
    name: 'Text → Video',
    description: 'Describe a scene and Wan2.1 renders a cinematic clip for your listing or ad.',
    inputType: 'Text prompt',
    outputType: 'MP4 video',
    engine: 'Wan 2.2',
    icon: Clapperboard,
    grad: 'vn-grad-coral',
  },
  {
    mode: 'image-to-video',
    name: 'Image → Video',
    description: 'Animate a still — product photos become slow commercial camera moves.',
    inputType: 'Image + movement prompt',
    outputType: 'MP4 video',
    engine: 'Wan 2.2',
    icon: Film,
    grad: 'vn-grad-ocean',
  },
  {
    mode: 'text-to-image',
    name: 'Text → Image',
    description: 'Turn a description into a studio-grade image for ads, listings or social posts.',
    inputType: 'Text prompt',
    outputType: 'PNG image',
    engine: 'FLUX Kontext',
    icon: Wand2,
    grad: 'vn-grad-violet',
  },
  {
    mode: 'image-to-image',
    name: 'Image → Image',
    description: 'Restyle an existing image — new backgrounds, variations and ad layouts.',
    inputType: 'Image + instruction',
    outputType: 'PNG image',
    engine: 'FLUX Kontext',
    icon: Images,
    grad: 'vn-grad-ember',
  },
  {
    mode: 'image-animation',
    name: 'Animate Image',
    description: 'Apply a motion preset to any image — the quickest route to a social clip.',
    inputType: 'Image + preset',
    outputType: 'MP4 video',
    engine: 'Wan 2.2',
    icon: Sparkles,
    grad: 'vn-grad-violet',
  },
];

const STATUS_VARIANT: Record<string, string> = {
  COMPLETED: 'text-emerald-400',
  PROCESSING: 'text-sky-300',
  QUEUED: 'text-amber-300',
  FAILED: 'text-red-400',
  CANCELLED: 'text-white/40',
};

function createdLabel(value: unknown): string {
  const ts = value as { toDate?: () => Date } | null | undefined;
  const d = typeof ts?.toDate === 'function' ? ts.toDate() : null;
  return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
}

export function AiStudioHome() {
  const { user } = useUser();
  const { userProfile } = useUserProfile(user?.uid);
  const searchParams = useSearchParams();

  const initialMode = (searchParams?.get('mode') as StudioMode | null) ?? null;
  const [selected, setSelected] = React.useState<StudioMode | null>(initialMode);
  const [jobs, setJobs] = React.useState<AiJobView[] | null>(null);
  const [loadingJobs, setLoadingJobs] = React.useState(false);
  const [pricing, setPricing] = React.useState<Pricing>({});
  const [viewerJob, setViewerJob] = React.useState<AiJobView | null>(null);
  const [points, setPoints] = React.useState<number | null>(null);

  const workspaceRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch('/api/ai/generate')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data?.pricing && setPricing(data.pricing))
      .catch(() => undefined);
  }, []);

  const loadJobs = React.useCallback(async () => {
    if (!user) return;
    setLoadingJobs(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/ai/jobs', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = (await res.json()) as { jobs: AiJobView[] };
        setJobs(data.jobs ?? []);
      }
    } catch {
      // history is best-effort
    } finally {
      setLoadingJobs(false);
    }
  }, [user]);

  React.useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll while work is in flight; also refresh the points balance (spec §8).
  React.useEffect(() => {
    const inFlight = (jobs ?? []).some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING');
    if (!inFlight) return;
    const timer = setInterval(loadJobs, 6000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs]);

  React.useEffect(() => {
    if (userProfile) setPoints(Number((userProfile as { aiPoints?: number }).aiPoints ?? 0));
  }, [userProfile]);

  const handleCreated = (job: AiJobSummary) => {
    setJobs((prev) => [
      {
        id: job.jobId,
        type: selected ?? 'text-to-image',
        status: 'QUEUED',
        prompt: null,
        createdAt: new Date(),
      },
      ...(prev ?? []),
    ]);
    setSelected(null);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    void loadJobs();
  };

  const handleDelete = async (job: AiJobView) => {
    setJobs((prev) => (prev ?? []).filter((j) => j.id !== job.id));
    try {
      const token = await user?.getIdToken();
      await fetch(`/api/ai/jobs?id=${encodeURIComponent(job.id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // best-effort
    }
  };

  const handleCancel = async (job: AiJobView) => {
    setJobs((prev) => (prev ?? []).map((j) => (j.id === job.id ? { ...j, status: 'CANCELLED' } : j)));
    try {
      const token = await user?.getIdToken();
      await fetch(`/api/ai/jobs?id=${encodeURIComponent(job.id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      void loadJobs();
    } catch {
      // best-effort
    }
  };

  const promptParam = searchParams?.get('prompt') ?? undefined;
  const selectedTool = TOOLS.find((t) => t.mode === selected);

  return (
    <div className="space-y-16 pb-10">
      {/* Tool cards — Create New */}
      <section id="tools">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.4em] text-white/40">Create new</p>
            <h2 className="vn-display mt-3 text-3xl md:text-4xl">Pick your tool</h2>
          </div>
          {points !== null && (
            <div className="rounded-2xl border border-white/12 bg-white/[0.05] px-5 py-3 text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">AI points</p>
              <p className="vn-display text-2xl text-white">{points.toLocaleString()}</p>
            </div>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <div
              key={tool.mode}
              className={cn(
                'group flex flex-col rounded-2xl border p-6 transition lg:p-7',
                selected === tool.mode
                  ? 'border-primary/70 bg-white/[0.08]'
                  : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]',
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', tool.grad)}>
                  <tool.icon className="h-5 w-5 text-white" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">{tool.engine}</span>
              </div>
              <p className="mt-5 font-grotesk text-base font-semibold tracking-wide">{tool.name}</p>
              <p className="mt-1.5 text-xs text-white/45">{tool.description}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                <span className="rounded-full border border-white/10 px-2.5 py-1">In: {tool.inputType}</span>
                <span className="rounded-full border border-white/10 px-2.5 py-1">Out: {tool.outputType}</span>
                {pricing[tool.mode] && (
                  <span className="rounded-full border border-primary/30 px-2.5 py-1 text-primary">
                    {pricing[tool.mode].points} pts
                  </span>
                )}
              </div>
              <Button
                className="mt-6 w-full rounded-xl font-black uppercase tracking-wide"
                onClick={() => {
                  setSelected(selected === tool.mode ? null : tool.mode);
                  window.setTimeout(
                    () => workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                    50,
                  );
                }}
              >
                {selected === tool.mode ? 'Close' : 'Generate'}
              </Button>
            </div>
          ))}

          {/* My Creations + History shortcuts */}
          <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/20 p-6 lg:p-7">
            <div>
              <p className="font-grotesk text-base font-semibold tracking-wide">My Creations</p>
              <p className="mt-1.5 text-xs text-white/45">
                Every AI image and video you generated, stored in your Vidnov Media library.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/10"
              onClick={() => document.getElementById('creations')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <ImageIcon className="mr-2 h-4 w-4" /> Open My Creations
            </Button>
            <div className="mt-auto">
              <p className="font-grotesk text-base font-semibold tracking-wide">Generation History</p>
              <p className="mt-1.5 text-xs text-white/45">
                Job IDs, models, prompts, status and processing time for every run.
              </p>
            </div>
            <Button
              variant="outline"
              className="border-white/15 text-white hover:bg-white/10"
              onClick={() => document.getElementById('history')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Open History
            </Button>
          </div>
        </div>
      </section>

      {/* Workspace */}
      <div ref={workspaceRef}>
        {selectedTool ? (
          <div className="rounded-2xl border border-white/12 bg-white/[0.04] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-grotesk text-lg font-black uppercase tracking-tight">{selectedTool.name}</h2>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/40">
                <Coins className="h-3.5 w-3.5" />
                {pricing[selectedTool.mode] ? `${pricing[selectedTool.mode].points} points per generation` : 'Points charged per generation'}
              </div>
            </div>
            <div className="mt-6 text-foreground">
              <AiStudioWorkspace
                key={selectedTool.mode}
                mode={selectedTool.mode}
                initialPrompt={promptParam}
                pointsCost={pricing[selectedTool.mode]?.points}
                onCreated={handleCreated}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-white/40">
            Choose a tool above to start creating.
          </div>
        )}
      </div>

      {/* Queue */}
      <GenerationQueue jobs={jobs ?? []} onCancel={handleCancel} onView={setViewerJob} />

      {/* My Creations */}
      <section id="creations">
        <GenerationHistory
          jobs={jobs}
          loading={loadingJobs}
          onDelete={handleDelete}
          onOpen={setViewerJob}
          hideTitle
        />
      </section>

      {/* Generation History */}
      <section id="history" className="rounded-2xl border border-white/10 bg-black/20 p-6 md:p-8">
        <h2 className="font-grotesk text-xl font-black uppercase tracking-tight">Generation History</h2>
        <div className="mt-5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 text-white/40">
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Job</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Type</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Prompt</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Model</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Date</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Time</TableHead>
                <TableHead className="text-[10px] font-black uppercase tracking-widest">Output</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(jobs ?? []).slice(0, 25).map((job) => (
                <TableRow key={job.id} className="border-white/5 text-white/70">
                  <TableCell className="font-mono text-[11px] text-white/40">{job.id.slice(0, 8)}</TableCell>
                  <TableCell className="text-xs">{job.type.replace(/-/g, ' ')}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-xs text-white/45">{job.prompt ?? '—'}</TableCell>
                  <TableCell className="text-xs">{job.engine ?? job.model ?? '—'}</TableCell>
                  <TableCell className="text-xs text-white/45">{createdLabel(job.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('border-white/15 bg-transparent text-[10px]', STATUS_VARIANT[job.status])}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-white/45">
                    {job.processingMs ? `${Math.max(1, Math.round(job.processingMs / 1000))}s` : '—'}
                  </TableCell>
                  <TableCell>
                    {job.status === 'COMPLETED' ? (
                      <Button variant="link" size="sm" className="h-auto p-0 text-xs text-primary" onClick={() => setViewerJob(job)}>
                        Open
                      </Button>
                    ) : (
                      <span className="text-xs text-white/30">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(jobs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-white/40">
                    No generations yet — your history will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <AiCreationViewer job={viewerJob} onOpenChange={(open) => !open && setViewerJob(null)} onChanged={loadJobs} />
    </div>
  );
}
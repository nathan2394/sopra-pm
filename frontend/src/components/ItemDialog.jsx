import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ActivityPanel from "@/components/ActivityPanel";
import { STATUSES, PRIORITIES, SYSTEMS, PRIORITY_COLORS } from "@/lib/constants";
import {
  deleteAttachment,
  fetchNextWbRef,
  fetchAttachmentObjectUrl,
  fetchAttachments,
  uploadAttachments,
} from "@/lib/api";
import { getActorId } from "@/lib/currentUser";
import { Paperclip, Trash, FilePdf } from "@phosphor-icons/react";

/**
 * The backlog item editor, shared by the Backlog list and the Sprint Board so
 * a card can be edited without leaving the board.
 */
export default function ItemDialog({
  open,
  onOpenChange,
  form,
  setForm,
  editing,
  onSave,
  onAttachmentChanged,
  team,
  sprints,
  projects,
  teamMap,
  sprintMap,
  projectMap,
}) {
  const itemId = editing?.id;
  const [attachments, setAttachments] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(false);

  useEffect(() => {
    if (!open || !itemId) {
      setAttachments([]);
      return;
    }
    let cancelled = false;
    fetchAttachments(itemId)
      .then((list) => !cancelled && setAttachments(list))
      .catch(() => !cancelled && setAttachments([]));
    return () => {
      cancelled = true;
    };
  }, [open, itemId]);

  const uploadFiles = useCallback(
    async (files) => {
      if (!itemId || !files?.length) return;
      setUploadBusy(true);
      try {
        const added = await uploadAttachments(
          itemId,
          files,
          getActorId() || undefined,
        );
        setAttachments((prev) => [...prev, ...added]);
        toast.success(
          added.length > 1 ? `${added.length} files attached` : "File attached",
        );
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Upload failed");
      } finally {
        setUploadBusy(false);
      }
    },
    [itemId],
  );

  const removeAttachment = useCallback(async (id) => {
    try {
      await deleteAttachment(id);
      setAttachments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Attachment removed");
    } catch {
      toast.error("Remove failed");
    }
  }, []);

  // A new item takes the next reference in its project's series. Only while
  // creating, and only while the field is still auto-filled — a reference the
  // user typed themselves is left alone.
  const autoRef = useRef(true);
  const projectId = form?.project_id ?? null;

  useEffect(() => {
    if (!open || editing) return;
    if (!autoRef.current) return;
    let cancelled = false;
    fetchNextWbRef(projectId)
      .then((ref) => {
        if (!cancelled) setForm((f) => (f ? { ...f, wb_ref: ref } : f));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, editing, projectId, setForm]);

  useEffect(() => {
    if (open && !editing) autoRef.current = true;
  }, [open, editing]);

  // Paste anywhere in the form. Clipboard images arrive as files with a generic
  // name, so the server settles the real type from the bytes.
  const handlePaste = useCallback(
    (e) => {
      if (!itemId) return;
      const files = Array.from(e.clipboardData?.items || [])
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter(Boolean);
      if (files.length === 0) return; // ordinary text paste, leave it alone
      e.preventDefault();
      uploadFiles(files);
    },
    [itemId, uploadFiles],
  );

  return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="rounded-sm w-[96vw] sm:max-w-[1500px] max-h-[92vh] overflow-hidden flex flex-col"
            data-testid="item-dialog"
            onPaste={handlePaste}
          >
            <DialogHeader>
              <DialogTitle className="font-display font-black tracking-tight">
                {editing ? `Edit ${editing.wb_ref}` : "New Backlog Item"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-5 overflow-hidden">
            <div
              className={`overflow-y-auto pr-1 scrollbar-thin ${
                editing ? "lg:col-span-2" : "lg:col-span-3"
              }`}
            >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  WB Ref
                </Label>
                <Input
                  value={form.wb_ref || ""}
                  placeholder={editing ? "" : "auto"}
                  onChange={(e) => {
                    autoRef.current = false;
                    setForm({ ...form, wb_ref: e.target.value });
                  }}
                  className="rounded-sm font-mono"
                  data-testid="form-wb-ref"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Story Points
                </Label>
                <Input
                  type="number"
                  value={form.story_points}
                  onChange={(e) =>
                    setForm({ ...form, story_points: e.target.value })
                  }
                  className="rounded-sm font-mono"
                  data-testid="form-sp"
                />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-4">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Title
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-title"
                />
              </div>

              <SelectField
                label="Project"
                value={form.project_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, project_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— No project —" },
                  ...projects.map((p) => ({
                    value: p.id,
                    label: `${p.code || ""} · ${p.name}`.trim(),
                  })),
                ]}
                testId="form-project"
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Phase (within project)
                </Label>
                <Input
                  value={form.phase || ""}
                  onChange={(e) => setForm({ ...form, phase: e.target.value })}
                  placeholder="e.g. Phase 1, Phase 2"
                  className="rounded-sm"
                  disabled={!form.project_id}
                  data-testid="form-phase"
                />
              </div>

              <SelectField
                label="System"
                value={form.system}
                onChange={(v) => setForm({ ...form, system: v })}
                options={SYSTEMS.map((s) => ({ value: s, label: s }))}
                testId="form-system"
              />
              <SelectField
                label="Priority"
                value={form.priority}
                onChange={(v) => setForm({ ...form, priority: v })}
                options={PRIORITIES.map((p) => ({
                  value: p,
                  label: `${p} – ${PRIORITY_COLORS[p].label}`,
                }))}
                testId="form-priority"
              />
              <SelectField
                label="Quarter"
                value={form.quarter}
                onChange={(v) => setForm({ ...form, quarter: v })}
                options={["Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"].map((q) => ({
                  value: q,
                  label: q,
                }))}
                testId="form-quarter"
              />
              <SelectField
                label="Sprint"
                value={form.sprint_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, sprint_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— No sprint —" },
                  ...sprints.map((s) => ({
                    value: s.id,
                    label: `${s.name} · ${s.quarter}`,
                  })),
                ]}
                testId="form-sprint"
              />
              <SelectField
                label="Dev Assignee"
                value={form.dev_assignee_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, dev_assignee_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— Unassigned —" },
                  ...team
                    .filter(
                      (t) => t.role === "Backend Dev" || t.role === "Product Manager",
                    )
                    .map((t) => ({
                      value: t.id,
                      label: `${t.name} · ${t.role}`,
                    })),
                ]}
                testId="form-dev"
              />
              <SelectField
                label="QA Assignee"
                value={form.qa_assignee_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, qa_assignee_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— Unassigned —" },
                  ...team
                    .filter((t) => t.role === "QA")
                    .map((t) => ({ value: t.id, label: t.name })),
                ]}
                testId="form-qa"
              />
              <SelectField
                label="UI/UX Assignee"
                value={form.uiux_assignee_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, uiux_assignee_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— Unassigned —" },
                  ...team
                    .filter((t) => t.role === "UI/UX")
                    .map((t) => ({ value: t.id, label: t.name })),
                ]}
                testId="form-uiux"
              />
              <SelectField
                label="AI Engineer Assignee"
                value={form.data_eng_assignee_id || "_none"}
                onChange={(v) =>
                  setForm({ ...form, data_eng_assignee_id: v === "_none" ? null : v })
                }
                options={[
                  { value: "_none", label: "— Unassigned —" },
                  ...team
                    .filter((t) => t.role === "AI Engineer")
                    .map((t) => ({ value: t.id, label: t.name })),
                ]}
                testId="form-data-eng"
              />
              <SelectField
                label="Status"
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
                options={STATUSES.map((s) => ({ value: s, label: s }))}
                testId="form-status"
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  % Done
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={form.percent_done || 0}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      percent_done: parseInt(e.target.value) || 0,
                    })
                  }
                  className="rounded-sm font-mono"
                  data-testid="form-percent"
                />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-2">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Reference URL
                </Label>
                <Input
                  type="url"
                  placeholder="https://…"
                  value={form.url || ""}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className="rounded-sm"
                  data-testid="form-url"
                />
              </div>

              <div className="space-y-1.5 col-span-2 md:col-span-2">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Attachments — paste a screenshot anywhere in this form
                </Label>
                {editing ? (
                  <AttachmentGallery
                    attachments={attachments}
                    busy={uploadBusy}
                    onPick={uploadFiles}
                    onRemove={removeAttachment}
                  />
                ) : (
                  <p className="text-xs text-slate-500">
                    Save the item first, then reopen it to paste screenshots or
                    attach a PDF.
                  </p>
                )}
              </div>

              <div className="space-y-1.5 col-span-2 md:col-span-4">
                <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
                  Notes / Rules
                </Label>
                <Textarea
                  value={form.notes || ""}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="rounded-sm"
                  rows={2}
                  data-testid="form-notes"
                />
              </div>
            </div>
            </div>

            {editing && (
              <div className="lg:col-span-1 min-h-0 overflow-y-auto border-l border-slate-200 pl-5 scrollbar-thin">
                <ActivityPanel
                  itemId={editing.id}
                  teamMap={teamMap}
                  sprintMap={sprintMap}
                  projectMap={projectMap}
                />
              </div>
            )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-sm"
                data-testid="form-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={onSave}
                className="rounded-sm bg-[#0033CC] hover:bg-[#0028A3]"
                data-testid="form-save"
              >
                {editing ? "Save changes" : "Create item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
  );
}


/** Attached screenshots and PDFs: thumbnails, an upload button, and removal. */
function AttachmentGallery({ attachments, busy, onPick, onRemove }) {
  const inputRef = useRef(null);

  const pick = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    onPick(files);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.pdf"
          onChange={pick}
          className="hidden"
          data-testid="attachment-input"
        />
        <Button
          type="button"
          variant="outline"
          className="rounded-sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          data-testid="attachment-pick"
        >
          <Paperclip size={14} className="mr-2" />
          {busy ? "Uploading…" : "Attach file"}
        </Button>
        <span className="text-xs text-slate-500">
          or press ⌘/Ctrl+V to paste a screenshot · images &amp; PDF, up to 10 MB
        </span>
      </div>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2" data-testid="attachment-list">
          {attachments.map((a) => (
            <AttachmentTile key={a.id} attachment={a} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}

/** One attachment. Images preview; anything else shows as a labelled chip. */
function AttachmentTile({ attachment, onRemove }) {
  const isImage = (attachment.content_type || "").startsWith("image/");
  const [objectUrl, setObjectUrl] = useState(null);

  // The file endpoint needs the bearer token, so fetch the bytes through the
  // API client and preview them from an object URL rather than a bare src.
  useEffect(() => {
    if (!isImage) return;
    let revoked = false;
    let url = null;
    fetchAttachmentObjectUrl(attachment.id)
      .then((u) => {
        if (revoked) {
          URL.revokeObjectURL(u);
          return;
        }
        url = u;
        setObjectUrl(u);
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.id, isImage]);

  const open = async () => {
    try {
      const url = objectUrl || (await fetchAttachmentObjectUrl(attachment.id));
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Could not open attachment");
    }
  };

  const kb = Math.max(1, Math.round((attachment.size || 0) / 1024));

  return (
    <div
      className="group relative border border-slate-200 rounded-sm overflow-hidden bg-slate-50"
      title={`${attachment.name} · ${kb} KB`}
    >
      <button
        type="button"
        onClick={open}
        className="block w-28 h-20"
        data-testid={`attachment-open-${attachment.id}`}
      >
        {isImage ? (
          objectUrl ? (
            <img
              src={objectUrl}
              alt={attachment.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
              loading…
            </span>
          )
        ) : (
          <span className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-500">
            <FilePdf size={20} />
            <span className="text-[9px] font-mono px-1 truncate max-w-full">
              {attachment.name}
            </span>
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onRemove(attachment.id)}
        className="absolute top-1 right-1 w-5 h-5 rounded-sm bg-white/90 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove attachment"
        data-testid={`attachment-remove-${attachment.id}`}
      >
        <Trash size={12} />
      </button>

      <div className="px-1 py-0.5 text-[9px] font-mono text-slate-500 bg-white border-t border-slate-100 truncate">
        {kb} KB
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options, testId }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-mono uppercase tracking-widest text-slate-500">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="rounded-sm" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

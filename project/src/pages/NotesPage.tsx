import { useEffect, useMemo, useState } from "react";
import { Notebook, Plus, Trash2, Pin, PinOff, Pencil, Lock, Unlock, Eye, EyeOff } from "lucide-react";
import { listNotes, upsertNote, setNotePinned, deleteNote } from "../lib/data";
import type { Note } from "../lib/types";
import { Button, EmptyState, Input, Label, Modal, SectionHeader, Textarea } from "../components/ui";
import { cn } from "../lib/utils";

const CATEGORIES = ["personal", "work", "ideas", "private"] as const;
type Category = (typeof CATEGORIES)[number];

const CATEGORY_LABEL: Record<Category, string> = {
  personal: "Personal",
  work: "Work",
  ideas: "Ideas",
  private: "Private",
};

const CATEGORY_COLOR: Record<Category, string> = {
  personal: "bg-sage-100 text-sage-700",
  work: "bg-sky-soft-100 text-sky-soft-700",
  ideas: "bg-honey-100 text-honey-700",
  private: "bg-rose-soft-100 text-rose-soft-700",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface Draft {
  title: string;
  content: string;
  category: Category;
  password: string;
}

const emptyDraft: Draft = { title: "", content: "", category: "personal", password: "" };

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Category | "all">("all");
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [unlockTarget, setUnlockTarget] = useState<Note | null>(null);
  const [unlockInput, setUnlockInput] = useState("");
  const [unlockError, setUnlockError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = async () => {
    try {
      setNotes(await listNotes());
      setError("");
    } catch {
      setError("Could not read notes from this device.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const startNew = () => {
    setEditing(null);
    setForm({ ...emptyDraft, category: filter === "all" ? "personal" : filter });
    setShowPassword(false);
    setOpen(true);
  };

  const startEdit = (note: Note) => {
    setEditing(note);
    setForm({
      title: note.title,
      content: note.content,
      category: (note.category as Category) ?? "personal",
      password: "",
    });
    setShowPassword(false);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() && !form.content.trim()) return;
    setSaving(true);
    try {
      const passwordHash = form.password.trim() ? await sha256(form.password.trim()) : editing?.password_hash ?? "";
      await upsertNote({
        id: editing?.id,
        title: form.title,
        content: form.content,
        category: form.category,
        password_hash: passwordHash,
      });
      if (editing && !passwordHash) {
        setUnlocked((prev) => {
          const next = new Set(prev);
          next.add(editing.id);
          return next;
        });
      }
      setError("");
    } catch {
      setError("Could not save the note.");
    } finally {
      setSaving(false);
      setOpen(false);
      load();
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await setNotePinned(note.id, !note.pinned);
    } catch {
      setError("Could not pin the note.");
    }
    load();
  };

  const remove = async (id: string) => {
    try {
      await deleteNote(id);
      setUnlocked((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch {
      setError("Could not delete the note.");
    }
    load();
  };

  const isLocked = (note: Note): boolean => Boolean(note.password_hash) && !unlocked.has(note.id);

  const tryUnlock = async () => {
    if (!unlockTarget) return;
    const hash = await sha256(unlockInput);
    if (hash === unlockTarget.password_hash) {
      setUnlocked((prev) => new Set(prev).add(unlockTarget.id));
      setUnlockTarget(null);
      setUnlockInput("");
      setUnlockError("");
    } else {
      setUnlockError("Wrong password.");
    }
  };

  const lockNote = (id: string) => {
    setUnlocked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const list = filter === "all" ? notes : notes.filter((n) => (n.category ?? "personal") === filter);
    return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  }, [notes, filter]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: notes.length };
    for (const c of CATEGORIES) map[c] = notes.filter((n) => (n.category ?? "personal") === c).length;
    return map;
  }, [notes]);

  return (
    <div className="animate-fade-up">
      <SectionHeader
        title="Notepad"
        subtitle="Quick notes, lists, and things to remember"
        action={
          <Button onClick={startNew}>
            <Plus size={16} /> New note
          </Button>
        }
      />

      {error && <div className="mb-4 rounded-xl bg-rose-soft-100 text-rose-soft-600 text-sm px-4 py-3">{error}</div>}

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        <FilterChip label="All" active={filter === "all"} count={counts.all} onClick={() => setFilter("all")} />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            label={CATEGORY_LABEL[c]}
            active={filter === c}
            count={counts[c] ?? 0}
            onClick={() => setFilter(c)}
          />
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-2xl bg-cream-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Notebook size={26} />}
          title="No notes here yet"
          hint="Jot down anything — a gift idea, a packing list, a passing thought."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((note) => {
            const locked = isLocked(note);
            const cat = (note.category ?? "personal") as Category;
            return (
              <div
                key={note.id}
                className={cn(
                  "group relative bg-white rounded-2xl border p-5 hover:shadow-md transition-all duration-200",
                  note.pinned ? "border-honey-300 bg-honey-100/40" : "border-cream-200",
                  locked && "bg-cream-100/60"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {locked ? (
                      <Lock size={14} className="text-ink-500/70 shrink-0" />
                    ) : (
                      note.password_hash && (
                        <Unlock
                          size={14}
                          className="text-sage-600 shrink-0 cursor-pointer"
                          onClick={() => lockNote(note.id)}
                          aria-label="Lock again"
                        />
                      )
                    )}
                    <h4 className="font-display text-lg font-semibold text-ink-800 truncate">
                      {locked ? "Locked note" : note.title || "Untitled"}
                    </h4>
                  </div>
                  <div className="flex gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                    {!locked && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => togglePin(note)} aria-label="Pin">
                          {note.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => startEdit(note)} aria-label="Edit">
                          <Pencil size={13} />
                        </Button>
                      </>
                    )}
                    <Button variant="danger" size="sm" onClick={() => remove(note.id)} aria-label="Delete">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full", CATEGORY_COLOR[cat])}>
                    {CATEGORY_LABEL[cat]}
                  </span>
                  {note.password_hash && (
                    <span className="text-[10px] font-medium text-ink-500/70 flex items-center gap-1">
                      <Lock size={10} /> Protected
                    </span>
                  )}
                </div>
                {locked ? (
                  <div className="mt-3">
                    <p className="text-xs text-ink-500 mb-2">Enter the password to view this note.</p>
                    <Button variant="secondary" size="sm" onClick={() => { setUnlockTarget(note); setUnlockInput(""); setUnlockError(""); }}>
                      <Lock size={13} /> Unlock
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-ink-600 leading-relaxed mt-2 whitespace-pre-wrap line-clamp-5">
                    {note.content}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit note" : "New note"}>
        <div className="space-y-4">
          <div>
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, category: c })}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                    form.category === c ? "bg-sage-600 text-white" : "bg-cream-100 text-ink-600 hover:bg-cream-200"
                  )}
                >
                  {CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Note title..."
            />
          </div>
          <div>
            <Label>Note</Label>
            <Textarea
              rows={6}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Write it down..."
            />
          </div>
          <div>
            <Label>{editing?.password_hash ? "Change password (leave blank to keep current)" : "Password protect (optional)"}</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing?.password_hash ? "Keep current password" : "Add a password to lock this note"}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500/60 hover:text-ink-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-[11px] text-ink-500/70 mt-1.5 leading-relaxed">
              A locked note hides its title and content until you enter the password. Use Private category for things only you should see.
            </p>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? "Saving..." : editing ? "Save changes" : "Save note"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!unlockTarget} onClose={() => { setUnlockTarget(null); setUnlockInput(""); setUnlockError(""); }} title="Unlock note">
        <div className="space-y-4">
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={unlockInput}
              onChange={(e) => setUnlockInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
              placeholder="Enter the note password"
            />
          </div>
          {unlockError && <div className="rounded-xl bg-rose-soft-100 text-rose-soft-600 text-sm px-4 py-3">{unlockError}</div>}
          <Button onClick={() => void tryUnlock()} disabled={!unlockInput} className="w-full">
            Unlock
          </Button>
        </div>
      </Modal>
    </div>
  );
}

interface FilterChipProps {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
}

function FilterChip({ label, active, count, onClick }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all",
        active ? "bg-sage-600 text-white" : "bg-white border border-cream-200 text-ink-600 hover:bg-cream-100"
      )}
    >
      {label} <span className={cn("ml-1", active ? "text-white/70" : "text-ink-500/60")}>{count}</span>
    </button>
  );
}

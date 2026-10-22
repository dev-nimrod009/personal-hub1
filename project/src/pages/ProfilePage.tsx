import { useEffect, useState } from "react";
import { Camera, Fingerprint, Check, Download, Upload, Database } from "lucide-react";
import { getProfile, updateProfile } from "../lib/data";
import { backupToFile, restoreFromText, countRows } from "../lib/backup";
import { useAuth } from "../lib/auth";
import { todayISO } from "../lib/utils";
import type { Profile } from "../lib/types";
import { Button, EmptyState, Input, Label, SectionHeader, Textarea } from "../components/ui";

export function ProfilePage() {
  const { user, registerPasskey, hasPasskey, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string>("");
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    avatar_url: "",
    bio: "",
    location: "",
    birthday: "",
  });

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        const data = await getProfile(user.id);
        if (data) {
          setProfile(data);
          setForm({
            full_name: data.full_name ?? "",
            avatar_url: data.avatar_url ?? "",
            bio: data.bio ?? "",
            location: data.location ?? "",
            birthday: data.birthday ?? "",
          });
        }
        setError("");
      } catch {
        setError("Could not read your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile(user.id, {
        full_name: form.full_name.trim(),
        avatar_url: form.avatar_url.trim(),
        bio: form.bio.trim(),
        location: form.location.trim(),
        birthday: form.birthday || null,
      });
      setSaved(true);
      setError("");
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Could not save your profile.");
    } finally {
      setSaving(false);
    }
  };

  const setupPasskey = async () => {
    const result = await registerPasskey();
    if (result.error) setError(result.error);
  };

  useEffect(() => {
    if (!user) return;
    void (async () => {
      try {
        setRowCount(await countRows());
      } catch {
        setRowCount(null);
      }
    })();
  }, [user]);

  const doBackup = () => {
    void (async () => {
      try {
        await backupToFile();
        setError("");
      } catch {
        setError("Could not create your backup file. Check your connection and try again.");
      }
    })();
  };

  const doRestore = (file: File) => {
    setRestoring(true);
    setRestoreResult("");
    void (async () => {
      try {
        const text = await file.text();
        const { restored } = await restoreFromText(text);
        setRestoreResult(
          restored > 0
            ? `Restored ${restored} item${restored === 1 ? "" : "s"} into your account. Everything you already had was kept.`
            : "Nothing new to restore - your account already has all of it."
        );
        setRowCount(await countRows());
        setError("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read that backup file.");
      } finally {
        setRestoring(false);
      }
    })();
  };

  const initials = (form.full_name.trim() || form.avatar_url.trim() || user?.email || "?")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="animate-fade-up">
      <SectionHeader title="Profile" subtitle="Your picture and personal details" />

      {error && <div className="mb-4 rounded-xl bg-rose-soft-100 text-rose-soft-600 text-sm px-4 py-3">{error}</div>}

      {loading ? (
        <div className="h-64 rounded-2xl bg-cream-100 animate-pulse" />
      ) : !profile ? (
        <EmptyState icon={<Camera size={22} />} title="Profile unavailable" hint="Try signing out and back in." />
      ) : (
        <>
          <section className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
            <div className="flex items-center gap-5">
              <div className="relative">
                {form.avatar_url.trim() ? (
                  <img
                    src={form.avatar_url.trim()}
                    alt="Profile picture"
                    className="w-20 h-20 rounded-2xl object-cover border border-cream-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-sage-500 flex items-center justify-center text-white text-xl font-semibold">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-display text-xl font-semibold text-ink-800 truncate">
                  {form.full_name.trim() || "Unnamed"}
                </p>
                <p className="text-sm text-ink-500 truncate">{profile.email}</p>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-4">Personal details</h3>
            <div className="space-y-4">
              <div>
                <Label>Profile picture link</Label>
                <Input
                  type="url"
                  value={form.avatar_url}
                  onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              <div>
                <Label>Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Your name"
                />
              </div>
              <div>
                <Label>About you</Label>
                <Textarea
                  rows={3}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  placeholder="A line or two about yourself"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Location</Label>
                  <Input
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="City, country"
                  />
                </div>
                <div>
                  <Label>Birthday</Label>
                  <Input
                    type="date"
                    max={todayISO()}
                    value={form.birthday}
                    onChange={(e) => setForm({ ...form, birthday: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={() => void save()} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Saving..." : saved ? <><Check size={16} /> Saved</> : "Save changes"}
              </Button>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-2">Backup &amp; restore</h3>
            <p className="text-sm text-ink-600 leading-relaxed mb-4">
              Your entries live in your account, so they follow you to any phone automatically - just sign in. As an
              extra safety net, you can also save a backup file to your device or bring one back in.
            </p>
            {rowCount !== null && (
              <div className="flex items-center gap-2 text-sm font-medium text-sage-600 mb-4">
                <Database size={16} /> {rowCount} item{rowCount === 1 ? "" : "s"} safely stored in your account
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={doBackup}>
                <Download size={16} /> Save backup file
              </Button>
              <label className="cursor-pointer">
                <span className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium border transition-colors bg-white text-ink-700 border-cream-200 hover:bg-cream-100 w-full sm:w-auto" style={{ minHeight: 40 }}>
                  <Upload size={16} /> {restoring ? "Restoring..." : "Restore from file"}
                </span>
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  disabled={restoring}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) doRestore(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {restoreResult && (
              <div className="mt-4 rounded-xl bg-sage-500/10 text-sage-600 text-sm px-4 py-3">{restoreResult}</div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-cream-200 p-6 mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-2">Biometric unlock</h3>
            <p className="text-sm text-ink-600 leading-relaxed mb-4">
              Add this device so next time you can unlock with your fingerprint, face, or device PIN instead of typing
              your password.
            </p>
            {hasPasskey ? (
              <div className="flex items-center gap-2 text-sm font-medium text-sage-600">
                <Fingerprint size={17} /> This device is set up for biometric unlock
              </div>
            ) : (
              <Button variant="secondary" onClick={() => void setupPasskey()}>
                <Fingerprint size={16} /> Set up on this device
              </Button>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-cream-200 p-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-ink-500 mb-4">Account</h3>
            <Button variant="danger" onClick={() => void signOut()}>
              Sign out
            </Button>
          </section>
        </>
      )}
    </div>
  );
}

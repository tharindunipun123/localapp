"use client";

import { useEffect, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { UserAvatar } from "@/components/chat/UserAvatar";
import { getAllUsers, updateUserRole, getWalletForUser } from "@/lib/services/admin";
import { updateUserSpendingLimits } from "@/lib/services/cloudFunctions";
import { parseFirestoreTime } from "@/lib/firestoreTime";
import { format } from "date-fns";

function DetailRow({ label, value }) {
  return (
    <div className="flex gap-2 border-b border-[var(--color-border-light)] py-2 text-sm last:border-0">
      <span className="w-36 shrink-0 font-medium text-[var(--color-muted)]">{label}</span>
      <span className="flex-1 text-[var(--color-fg)]">{value ?? "—"}</span>
    </div>
  );
}

function KycBadge({ status }) {
  const label = status ?? "none";
  const s = label === "approved" ? "approved" : "pending";
  return <Badge label={label} status={s} />;
}

function UserDetailModal({ user, wallet, onClose, onRoleChange }) {
  if (!user) return null;
  const created = parseFirestoreTime(user.createdAt);

  return (
    <Modal open title={user.displayName || user.email} onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* Avatar + basic */}
        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <p className="text-lg font-semibold">{user.displayName}</p>
            <p className="text-sm text-[var(--color-muted)]">{user.email}</p>
            <p className="text-xs text-[var(--color-muted)]">UID: {user.uid}</p>
          </div>
        </div>

        {/* Profile section */}
        <section>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Profile</p>
          <DetailRow label="Role" value={
            <Select
              options={[
                { value: "user", label: "User" },
                { value: "vendor", label: "Vendor" },
                { value: "admin", label: "Admin" },
              ]}
              value={user.role}
              onChange={(e) => onRoleChange(user.uid, e.target.value)}
              className="w-32"
            />
          } />
          <DetailRow label="KYC Status" value={<KycBadge status={user.kycStatus} />} />
          <DetailRow label="Vendor Status" value={<Badge label={user.vendorStatus ?? "none"} status={user.vendorStatus === "approved" ? "approved" : "pending"} />} />
          <DetailRow label="Phone" value={user.phone} />
          <DetailRow label="Phone Verified" value={user.phoneVerified ? "✓ Yes" : "✗ No"} />
          <DetailRow label="Email Verified" value={user.emailVerified ? "✓ Yes" : "✗ No"} />
          <DetailRow label="Member since" value={created ? format(created, "MMM d, yyyy HH:mm") : "—"} />
        </section>

        {/* Wallet section */}
        {wallet && (
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Wallet</p>
            <DetailRow label="Cash Balance" value={`LKR ${(wallet.cashBalance ?? 0).toLocaleString()}`} />
            <DetailRow label="Loyalty Points" value={(wallet.loyaltyPoints ?? 0).toLocaleString()} />
            <DetailRow label="Bonus Points" value={(wallet.bonusPoints ?? 0).toLocaleString()} />
            <DetailRow label="Daily Limit" value={`LKR ${(wallet.spendingLimitDaily ?? 0).toLocaleString()}`} />
            <DetailRow label="Monthly Limit" value={`LKR ${(wallet.spendingLimitMonthly ?? 0).toLocaleString()}`} />
          </section>
        )}
      </div>
    </Modal>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [limitsUser, setLimitsUser] = useState(null);
  const [limits, setLimits] = useState({ daily: 50000, monthly: 200000 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  async function handleRoleChange(uid, role) {
    await updateUserRole(uid, role);
    const updated = await getAllUsers();
    setUsers(updated);
    if (selectedUser?.uid === uid) {
      setSelectedUser((u) => u ? { ...u, role } : u);
    }
  }

  async function openUser(u) {
    setSelectedUser(u);
    setSelectedWallet(null);
    try {
      const w = await getWalletForUser(u.uid);
      setSelectedWallet(w);
    } catch {
      // wallet may not exist
    }
  }

  async function openLimits(uid) {
    const wallet = await getWalletForUser(uid);
    setLimitsUser(uid);
    setLimits({
      daily: wallet?.spendingLimitDaily ?? 50000,
      monthly: wallet?.spendingLimitMonthly ?? 200000,
    });
  }

  async function saveLimits() {
    if (!limitsUser) return;
    setSaving(true);
    try {
      await updateUserSpendingLimits({
        userId: limitsUser,
        spendingLimitDaily: Number(limits.daily),
        spendingLimitMonthly: Number(limits.monthly),
      });
      setLimitsUser(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <CardHeader title="Users" subtitle="Manage roles, KYC status, spending limits" />
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-card)]">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-border-light)] bg-[var(--color-bg)]">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">KYC</th>
              <th className="px-4 py-3 text-left">Vendor</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid} className="border-b border-[var(--color-border-light)]">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => u.photoURL && setLightboxPhoto(u.photoURL)}
                      className={u.photoURL ? "cursor-zoom-in" : "cursor-default"}
                    >
                      <UserAvatar user={u} size="sm" />
                    </button>
                    <span className="font-medium text-[var(--color-fg)]">{u.displayName}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge label={u.kycStatus ?? "none"} status={u.kycStatus === "approved" ? "approved" : "pending"} />
                </td>
                <td className="px-4 py-3">
                  <Badge label={u.vendorStatus ?? "none"} status={u.vendorStatus === "approved" ? "approved" : "pending"} />
                </td>
                <td className="px-4 py-3">
                  <Select
                    options={[
                      { value: "user", label: "User" },
                      { value: "vendor", label: "Vendor" },
                      { value: "admin", label: "Admin" },
                    ]}
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.uid, e.target.value)}
                    className="w-28"
                  />
                </td>
                <td className="px-4 py-3 space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openUser(u)}>View</Button>
                  <Button size="sm" variant="ghost" onClick={() => openLimits(u.uid)}>Limits</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="p-4 text-[var(--color-muted)]">No users found.</p>
        )}
      </div>

      {/* User detail modal */}
      <UserDetailModal
        user={selectedUser}
        wallet={selectedWallet}
        onClose={() => { setSelectedUser(null); setSelectedWallet(null); }}
        onRoleChange={handleRoleChange}
      />

      {/* Spending limits modal */}
      {limitsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[var(--radius-xl)] bg-[var(--color-card)] p-6 shadow-lg">
            <h3 className="mb-4 font-semibold">Spending limits</h3>
            <div className="space-y-3">
              <Input label="Daily limit (LKR)" type="number" value={limits.daily} onChange={(e) => setLimits({ ...limits, daily: e.target.value })} />
              <Input label="Monthly limit (LKR)" type="number" value={limits.monthly} onChange={(e) => setLimits({ ...limits, monthly: e.target.value })} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={saveLimits} loading={saving}>Save</Button>
              <Button variant="outline" onClick={() => setLimitsUser(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {lightboxPhoto && (
        <ImageLightbox images={[lightboxPhoto]} onClose={() => setLightboxPhoto(null)} />
      )}
    </div>
  );
}

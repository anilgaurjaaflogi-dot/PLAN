import React, { useState } from 'react';
import {
  ShieldCheck,
  UserX,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Check,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { AppUserAccess } from '../types';

export const AdminPage: React.FC = () => {
  const {
    currentUser,
    isAdmin,
    adminUnlockedWithPin,
    unlockAdminWithPin,
    lockAdmin,
    accessConfig,
    usersList,
    blockUser,
    unblockUser,
    addUserAccess,
    removeUserAccess,
    updateAccessConfig,
    addToast,
    settings,
  } = useApp();

  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Add User Form
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'staff' | 'viewer'>('staff');
  const [isAdding, setIsAdding] = useState(false);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = unlockAdminWithPin(pinInput);
    if (success) {
      setPinError(false);
      setPinInput('');
      addToast({
        type: 'success',
        title: 'Admin Unlocked',
        description: 'Master access granted to Anil Gaur Admin Panel.',
      });
    } else {
      setPinError(true);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes('@')) {
      addToast({ type: 'warning', title: 'Valid Email Required' });
      return;
    }

    setIsAdding(true);
    try {
      await addUserAccess({
        id: newEmail.trim().toLowerCase(),
        email: newEmail.trim().toLowerCase(),
        displayName: newName.trim() || newEmail.split('@')[0],
        role: newRole,
        status: 'active',
        createdAt: Date.now(),
        lastActive: Date.now(),
      });
      setNewEmail('');
      setNewName('');
      addToast({
        type: 'success',
        title: 'User Added',
        description: `Access granted for ${newEmail}.`,
      });
    } catch (err: any) {
      addToast({ type: 'error', title: 'Failed to add user', description: err.message });
    } finally {
      setIsAdding(false);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              <span>Admin & Access Control Center</span>
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
              MADE BY ANIL GAUR
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {settings.showHinglish
              ? 'Users ki access control karein, kissi ko bhi app se out/block karein aur security settings sambhalein.'
              : 'Manage authenticated user access, kick out or block unauthorized users, and enforce private app mode.'}
          </p>
        </div>

        {adminUnlockedWithPin && (
          <button
            onClick={() => lockAdmin()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 w-fit cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Admin Panel</span>
          </button>
        )}
      </div>

      {/* PIN Unlock Gateway if neither Anil's Google email nor Master PIN is verified */}
      {!isAdmin && !adminUnlockedWithPin ? (
        <div className="max-w-lg mx-auto p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-center space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Admin Access Protected • Made by Anil Gaur
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Ye page sirf Anil Gaur ke liye hai. Master PIN (8076910181) daalein ya anilgaurjaaflogi@gmail.com se Google Login karein.
            </p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-3 max-w-xs mx-auto">
            <div className="relative">
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  if (pinError) setPinError(false);
                }}
                autoFocus
                placeholder="Enter Master PIN (8076910181)"
                className={`w-full pl-9 pr-4 py-2.5 text-sm font-mono text-center rounded-xl border bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none transition-all ${
                  pinError
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                }`}
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>

            {pinError && (
              <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                Incorrect Master PIN! Access Denied.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all shadow-xs cursor-pointer"
            >
              Unlock Admin Center
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Admin Workspace */
        <div className="space-y-6">
          {/* Master Policy Banner */}
          <div className="p-5 rounded-xl border border-sky-200 dark:border-sky-900/60 bg-gradient-to-r from-sky-50/80 via-white to-sky-50/40 dark:from-sky-950/30 dark:via-slate-900 dark:to-slate-900 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  Global Access Control Settings
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Master Admin: <strong className="text-slate-700 dark:text-slate-300">Anil Gaur</strong> ({accessConfig.adminEmail}) • Master Password: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold">8076910181</code>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
                <input
                  type="checkbox"
                  checked={accessConfig.requireApproval}
                  onChange={(e) => updateAccessConfig({ requireApproval: e.target.checked })}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                />
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  Strict Private Mode (Admin Approval Required)
                </span>
              </label>
            </div>
          </div>

          {/* Add User Bar */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
            <h2 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-500" />
              <span>Allow New User / Member</span>
            </h2>
            <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="user@example.com *"
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full Name (optional)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                >
                  <option value="staff">Staff (Build & View Plans)</option>
                  <option value="viewer">Viewer (View Only)</option>
                  <option value="admin">Co-Admin</option>
                </select>
              </div>
              <div>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="w-full py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isAdding ? 'Adding...' : 'Grant Access'}
                </button>
              </div>
            </form>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  User Accounts & Permission Status ({filteredUsers.length})
                </h3>
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search user email..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 w-full sm:w-64"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-3 px-4">User Email / Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Access Status</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-right">Actions (Kick Out / Allow)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs">
                  {filteredUsers.map((u) => {
                    const isOwner = u.email.toLowerCase() === 'anilgaurjaaflogi@gmail.com';
                    const isBlocked = u.status === 'blocked';

                    return (
                      <tr
                        key={u.id || u.email}
                        className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                          isBlocked ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-sans">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>{u.displayName || u.email}</span>
                            {isOwner && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold">
                                Master
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">{u.email}</div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {u.role}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          {isBlocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
                              <UserX className="w-3 h-3" />
                              <span>BLOCKED (KICKED OUT)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ACTIVE ALLOWED</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {u.lastActive ? new Date(u.lastActive).toLocaleDateString() : 'Just now'}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isOwner ? (
                            <span className="text-[11px] text-slate-400 font-sans italic">Primary Admin</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2 font-sans">
                              {isBlocked ? (
                                <button
                                  onClick={() => unblockUser(u.email)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                                  title="Unblock user and restore access"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Allow Access</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => blockUser(u.email, 'Kicked out by Anil Gaur')}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white cursor-pointer shadow-xs"
                                  title="Kick out this user immediately"
                                >
                                  <UserX className="w-3 h-3" />
                                  <span>Kick Out / Block</span>
                                </button>
                              )}

                              <button
                                onClick={() => removeUserAccess(u.email)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                title="Delete user record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

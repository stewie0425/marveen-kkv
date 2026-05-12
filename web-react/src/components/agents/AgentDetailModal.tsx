import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { Avatar } from '@/components/common/Avatar'
import { Button } from '@/components/common/Button'
import {
  useAgentDetail,
  useAgentProcess,
  useAgents,
  useDeleteAgent,
  useSecurityProfiles,
  useSelectGalleryAvatar,
  useTelegramApprove,
  useTelegramConnect,
  useTelegramDisconnect,
  useTelegramPending,
  useTelegramTest,
  useUpdateAgent,
  useUpdateSecurityProfile,
  useUpdateTeam,
  useUploadAvatar,
} from '@/hooks/useAgents'
import type { AgentDetail } from '@/types/api'
import { AvatarGallery } from './AvatarGallery'

type Tab = 'general' | 'files' | 'telegram' | 'team' | 'skills'
type FileTab = 'claudeMd' | 'soulMd' | 'mcpJson'

const TABS: { id: Tab; label: string }[] = [
  { id: 'general', label: 'Általános' },
  { id: 'files', label: 'Fájlok' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'team', label: 'Csapat' },
  { id: 'skills', label: 'Skills' },
]

const MODELS = [
  { value: 'inherit', label: 'inherit (parent)' },
  { value: 'claude-opus-4-7', label: 'claude-opus-4-7' },
  { value: 'claude-sonnet-4-6', label: 'claude-sonnet-4-6' },
  { value: 'claude-haiku-4-5-20251001', label: 'claude-haiku-4-5' },
]

interface Props {
  name: string | null
  onClose: () => void
}

export function AgentDetailModal({ name, onClose }: Props) {
  const open = !!name
  const detail = useAgentDetail(name)
  const allAgents = useAgents()
  const profiles = useSecurityProfiles()
  const updateMut = useUpdateAgent()
  const deleteMut = useDeleteAgent()
  const processMut = useAgentProcess()
  const avatarMut = useUploadAvatar()
  const galleryMut = useSelectGalleryAvatar()
  const teamMut = useUpdateTeam()
  const securityMut = useUpdateSecurityProfile()
  const fileRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [activeFileTab, setActiveFileTab] = useState<FileTab>('claudeMd')

  // General tab
  const [form, setForm] = useState({ displayName: '', description: '', model: '' })
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [galleryOpen, setGalleryOpen] = useState(false)

  // Files tab
  const [files, setFiles] = useState({ claudeMd: '', soulMd: '', mcpJson: '' })
  const [filesSaved, setFilesSaved] = useState<Record<FileTab, boolean>>({ claudeMd: false, soulMd: false, mcpJson: false })
  const [filesError, setFilesError] = useState<string | null>(null)

  // Team tab
  const [teamForm, setTeamForm] = useState<{
    role: 'leader' | 'member'
    reportsTo: string | null
    delegatesTo: string[]
    autoDelegation: boolean
    trustFrom: string[]
  }>({
    role: 'member', reportsTo: null, delegatesTo: [], autoDelegation: false, trustFrom: [],
  })
  const [teamError, setTeamError] = useState<string | null>(null)
  const [teamSaved, setTeamSaved] = useState(false)

  // Security (part of files/team tab)
  const [securityProfile, setSecurityProfile] = useState('')
  const [securityError, setSecurityError] = useState<string | null>(null)
  const [securitySaved, setSecuritySaved] = useState(false)

  // Telegram
  const [tgError, setTgError] = useState<string | null>(null)
  const [tgSuccess, setTgSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (detail.data) {
      const a = detail.data
      setForm({
        displayName: a.displayName || '',
        description: a.description || '',
        model: a.model || 'inherit',
      })
      setFiles({
        claudeMd: a.claudeMd || '',
        soulMd: a.soulMd || '',
        mcpJson: a.mcpJson || '{}',
      })
      const rawTeam = a.team ?? { role: 'member', reportsTo: null, delegatesTo: [], autoDelegation: false, trustFrom: [] }
      setTeamForm({
        role: rawTeam.role === 'leader' ? 'leader' : 'member',
        reportsTo: rawTeam.reportsTo,
        delegatesTo: rawTeam.delegatesTo ?? [],
        autoDelegation: rawTeam.autoDelegation ?? false,
        trustFrom: rawTeam.trustFrom ?? [],
      })
      setSecurityProfile(a.securityProfile || 'default')
      setGeneralError(null)
      setFilesError(null)
      setTeamError(null)
      setSecurityError(null)
      setConfirmDelete(false)
      setGalleryOpen(false)
      setFilesSaved({ claudeMd: false, soulMd: false, mcpJson: false })
      setTeamSaved(false)
      setSecuritySaved(false)
    }
  }, [detail.data])

  // Reset tab on agent switch
  useEffect(() => {
    setActiveTab('general')
  }, [name])

  if (!open) return null

  const agent: AgentDetail | undefined = detail.data
  const isLoading = detail.isLoading
  const isError = detail.isError

  const displayNameTrimmed = form.displayName.trim()
  const displayNameValid = displayNameTrimmed.length > 0 && displayNameTrimmed.length <= 64
  const generalDirty =
    agent &&
    (form.displayName.trim() !== (agent.displayName || '').trim() ||
      form.description !== (agent.description || '') ||
      form.model !== (agent.model || 'inherit'))

  const handleSaveGeneral = async () => {
    if (!name || !agent) return
    if (!displayNameValid) {
      setGeneralError('A megjelenített név 1-64 karakter, vezető/záró szóköz nélkül.')
      return
    }
    setGeneralError(null)
    try {
      await updateMut.mutateAsync({
        name,
        patch: {
          displayName: form.displayName.trim(),
          description: form.description,
          model: form.model,
        },
      })
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSaveFile = async (fileTab: FileTab) => {
    if (!name) return
    setFilesError(null)
    try {
      await updateMut.mutateAsync({ name, patch: { [fileTab]: files[fileTab] } })
      setFilesSaved((prev) => ({ ...prev, [fileTab]: true }))
      setTimeout(() => setFilesSaved((prev) => ({ ...prev, [fileTab]: false })), 2000)
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSaveTeam = async () => {
    if (!name) return
    setTeamError(null)
    try {
      await teamMut.mutateAsync({ name, team: teamForm })
      setTeamSaved(true)
      setTimeout(() => setTeamSaved(false), 2000)
    } catch (e) {
      setTeamError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleSaveSecurity = async () => {
    if (!name) return
    setSecurityError(null)
    try {
      await securityMut.mutateAsync({ name, profile: securityProfile })
      setSecuritySaved(true)
      setTimeout(() => setSecuritySaved(false), 2000)
    } catch (e) {
      setSecurityError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleProcess = async (action: 'start' | 'stop') => {
    if (!name) return
    setGeneralError(null)
    try {
      await processMut.mutateAsync({ name, action })
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDelete = async () => {
    if (!name) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    try {
      await deleteMut.mutateAsync(name)
      onClose()
    } catch (e) {
      setGeneralError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleAvatarPick = () => fileRef.current?.click()
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !name) return
    setGeneralError(null)
    try {
      await avatarMut.mutateAsync({ name, file })
      setAvatarVersion((v) => v + 1)
      setGalleryOpen(false)
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleGallerySelect = async (galleryAvatar: string) => {
    if (!name) return
    setGeneralError(null)
    try {
      await galleryMut.mutateAsync({ name, galleryAvatar })
      setAvatarVersion((v) => v + 1)
      setGalleryOpen(false)
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : String(err))
    }
  }

  const avatarUrl = name
    ? `/api/agents/${encodeURIComponent(name)}/avatar?v=${avatarVersion}`
    : null

  const otherAgents = (allAgents.data ?? []).filter((a) => a.name !== name)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={agent?.displayName || agent?.name || name || 'Ágens'}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
          >
            {confirmDelete ? 'Tényleg töröljem?' : 'Törlés'}
          </Button>
          <Button onClick={onClose}>Bezárás</Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">Betöltés…</div>
      ) : isError || !agent ? (
        <div className="rounded-[var(--radius)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 text-sm text-[var(--color-danger)]">
          {detail.error instanceof Error ? detail.error.message : 'Nem sikerült betölteni az ágenst.'}
        </div>
      ) : (
        <div className="flex flex-col gap-0">
          {/* Tab strip */}
          <div className="mb-4 flex gap-1 border-b border-[var(--color-border)]">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={[
                  'px-3 py-2 text-[13px] font-medium transition-colors',
                  activeTab === t.id
                    ? 'border-b-2 border-[var(--color-accent)] text-[var(--color-accent)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* General tab */}
          {activeTab === 'general' && (
            <div className="flex flex-col gap-4">
              {/* Avatar + identity */}
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center gap-2">
                  <Avatar src={avatarUrl} name={agent.displayName || agent.name} size={72} />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={handleAvatarPick} disabled={avatarMut.isPending || galleryMut.isPending}>
                      {avatarMut.isPending ? '…' : 'Feltölt'}
                    </Button>
                    <Button size="sm" onClick={() => setGalleryOpen((v) => !v)} disabled={avatarMut.isPending || galleryMut.isPending}>
                      Galéria
                    </Button>
                  </div>
                  <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleAvatarChange} className="hidden" />
                </div>
                <div className="flex flex-1 flex-col gap-3">
                  <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{agent.name}</div>
                  <Field label="Megjelenített név">
                    <input
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                      maxLength={64}
                      placeholder={agent.name}
                      spellCheck={false}
                      aria-invalid={form.displayName.length > 0 && !displayNameValid}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none aria-[invalid=true]:border-[var(--color-danger)]"
                    />
                  </Field>
                  <Field label="Leírás">
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      rows={2}
                      className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                    />
                  </Field>
                </div>
              </div>

              {galleryOpen && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] p-3">
                  <AvatarGallery onSelect={handleGallerySelect} isPending={galleryMut.isPending} />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Modell">
                  <select
                    value={form.model}
                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    {MODELS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </Field>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    Státusz
                  </span>
                  <div className="flex items-center gap-2 py-1.5">
                    <span className={['h-2 w-2 rounded-full', agent.running ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'].join(' ')} />
                    <span className="text-sm font-medium">{agent.running ? 'Fut' : 'Leállítva'}</span>
                    {agent.session && (
                      <span className="font-mono text-[11px] text-[var(--color-text-muted)]">tmux:{agent.session}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Process control */}
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
                <Button size="sm" onClick={() => handleProcess('start')} disabled={agent.running || processMut.isPending}>
                  Indítás
                </Button>
                <Button size="sm" onClick={() => handleProcess('stop')} disabled={!agent.running || processMut.isPending}>
                  Leállítás
                </Button>
                <div className="ml-auto flex gap-3 text-[12px] text-[var(--color-text-muted)]">
                  <span>Telegram: <span className={agent.hasTelegram ? 'text-[var(--color-success)]' : ''}>{agent.hasTelegram ? (agent.telegramBotUsername || 'csatlakozva') : 'nincs'}</span></span>
                  <span>Security: <span className="text-[var(--color-text-secondary)]">{agent.securityProfile}</span></span>
                </div>
              </div>

              {generalError && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {generalError}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="primary" onClick={handleSaveGeneral} disabled={!generalDirty || updateMut.isPending}>
                  {updateMut.isPending ? 'Mentés…' : 'Mentés'}
                </Button>
              </div>
            </div>
          )}

          {/* Files tab */}
          {activeTab === 'files' && (
            <div className="flex flex-col gap-4">
              {/* File sub-tabs */}
              <div className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
                {(['claudeMd', 'soulMd', 'mcpJson'] as FileTab[]).map((ft) => {
                  const labels: Record<FileTab, string> = { claudeMd: 'CLAUDE.md', soulMd: 'SOUL.md', mcpJson: '.mcp.json' }
                  return (
                    <button
                      key={ft}
                      onClick={() => setActiveFileTab(ft)}
                      className={[
                        'flex-1 rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] font-medium transition-colors',
                        activeFileTab === ft
                          ? 'bg-[var(--color-modal)] text-[var(--color-text)] shadow-sm'
                          : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                      ].join(' ')}
                    >
                      {labels[ft]}
                    </button>
                  )
                })}
              </div>

              <textarea
                value={files[activeFileTab]}
                onChange={(e) => setFiles((f) => ({ ...f, [activeFileTab]: e.target.value }))}
                spellCheck={false}
                rows={16}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-[12px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              />

              {filesError && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {filesError}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                {/* Security profile */}
                <div className="flex flex-1 items-center gap-3">
                  <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Security profile</span>
                  <select
                    value={securityProfile}
                    onChange={(e) => setSecurityProfile(e.target.value)}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-2 py-1 text-[13px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    {(profiles.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.label}</option>
                    ))}
                    {!profiles.data?.some((p) => p.id === securityProfile) && (
                      <option value={securityProfile}>{securityProfile}</option>
                    )}
                  </select>
                  {securitySaved && <span className="text-[12px] text-[var(--color-success)]">Mentve</span>}
                  {securityError && <span className="text-[12px] text-[var(--color-danger)]">{securityError}</span>}
                  <Button
                    size="sm"
                    onClick={handleSaveSecurity}
                    disabled={securityMut.isPending || securityProfile === agent.securityProfile}
                  >
                    {securityMut.isPending ? '…' : 'Profile mentése'}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  {filesSaved[activeFileTab] && <span className="text-[12px] text-[var(--color-success)]">Mentve</span>}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSaveFile(activeFileTab)}
                    disabled={updateMut.isPending}
                  >
                    {updateMut.isPending ? 'Mentés…' : 'Fájl mentése'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Telegram tab */}
          {activeTab === 'telegram' && (
            <TelegramSection
              name={name!}
              hasTelegram={agent.hasTelegram}
              botUsername={agent.telegramBotUsername}
              error={tgError}
              success={tgSuccess}
              onError={setTgError}
              onSuccess={setTgSuccess}
            />
          )}

          {/* Team tab */}
          {activeTab === 'team' && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Szerep">
                  <select
                    value={teamForm.role}
                    onChange={(e) => setTeamForm((f) => ({ ...f, role: e.target.value as 'leader' | 'member' }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    <option value="member">member</option>
                    <option value="leader">leader</option>
                  </select>
                </Field>
                <Field label="Reports to">
                  <select
                    value={teamForm.reportsTo ?? ''}
                    onChange={(e) => setTeamForm((f) => ({ ...f, reportsTo: e.target.value || null }))}
                    className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
                  >
                    <option value="">(nincs)</option>
                    {otherAgents.map((a) => (
                      <option key={a.name} value={a.name}>{a.displayName || a.name}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Trust from</span>
                  <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] p-2">
                    {otherAgents.length === 0 ? (
                      <span className="text-[12px] text-[var(--color-text-muted)]">Nincs más ágens</span>
                    ) : otherAgents.map((a) => (
                      <label key={a.name} className="flex cursor-pointer items-center gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={teamForm.trustFrom.includes(a.name)}
                          onChange={(e) => setTeamForm((f) => ({
                            ...f,
                            trustFrom: e.target.checked
                              ? [...f.trustFrom, a.name]
                              : f.trustFrom.filter((n) => n !== a.name),
                          }))}
                          className="accent-[var(--color-accent)]"
                        />
                        {a.displayName || a.name}
                      </label>
                    ))}
                  </div>
                </div>

                {teamForm.role === 'leader' && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">Delegates to</span>
                    <div className="flex max-h-36 flex-col gap-1 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] p-2">
                      {otherAgents.length === 0 ? (
                        <span className="text-[12px] text-[var(--color-text-muted)]">Nincs más ágens</span>
                      ) : otherAgents.map((a) => (
                        <label key={a.name} className="flex cursor-pointer items-center gap-2 text-[13px]">
                          <input
                            type="checkbox"
                            checked={teamForm.delegatesTo.includes(a.name)}
                            onChange={(e) => setTeamForm((f) => ({
                              ...f,
                              delegatesTo: e.target.checked
                                ? [...f.delegatesTo, a.name]
                                : f.delegatesTo.filter((n) => n !== a.name),
                            }))}
                            className="accent-[var(--color-accent)]"
                          />
                          {a.displayName || a.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {teamForm.role === 'leader' && (
                <label className="flex cursor-pointer items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={teamForm.autoDelegation}
                    onChange={(e) => setTeamForm((f) => ({ ...f, autoDelegation: e.target.checked }))}
                    className="accent-[var(--color-accent)]"
                  />
                  Auto-delegation engedélyezve
                </label>
              )}

              {teamError && (
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                  {teamError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                {teamSaved && <span className="text-[13px] text-[var(--color-success)]">Mentve</span>}
                <Button variant="primary" onClick={handleSaveTeam} disabled={teamMut.isPending}>
                  {teamMut.isPending ? 'Mentés…' : 'Csapat mentése'}
                </Button>
              </div>
            </div>
          )}

          {/* Skills tab */}
          {activeTab === 'skills' && (
            <div className="flex flex-col gap-2">
              {!agent.skills || agent.skills.length === 0 ? (
                <div className="py-6 text-center text-sm text-[var(--color-text-muted)]">
                  Nincsenek skill-ek ehhez az ágenshez.
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {(agent.skills as { name: string; hasSkillMd: boolean }[]).map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 py-2 text-[13px]"
                    >
                      <span className="font-mono text-[var(--color-text)]">{s.name}</span>
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[11px] font-medium',
                        s.hasSkillMd
                          ? 'bg-[var(--color-success-soft,oklch(0.97_0.03_145))] text-[var(--color-success)]'
                          : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]',
                      ].join(' ')}>
                        {s.hasSkillMd ? 'SKILL.md' : 'no SKILL.md'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}

interface TelegramSectionProps {
  name: string
  hasTelegram: boolean
  botUsername?: string
  error: string | null
  success: string | null
  onError: (msg: string | null) => void
  onSuccess: (msg: string | null) => void
}

function TelegramSection({ name, hasTelegram, botUsername, error, success, onError, onSuccess }: TelegramSectionProps) {
  const [tokenInput, setTokenInput] = useState('')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const connectMut = useTelegramConnect()
  const disconnectMut = useTelegramDisconnect()
  const testMut = useTelegramTest()
  const approveMut = useTelegramApprove()
  const pending = useTelegramPending(name, hasTelegram)

  const handleConnect = async () => {
    const token = tokenInput.trim()
    if (!token) return
    onError(null)
    onSuccess(null)
    try {
      await connectMut.mutateAsync({ name, botToken: token })
      setTokenInput('')
      onSuccess('Telegram bot sikeresen csatlakoztatva!')
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDisconnect = async () => {
    if (!confirmDisconnect) { setConfirmDisconnect(true); return }
    onError(null)
    onSuccess(null)
    try {
      await disconnectMut.mutateAsync(name)
      setConfirmDisconnect(false)
      onSuccess('Telegram bot leválasztva.')
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleTest = async () => {
    onError(null)
    onSuccess(null)
    try {
      await testMut.mutateAsync(name)
      onSuccess('Kapcsolat rendben!')
    } catch {
      onError('Kapcsolat tesztelése sikertelen.')
    }
  }

  const handleApprove = async (code: string) => {
    onError(null)
    try {
      await approveMut.mutateAsync({ name, code })
      onSuccess('Párosítás jóváhagyva!')
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Telegram bot</span>
        <span className="flex items-center gap-1.5 text-[13px]">
          <span className={['h-2 w-2 rounded-full', hasTelegram ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-muted)]'].join(' ')} />
          {hasTelegram ? (botUsername || 'Csatlakozva') : 'Nincs beállítva'}
        </span>
      </div>

      {success && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-success-soft,oklch(0.97_0.03_145))] px-3 py-2 text-[13px] text-[var(--color-success)]">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {!hasTelegram ? (
        <div className="flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
            placeholder="Bot token (123456:ABC-...)"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 font-mono text-[12px] text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
          />
          <Button
            variant="primary"
            onClick={handleConnect}
            disabled={connectMut.isPending || !tokenInput.trim()}
          >
            {connectMut.isPending ? 'Kapcsolódás…' : 'Csatlakoztatás'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleTest} disabled={testMut.isPending}>
              {testMut.isPending ? 'Tesztelés…' : 'Kapcsolat tesztelése'}
            </Button>
            <Button
              onClick={handleDisconnect}
              disabled={disconnectMut.isPending}
              className={confirmDisconnect ? 'text-[var(--color-danger)]' : ''}
            >
              {confirmDisconnect ? 'Biztosan leválasztod? Kattints újra' : 'Bot leválasztása'}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[var(--color-text-muted)]">Várakozó párosítások</span>
              <button onClick={() => pending.refetch()} className="text-[12px] text-[var(--color-accent)] hover:underline">
                Frissítés
              </button>
            </div>
            {pending.isLoading ? (
              <p className="text-[13px] text-[var(--color-text-muted)]">Betöltés…</p>
            ) : !pending.data || pending.data.length === 0 ? (
              <p className="text-[13px] text-[var(--color-text-muted)]">Nincs várakozó párosítás</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {pending.data.map((p) => (
                  <div
                    key={p.code}
                    className="flex items-center justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-[13px]"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono font-medium">{p.code}</span>
                      <span className="text-[var(--color-text-muted)]">Sender: {p.senderId}</span>
                    </div>
                    <Button variant="primary" size="sm" onClick={() => handleApprove(p.code)} disabled={approveMut.isPending}>
                      Jóváhagyás
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

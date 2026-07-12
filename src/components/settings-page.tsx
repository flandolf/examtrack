import { useEffect, useState } from "react"
import { createChatGPTProxyProvider } from "@opencoredev/loginwithchatgpt-ai"
import { useLoginWithChatGPT } from "@opencoredev/loginwithchatgpt-react"
import { CheckCircle2, Cloud, Copy, ExternalLink, LogOut, RefreshCw, Sparkles } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  loadAISettings,
  REASONING_EFFORTS,
  saveAISettings,
  type AISettings,
  type ReasoningEffort,
} from "@/lib/ai-settings"
import type { useSupabaseSync } from "@/lib/sync"

const REASONING_LABELS: Record<ReasoningEffort, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high",
}

export function SettingsPage({ sync }: { sync: ReturnType<typeof useSupabaseSync> }) {
  const auth = useLoginWithChatGPT()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accountLoading, setAccountLoading] = useState(false)
  const [accountMessage, setAccountMessage] = useState<string | null>(null)
  const [settings, setSettings] = useState<AISettings>(() => loadAISettings())
  const [models, setModels] = useState<string[]>([])
  const [loadingModels, setLoadingModels] = useState(false)
  const [modelError, setModelError] = useState<string | null>(null)

  function update(next: AISettings) {
    setSettings(next)
    saveAISettings(next)
  }

  async function refreshModels() {
    setLoadingModels(true)
    setModelError(null)
    try {
      setModels((await createChatGPTProxyProvider().listModels()).filter((model) => model.startsWith("gpt-5")))
    } catch {
      setModels([])
      setModelError("Could not load models for this account.")
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    if (auth.isAuthenticated) void refreshModels()
    else setModels([])
  }, [auth.isAuthenticated])

  const identity = auth.user?.name ?? auth.user?.email ?? "ChatGPT account"

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description="Manage sync, the ChatGPT connection, and mistake analysis." />

      <Card>
        <CardHeader>
          <CardTitle>ExamTrack account</CardTitle>
          <CardDescription>Sign in with your email and password to sync attempts and mistakes across devices.</CardDescription>
          {sync.user ? <CardAction><Badge variant="secondary"><Cloud />{sync.status === "syncing" ? "Syncing" : sync.status === "error" ? "Sync failed" : "Synced"}</Badge></CardAction> : null}
        </CardHeader>
        <CardContent>
          {!sync.configured ? (
            <p className="text-sm text-muted-foreground">Add the Supabase URL and publishable key to enable account sync.</p>
          ) : sync.user ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{sync.user.email}</p><p className="text-sm text-muted-foreground">Local changes continue saving if sync is temporarily unavailable.</p></div>
              <Button variant="outline" onClick={() => void sync.signOut()}><LogOut />Sign out</Button>
            </div>
          ) : (
            <form className="grid max-w-md gap-3" onSubmit={async (event) => {
              event.preventDefault()
              setAccountLoading(true)
              setAccountMessage(null)
              try {
                await sync.signIn(email, password)
              } catch (error) {
                setAccountMessage(error instanceof Error ? error.message : "Could not sign in.")
              } finally {
                setAccountLoading(false)
              }
            }}>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" aria-label="Email address" required />
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" aria-label="Password" minLength={8} required />
              <div className="flex gap-2">
                <Button type="submit" disabled={accountLoading}><Cloud />Sign in</Button>
                <Button type="button" variant="outline" disabled={accountLoading} onClick={async (event) => {
                  if (!event.currentTarget.form?.reportValidity()) return
                  setAccountLoading(true)
                  setAccountMessage(null)
                  try {
                    const signedIn = await sync.signUp(email, password)
                    if (!signedIn) setAccountMessage("Disable Confirm email in Supabase Auth settings to create accounts without callbacks.")
                  } catch (error) {
                    setAccountMessage(error instanceof Error ? error.message : "Could not create the account.")
                  } finally {
                    setAccountLoading(false)
                  }
                }}>Create account</Button>
              </div>
            </form>
          )}
          {accountMessage ? <p role="status" className="mt-3 text-sm text-muted-foreground">{accountMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ChatGPT connection</CardTitle>
          <CardDescription>AI requests use the connected account's ChatGPT plan.</CardDescription>
          <CardAction>
            {auth.isAuthenticated ? <Badge variant="secondary"><CheckCircle2 />Connected</Badge> : null}
          </CardAction>
        </CardHeader>
        <CardContent>
          {auth.status === "loading" ? <Skeleton className="h-16 w-full" /> : null}

          {auth.isAuthenticated ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{identity}</p>
                <p className="text-sm text-muted-foreground">
                  {auth.user?.email && auth.user.email !== identity ? auth.user.email : "Ready for mistake analysis"}
                  {auth.user?.plan ? ` · ${auth.user.plan} plan` : ""}
                </p>
              </div>
              <Button variant="outline" onClick={() => void auth.logout()}><LogOut />Disconnect</Button>
            </div>
          ) : null}

          {auth.status === "pending" ? (
            <div className="grid gap-3">
              <p className="text-sm">Enter code <strong className="font-mono">{auth.userCode}</strong> in the ChatGPT authorization window.</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void auth.copyCode()}><Copy />{auth.copied ? "Copied" : "Copy code"}</Button>
                <Button variant="outline" render={<a href={auth.verificationUrl} target="_blank" rel="noopener noreferrer" />}><ExternalLink />Reopen authorization</Button>
              </div>
            </div>
          ) : null}

          {auth.status !== "loading" && !auth.isAuthenticated && auth.status !== "pending" ? (
            <div className="grid gap-4">
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Connecting lets ExamTrack spend from your ChatGPT plan for AI requests. Prompts and mistake photos pass through this server; ExamTrack never receives your password. Disconnecting deletes the server session.
              </p>
              <div>
                <Button disabled={auth.isConnecting} onClick={() => void auth.login({ popup: window.open("about:blank", "_blank") })}>
                  <Sparkles />{auth.isConnecting ? "Connecting…" : "I understand, connect ChatGPT"}
                </Button>
              </div>
              {auth.error ? <p role="alert" className="text-sm text-destructive">{auth.error}</p> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis</CardTitle>
          <CardDescription>These preferences apply the next time you use Fill with AI.</CardDescription>
          {auth.isAuthenticated ? <CardAction><Button size="sm" variant="ghost" disabled={loadingModels} onClick={() => void refreshModels()}><RefreshCw className={loadingModels ? "animate-spin" : ""} />Refresh</Button></CardAction> : null}
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Model</FieldLabel>
              <Select value={settings.model} onValueChange={(model) => update({ ...settings, model: model ?? "auto" })}>
                <SelectTrigger className="w-full"><SelectValue>{settings.model === "auto" ? "Automatic" : settings.model}</SelectValue></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic</SelectItem>
                  {models.map((model) => <SelectItem key={model} value={model}>{model}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldDescription>Automatic prefers the newest supported model available to your account.</FieldDescription>
              {modelError ? <p role="alert" className="text-sm text-destructive">{modelError}</p> : null}
            </Field>

            <Field>
              <FieldLabel>Reasoning effort</FieldLabel>
              <Select value={settings.reasoningEffort} onValueChange={(reasoningEffort) => update({ ...settings, reasoningEffort: reasoningEffort as ReasoningEffort })}>
                <SelectTrigger className="w-full"><SelectValue>{REASONING_LABELS[settings.reasoningEffort]}</SelectValue></SelectTrigger>
                <SelectContent>
                  {REASONING_EFFORTS.map((effort) => <SelectItem key={effort} value={effort}>{REASONING_LABELS[effort]}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldDescription>Higher effort may improve difficult mathematical analysis but can take longer. Saved on this device.</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  )
}

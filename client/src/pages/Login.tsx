import { useState } from 'react'
import { api, extractApiReason } from '../lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function Login({ onLoggedIn, className, ...props }: { onLoggedIn: (u: any) => void } & React.ComponentProps<'div'>) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.login(email, password)
      onLoggedIn(res)
    } catch (e: any) {
      const status = e?.status
      const reason = extractApiReason(e)
      if (status === 401) {
        setError('Invalid email or password')
      } else if (status === 429) {
        setError('Too many attempts. Please wait and try again.')
      } else if (status === 400) {
        setError('Missing or invalid input. Please check and try again.')
      } else {
        setError('Login failed due to a server error. Please try again later.')
        // Optionally log reason to console for debugging
        if (import.meta.env.DEV && reason) console.debug('[Login] server reason:', reason)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-col gap-6 min-h-full p-6 items-center justify-center', className)} {...props}>
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-0">
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>Enter your email below to login to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit}>
            <FieldGroup>
              {error && (
                <FieldDescription className="text-red-600">{error}</FieldDescription>
              )}
              <Field>
                <FieldLabel htmlFor="email">Email</FieldLabel>
                <Input id="email" type="email" name="email" autoComplete="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field>
                <div className="flex items-center w-full">
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <a href="/reset/request" className="ml-auto inline-block text-sm underline-offset-4 hover:underline font-medium">
                    Forgot your password?
                  </a>
                </div>
                <Input id="password" type="password" name="current-password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <Field>
                <div className="flex gap-2">
                  <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in…' : 'Login'}</Button>
                  {/* Optional SSO button placeholder; non-functional */}
                  {/* <Button variant="outline" type="button">Login with Google</Button> */}
                </div>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

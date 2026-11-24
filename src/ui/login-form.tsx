"use client";
import { type AuthFormState, loginAction, registerAction } from "@/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

const FieldError = ({ errors }: { errors?: string[] }) =>
	errors?.length ? <p className="text-sm text-destructive">{errors[0]}</p> : null;

const SubmitButton = ({ pending, children }: { pending: boolean; children: React.ReactNode }) => (
	<Button type="submit" className="relative w-full" disabled={pending}>
		<span className={pending ? "opacity-0" : undefined}>{children}</span>
		{pending && <Loader2Icon className="absolute h-4 w-4 animate-spin" />}
	</Button>
);

const withNext = (href: string, next?: string) => (next ? `${href}?next=${encodeURIComponent(next)}` : href);

export function LoginForm({ next }: { next?: string }) {
	const [state, action, pending] = useActionState<AuthFormState, FormData>(loginAction, undefined);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-2xl">Anmelden</CardTitle>
				<CardDescription>
					Melde dich an, um deine Verträge zu verwalten oder einen Vertrag zu kaufen.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={action} className="grid gap-4">
					{next && <input type="hidden" name="next" value={next} />}
					<div className="grid gap-2">
						<Label htmlFor="email">E-Mail</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							defaultValue={state?.values?.email}
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Passwort</Label>
						<Input id="password" name="password" type="password" autoComplete="current-password" required />
					</div>
					{state?.error && (
						<p role="alert" className="text-sm text-destructive">
							{state.error}
						</p>
					)}
					<SubmitButton pending={pending}>Anmelden</SubmitButton>
				</form>
				<p className="mt-4 text-center text-sm text-muted-foreground">
					Noch kein Konto?{" "}
					<Link href={withNext("/registrieren", next)} className="underline underline-offset-4">
						Kostenlos registrieren
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}

export function RegisterForm({ next }: { next?: string }) {
	const [state, action, pending] = useActionState<AuthFormState, FormData>(registerAction, undefined);
	const errors = state?.fieldErrors ?? {};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-2xl">Konto erstellen</CardTitle>
				<CardDescription>
					Kostenlos registrieren, Verträge einstellen und verwalten. Wir berechnen nur 5&nbsp;% Gebühr, wenn
					dein Vertrag verkauft wird.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={action} className="grid gap-4" noValidate>
					{next && <input type="hidden" name="next" value={next} />}
					<div className="grid gap-2">
						<Label htmlFor="name">Name</Label>
						<Input id="name" name="name" autoComplete="name" defaultValue={state?.values?.name} required />
						<FieldError errors={errors.name} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="email">E-Mail</Label>
						<Input
							id="email"
							name="email"
							type="email"
							autoComplete="email"
							defaultValue={state?.values?.email}
							required
						/>
						<FieldError errors={errors.email} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="password">Passwort</Label>
						<Input id="password" name="password" type="password" autoComplete="new-password" required />
						<FieldError errors={errors.password} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="passwordConfirm">Passwort wiederholen</Label>
						<Input
							id="passwordConfirm"
							name="passwordConfirm"
							type="password"
							autoComplete="new-password"
							required
						/>
						<FieldError errors={errors.passwordConfirm} />
					</div>
					<div className="grid gap-1">
						<label className="flex items-start gap-2 text-sm">
							<input type="checkbox" name="terms" className="mt-0.5 h-4 w-4 accent-black" />
							<span>
								Ich akzeptiere die{" "}
								<Link href="/agb" className="underline underline-offset-4" target="_blank">
									AGB
								</Link>{" "}
								und habe die{" "}
								<Link href="/dse" className="underline underline-offset-4" target="_blank">
									Datenschutzerklärung
								</Link>{" "}
								gelesen.
							</span>
						</label>
						<FieldError errors={errors.terms} />
					</div>
					<SubmitButton pending={pending}>Registrieren</SubmitButton>
				</form>
				<p className="mt-4 text-center text-sm text-muted-foreground">
					Schon registriert?{" "}
					<Link href={withNext("/login", next)} className="underline underline-offset-4">
						Anmelden
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}

export function AuthShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-50 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<Link href="/" className="self-center text-xl font-bold">
					Vertragsmarkt
				</Link>
				{children}
			</div>
		</div>
	);
}

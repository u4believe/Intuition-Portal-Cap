"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WalletConnectButton } from "@/components/wallet-connect-button"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Redirect to login page since we only support wallet authentication
    router.push("/auth/login")
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect Wallet</CardTitle>
          <CardDescription>Sign up with your wallet to get started with Intuition Portal Cap</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <WalletConnectButton />
            <form>
              <Button disabled={loading}>
                {loading ? "Creating account..." : "Sign Up"}
              </Button>
            </form>
            <p className="text-xs text-slate-500 text-center mt-4">
              We only support wallet-based authentication. Please connect your wallet to continue.
            </p>
            <div className="text-center">
              <Link href="/auth/login" className="text-xs text-primary hover:underline">
                Back to Login
              </Link>
            </div>
            <p className="text-sm text-center mt-4">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

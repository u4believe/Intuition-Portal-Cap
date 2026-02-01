"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Bell, ArrowRight } from "lucide-react"

interface SignInPromptDialogProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  description?: string
  action?: string
}

export default function SignInPromptDialog({
  isOpen,
  onClose,
  title = "Subscribe to Email Alerts",
  description = "Get instant notifications about market cap changes, price movements, and position updates for your favorite claims.",
  action = "Watch This Claim",
}: SignInPromptDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary mb-4">
            <Bell className="w-6 h-6 text-white" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-base pt-2">{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">1</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">Create Your Account</p>
                <p className="text-xs text-muted-foreground">Sign up with your email address</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">2</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">Configure Alerts</p>
                <p className="text-xs text-muted-foreground">Set your frequency and triggers</p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">3</span>
                </div>
              </div>
              <div>
                <p className="font-medium text-sm">Start Watching</p>
                <p className="text-xs text-muted-foreground">Receive instant email notifications</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 flex-col-reverse">
          <Button variant="outline" onClick={onClose} className="border-slate-700 bg-transparent">
            Maybe Later
          </Button>
          <Link href="/auth/signup" className="block">
            <Button className="w-full bg-primary hover:bg-primary/90 gap-2">
              {action} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}

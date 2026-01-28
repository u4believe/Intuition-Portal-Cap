import { LogIn, LogOut, TrendingUp } from "lucide-react"

export function getEventIcon(eventType: string) {
  switch (eventType) {
    case "deposit":
      return <LogIn className="w-3 h-3" />
    case "redemption":
      return <LogOut className="w-3 h-3" />
    default:
      return <TrendingUp className="w-3 h-3" />
  }
}

export function getEventColor(eventType: string) {
  switch (eventType) {
    case "deposit":
      return "bg-green-500/20 text-green-300"
    case "redemption":
      return "bg-red-500/20 text-red-300"
    default:
      return "bg-blue-500/20 text-blue-300"
  }
}

export function getEventLabel(eventType: string) {
  switch (eventType) {
    case "deposit":
      return "Deposit"
    case "redemption":
      return "Redemption"
    default:
      return "Update"
  }
}

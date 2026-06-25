export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastData {
  id: string
  message: string
  type: ToastType
}

type Listener = (toasts: ToastData[]) => void

let toasts: ToastData[] = []
let listeners: Listener[] = []
let counter = 0

function notify() {
  listeners.forEach(l => l([...toasts]))
}

export function showToast(message: string, type: ToastType = 'info', duration = 3500) {
  const id = `toast-${++counter}`
  toasts = [...toasts, { id, message, type }]
  notify()

  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id)
    notify()
  }, duration)
}

export function dismissToast(id: string) {
  toasts = toasts.filter(t => t.id !== id)
  notify()
}

export function subscribe(listener: Listener) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

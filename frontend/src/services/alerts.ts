import Swal, { type SweetAlertIcon } from 'sweetalert2'

type ConfirmOptions = {
  title?: string
  text?: string
  confirmText?: string
  cancelText?: string
  icon?: SweetAlertIcon
}

const confirmButtonColor = '#0D9488'
const cancelButtonColor = '#64748B'

export function showAlert(message: string, icon: SweetAlertIcon = 'info', title = 'Aviso') {
  return Swal.fire({
    icon,
    title,
    text: message,
    confirmButtonText: 'OK',
    confirmButtonColor,
  })
}

export function showSuccess(message: string, title = 'Listo') {
  return showAlert(message, 'success', title)
}

export function showError(message: string, title = 'Error') {
  return showAlert(message, 'error', title)
}

export function showWarning(message: string, title = 'Atencion') {
  return showAlert(message, 'warning', title)
}

export async function showConfirm(options: ConfirmOptions) {
  const result = await Swal.fire({
    icon: options.icon ?? 'question',
    title: options.title ?? 'Confirmar',
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmText ?? 'Confirmar',
    cancelButtonText: options.cancelText ?? 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
    confirmButtonColor,
    cancelButtonColor,
  })

  return result.isConfirmed
}

export function showLoading(title = 'Cargando...', text?: string) {
  if (Swal.isVisible()) return

  Swal.fire({
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading()
    },
  })
}

export function hideLoading() {
  if (Swal.isVisible()) {
    Swal.close()
  }
}

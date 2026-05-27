import type { Response } from 'express'
import type { ZodError } from 'zod'

export function zodErrorMessage(error: ZodError): string {
  return error.issues.map((i) => i.message).join(' ')
}

export function sendError(res: Response, status: number, message: string) {
  return res.status(status).json({ error: message })
}

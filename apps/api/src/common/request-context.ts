import type { Response } from 'express'

export type ResponseWithRequestId = Response<unknown, { requestId: string }>

import { executeApi, type ApiResponse } from '../api-response'
import { z } from 'zod'

// Mock NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => {
      const response = {
        json: async () => body,
        status: init?.status || 200,
      }
      return response
    }),
  },
}))

describe('API Response Helper', () => {
  describe('executeApi', () => {
    it('should successfully execute handler with valid input', async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      })

      const handler = jest.fn(async (req: Request, body) => {
        return { message: `Hello ${body.name}, you are ${body.age} years old` }
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice', age: 30 }),
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.type).toBe('success')
      expect(json.data).toEqual({ message: 'Hello Alice, you are 30 years old' })
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        request,
        { name: 'Alice', age: 30 }
      )
    })

    it('should return error for invalid schema', async () => {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(8),
      })

      const handler = jest.fn(async () => {
        return { success: true }
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email', password: 'short' }),
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.type).toBe('error')
      expect(json.message).toBeDefined()
      expect(handler).not.toHaveBeenCalled()
    })

    it('should return error when handler throws', async () => {
      const schema = z.object({
        userId: z.string(),
      })

      const handler = jest.fn(async () => {
        throw new Error('Database connection failed')
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: '123' }),
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.type).toBe('error')
      expect(json.message).toBe('Database connection failed')
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle empty schema', async () => {
      const schema = z.object({})

      const handler = jest.fn(async () => {
        return { result: 'success' }
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.type).toBe('success')
      expect(json.data).toEqual({ result: 'success' })
    })

    it('should handle complex nested schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          preferences: z.object({
            theme: z.enum(['light', 'dark']),
            notifications: z.boolean(),
          }),
        }),
        metadata: z.array(z.string()),
      })

      const handler = jest.fn(async (req: Request, body) => {
        return {
          processed: true,
          userName: body.user.name,
          theme: body.user.preferences.theme,
        }
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            name: 'Bob',
            preferences: {
              theme: 'dark',
              notifications: true,
            },
          },
          metadata: ['tag1', 'tag2'],
        }),
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json.type).toBe('success')
      expect(json.data).toEqual({
        processed: true,
        userName: 'Bob',
        theme: 'dark',
      })
    })

    it('should return error for malformed JSON', async () => {
      const schema = z.object({
        name: z.string(),
      })

      const handler = jest.fn(async () => {
        return { success: true }
      })

      const apiHandler = executeApi(schema, handler)

      const request = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {{{',
      })

      const response = await apiHandler(request)
      const json = await response.json()

      expect(response.status).toBe(500)
      expect(json.type).toBe('error')
      expect(json.message).toBeDefined()
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('ApiResponse type', () => {
    it('should correctly type success responses', () => {
      const successResponse: ApiResponse<{ count: number }> = {
        type: 'success',
        data: { count: 42 },
      }

      expect(successResponse.type).toBe('success')
      if (successResponse.type === 'success') {
        expect(successResponse.data.count).toBe(42)
      }
    })

    it('should correctly type error responses', () => {
      const errorResponse: ApiResponse<{ count: number }> = {
        type: 'error',
        message: 'Something went wrong',
      }

      expect(errorResponse.type).toBe('error')
      if (errorResponse.type === 'error') {
        expect(errorResponse.message).toBe('Something went wrong')
      }
    })
  })
})

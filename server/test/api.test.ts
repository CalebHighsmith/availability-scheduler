import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { closeDb, initTestDb } from '../src/db'

beforeEach(() => {
  closeDb()
  initTestDb(':memory:')
})

describe('API integration', () => {
  it('creates staff and generates slots from weekly availability', async () => {
    const staffRes = await request(app).post('/api/staff').send({ name: 'Jane Smith' }).expect(201)
    const staffId = staffRes.body.staff.id as number

    await request(app)
      .post('/api/weekly-windows')
      .send({ staffId, dayOfWeek: 1, startTime: '09:00', endTime: '10:00' })
      .expect(201)

    const slotsRes = await request(app)
      .get('/api/slots')
      .query({ staffId, start: '2026-05-25', end: '2026-05-25', durationMin: 30 })
      .expect(200)

    expect(slotsRes.body.days).toHaveLength(1)
    expect(slotsRes.body.days[0].dateLabel).toMatch(/Monday/)
    expect(slotsRes.body.days[0].slots).toEqual(['9:00 AM', '9:30 AM'])
    expect(slotsRes.body.days[0].source).toBe('recurring')
  })

  it('rejects overlapping weekly windows', async () => {
    const staffRes = await request(app).post('/api/staff').send({ name: 'Bob' }).expect(201)
    const staffId = staffRes.body.staff.id as number

    await request(app)
      .post('/api/weekly-windows')
      .send({ staffId, dayOfWeek: 2, startTime: '09:00', endTime: '10:00' })
      .expect(201)

    const overlap = await request(app)
      .post('/api/weekly-windows')
      .send({ staffId, dayOfWeek: 2, startTime: '09:30', endTime: '11:00' })

    expect(overlap.status).toBe(400)
    expect(overlap.body.error).toMatch(/overlap/i)
  })

  it('marks a day unavailable via override', async () => {
    const staffRes = await request(app).post('/api/staff').send({ name: 'Jane' }).expect(201)
    const staffId = staffRes.body.staff.id as number

    await request(app)
      .post('/api/weekly-windows')
      .send({ staffId, dayOfWeek: 3, startTime: '09:00', endTime: '17:00' })
      .expect(201)

    await request(app)
      .post('/api/overrides')
      .send({ staffId, date: '2026-05-27', type: 'unavailable' })
      .expect(201)

    const slotsRes = await request(app)
      .get('/api/slots')
      .query({ staffId, start: '2026-05-27', end: '2026-05-27', durationMin: 30 })
      .expect(200)

    expect(slotsRes.body.days[0].source).toBe('override_unavailable')
    expect(slotsRes.body.days[0].slots).toEqual([])
  })

  it('rejects end date before start date', async () => {
    const staffRes = await request(app).post('/api/staff').send({ name: 'Jane' }).expect(201)
    const staffId = staffRes.body.staff.id as number

    const res = await request(app)
      .get('/api/slots')
      .query({ staffId, start: '2026-05-29', end: '2026-05-25', durationMin: 30 })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/start date/i)
  })

  it('rejects add override windows that overlap weekly availability', async () => {
    const staffRes = await request(app).post('/api/staff').send({ name: 'Jane' }).expect(201)
    const staffId = staffRes.body.staff.id as number

    await request(app)
      .post('/api/weekly-windows')
      .send({ staffId, dayOfWeek: 4, startTime: '09:00', endTime: '12:00' })
      .expect(201)

    const res = await request(app)
      .post('/api/overrides')
      .send({
        staffId,
        date: '2026-05-28',
        type: 'add',
        windows: [{ startTime: '11:00', endTime: '13:00' }],
      })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/overlap/i)
  })
})

import { expect, test } from '@playwright/test'

test.describe('Availability Scheduler', () => {
  test('loads the app', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Availability Scheduler', { exact: true })).toBeVisible()
    await expect(page.getByTestId('staff-select')).toBeVisible()
  })

  test('seeds demo data and shows Jane slots on the calendar', async ({ page }) => {
    await page.goto('/')

    await page.getByTestId('seed-demo-data').click()
    await page.getByTestId('staff-select').selectOption({ label: 'Jane Smith' })

    await page.getByTestId('generate-slots').click()

    const monday = page.getByTestId('calendar-day-2026-05-25')
    await expect(monday).toBeVisible()
    await monday.click()

    await expect(page.getByTestId('calendar-day-detail')).toContainText('9:00 AM')
    await expect(page.getByTestId('calendar-day-detail')).toContainText('9:30 AM')
  })

  test('bulk weekly editor adds windows', async ({ page }) => {
    await page.goto('/')

    const staffName = `E2E Staff ${Date.now()}`
    await page.getByPlaceholder('Add new staff member').fill(staffName)
    await page.getByRole('button', { name: 'Add staff' }).click()

    for (const d of [1, 2, 3, 4, 5]) {
      await page.getByTestId(`bulk-day-${d}`).click()
    }
    await page.getByTestId('bulk-day-6').click()
    await page.getByTestId('bulk-weekly-apply').click()

    await expect(page.getByText(/Added 1 window/)).toBeVisible()
    await expect(page.getByTestId('weekly-day-6')).toContainText('9:00 AM')
  })

  test('switches between calendar and list views', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('seed-demo-data').click()
    await page.getByTestId('staff-select').selectOption({ label: 'Jane Smith' })

    await expect(page.getByTestId('availability-calendar')).toBeVisible()

    await page.getByTestId('slots-view-list').click()
    await expect(page.getByTestId('availability-calendar')).toBeHidden()

    await page.getByTestId('generate-slots').click()
    await expect(page.getByTestId('slots-list')).toBeVisible()
    await expect(page.getByTestId('slots-list')).toContainText('Monday')

    await page.getByTestId('slots-view-calendar').click()
    await expect(page.getByTestId('availability-calendar')).toBeVisible()
  })
})

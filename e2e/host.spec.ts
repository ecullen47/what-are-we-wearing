import { test, expect } from './fixtures'
import { TEST_EVENT_NAME, daysFromToday, deleteTestEvent } from '../tests/helpers'

test('a host from a platform link logs in and creates the prefilled event', async ({ page, host }) => {
  // Logs in and creates an event through the form, so it runs long when
  // the whole suite shares one dev server.
  test.slow()
  const date = daysFromToday(30)
  const params = new URLSearchParams({
    name: TEST_EVENT_NAME,
    date: `${date}T19:00:00Z`,
    location: 'Brooklyn',
    type: 'birthday',
    dress: 'Cocktail chic',
    host: 'Maya',
  })
  await page.goto(`/create-event?${params}`)

  // Logged out, so it goes to login first and keeps the link.
  await expect(page).toHaveURL(/\/login\?next=/)
  await expect(page.getByText('Your details will be waiting.')).toBeVisible()
  await page.getByPlaceholder('Email').fill(process.env.TEST_HOST_EMAIL!)
  await page.getByPlaceholder('Password').fill(process.env.TEST_HOST_PASSWORD!)
  await page.getByRole('button', { name: 'Log In' }).click()

  await expect(page).toHaveURL(/\/create-event\?/)
  await expect(page.getByText('We filled in what we could')).toBeVisible()
  await expect(page.getByLabel('Your Name')).toHaveValue('Maya')
  await expect(page.getByLabel('Event Name')).toHaveValue(TEST_EVENT_NAME)
  await expect(page.getByLabel('Date')).toHaveValue(date)
  await expect(page.getByLabel('Location')).toHaveValue('Brooklyn')
  await expect(page.getByLabel('Event Type')).toHaveValue('party')
  await expect(page.getByLabel('Dress Code')).toHaveValue('Cocktail chic')

  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page).toHaveURL(/\/event\/([A-Z0-9]+)\/setup$/)
  const code = page.url().match(/\/event\/([A-Z0-9]+)\/setup$/)![1]

  const { data } = await host.from('events').select('id, event_type, location').eq('invite_code', code).single()
  expect(data).toMatchObject({ event_type: 'party', location: 'Brooklyn' })

  // The host can print an invite card with the dress code and the code.
  await page.goto(`/event/${code}`)
  await page.getByRole('link', { name: 'Print invite card' }).click()
  await expect(page).toHaveURL(new RegExp(`/event/${code}/card$`))
  await expect(page.getByText('Cocktail chic')).toBeVisible()
  await expect(page.getByText(`Scan, or enter code ${code}`)).toBeVisible()
  await expect(page.getByLabel('QR code for the event page').locator('svg')).toBeVisible()

  await deleteTestEvent(host, { id: data!.id, code })
})

test('the login page refuses to redirect off-site', async ({ page }) => {
  await page.goto('/login?next=//example.com/phish')
  await page.getByPlaceholder('Email').fill(process.env.TEST_HOST_EMAIL!)
  await page.getByPlaceholder('Password').fill(process.env.TEST_HOST_PASSWORD!)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL(/localhost:\d+\/dashboard$/)
})

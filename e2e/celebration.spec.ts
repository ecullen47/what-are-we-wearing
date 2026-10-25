import { test, expect } from './fixtures'
import { TEST_EVENT_NAME, createTestEvent, daysFromToday, deleteTestEvent } from '../tests/helpers'

test('a host pins an update and adds an event under the celebration', async ({ page, browser, host, event }) => {
  // Logs in, waits on a live update and creates an event, so it runs long
  // when the whole suite shares one dev server.
  test.slow()
  await page.goto(`/login?next=/event/${event.code}`)
  await page.getByPlaceholder('Email').fill(process.env.TEST_HOST_EMAIL!)
  await page.getByPlaceholder('Password').fill(process.env.TEST_HOST_PASSWORD!)
  await page.getByRole('button', { name: 'Log In' }).click()
  // The full address: the login URL itself ends in the event's (its ?next=).
  await expect(page).toHaveURL(new URL(`/event/${event.code}`, page.url()).href)

  // A guest has the page open and sees the update arrive live.
  const guestPage = await (await browser.newContext()).newPage()
  await guestPage.goto(`/event/${event.code}`)
  await expect(guestPage.getByText('Update from')).toHaveCount(0)

  await page.getByRole('button', { name: '+ Pin an update for your guests' }).click()
  await page.getByLabel('Update for your guests').fill('Ceremony moved outdoors, bring flats!')
  await page.getByRole('button', { name: 'Pin update' }).click()
  await expect(page.getByText('Ceremony moved outdoors, bring flats!')).toBeVisible()
  await expect(guestPage.getByText('Ceremony moved outdoors, bring flats!')).toBeVisible()
  await expect(guestPage.getByText(/Update from Test Host · just now/i)).toBeVisible()

  // Add brunch under it, starting from the celebration's details.
  await page.getByRole('link', { name: 'Add events under this one' }).click()
  await expect(page.getByText(`This will be part of ${TEST_EVENT_NAME}`)).toBeVisible()
  await expect(page.getByLabel('Location')).toHaveValue('Test Hall')
  await page.getByLabel('Event Name').fill(TEST_EVENT_NAME)
  await page.getByLabel('Date').fill(daysFromToday(11))
  await page.getByLabel('Dress Code').fill('Garden casual')
  await page.getByRole('button', { name: 'Create Event' }).click()
  await expect(page).toHaveURL(/\/event\/([A-Z0-9]+)\/setup$/)
  const partCode = page.url().match(/\/event\/([A-Z0-9]+)\/setup$/)![1]
  const { data: part } = await host.from('events').select('id').eq('invite_code', partCode).single()

  try {
    // Guests with the celebration's code see its events instead of a feed.
    await guestPage.goto(`/event/${event.code}`)
    await expect(guestPage.getByRole('heading', { name: 'The events' })).toBeVisible()
    await expect(guestPage.getByText('Dress code: Garden casual')).toBeVisible()
    await expect(guestPage.getByRole('heading', { name: 'Post Your Outfit' })).toHaveCount(0)

    await guestPage.getByRole('link', { name: /Garden casual/ }).click()
    await expect(guestPage).toHaveURL(new RegExp(`/event/${partCode}$`))
    await expect(guestPage.getByText(`Part of ${TEST_EVENT_NAME}`)).toBeVisible()
    await expect(guestPage.getByRole('heading', { name: 'Post Your Outfit' })).toBeVisible()
  } finally {
    await deleteTestEvent(host, { id: part!.id, code: partCode })
  }
})

test('after the event, the page becomes a keepsake without polls', async ({ page, host }) => {
  const event = await createTestEvent(host, { event_date: daysFromToday(-2) })
  try {
    await page.goto(`/event/${event.code}`)
    await expect(page.getByRole('heading', { name: 'Add What You Wore' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'What everyone wore' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Can't decide/ })).toHaveCount(0)
  } finally {
    await deleteTestEvent(host, event)
  }
})

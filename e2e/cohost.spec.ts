import { test, expect } from './fixtures'
import { TEST_EVENT_NAME } from '../tests/helpers'

test('a host makes a co-host link that shows the invite to whoever opens it', async ({ page, browser, event }) => {
  test.slow()
  await page.goto(`/login?next=/event/${event.code}/edit`)
  await page.getByPlaceholder('Email').fill(process.env.TEST_HOST_EMAIL!)
  await page.getByPlaceholder('Password').fill(process.env.TEST_HOST_PASSWORD!)
  await page.getByRole('button', { name: 'Log In' }).click()
  // The full address: the login URL itself ends in /edit (its ?next=).
  await expect(page).toHaveURL(new URL(`/event/${event.code}/edit`, page.url()).href)

  await expect(page.getByRole('heading', { name: 'Co-hosts' })).toBeVisible()
  await expect(page.getByText('No co-hosts yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Invite a co-host' }).click()
  const link = await page.getByLabel('Co-host link').inputValue()
  expect(link).toMatch(/\/cohost\/[0-9a-f-]{36}$/)

  // Someone logged out opens it: they see the event and are sent to log in.
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto(link)
  await expect(visitor.getByText('Test Host invited you to co-host')).toBeVisible()
  await expect(visitor.getByRole('heading', { name: TEST_EVENT_NAME })).toBeVisible()
  await visitor.getByRole('link', { name: 'Log in or sign up to join' }).click()
  await expect(visitor.getByText('then you can join as a co-host')).toBeVisible()

  // A new link replaces it; the old one stops working.
  await page.getByRole('button', { name: 'Make a new link' }).click()
  await expect(page.getByLabel('Co-host link')).not.toHaveValue(link)
  await visitor.goto(link)
  await expect(visitor.getByRole('heading', { name: 'This link has expired' })).toBeVisible()

  // The owner still has the danger zone; co-hosts won't.
  await expect(page.getByRole('heading', { name: 'Delete Event' })).toBeVisible()
})

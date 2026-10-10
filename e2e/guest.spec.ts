import { test, expect, pngFile } from './fixtures'
import { anonClient, fakeImage, newGuestToken } from '../tests/helpers'

test('a guest arriving from a platform link posts an outfit', async ({ page, event }) => {
  await page.goto(`/event/${event.code}?name=Sam%20Lee#post`)

  await expect(page.getByRole('heading', { name: 'Post Your Outfit' })).toBeInViewport()
  await expect(page.getByPlaceholder('Your Name')).toHaveValue('Sam Lee')
  // The name is dropped from the address bar once read.
  await expect(page).toHaveURL(new RegExp(`/event/${event.code}#post$`))

  await page.locator('input[type=file]').first().setInputFiles(pngFile('look.png'))
  await expect(page.getByAltText('Your outfit')).toBeVisible()
  await page.getByPlaceholder('Caption (optional)').fill('Emerald slip dress')
  await page.getByRole('button', { name: 'Sage', exact: true }).click()
  await page.getByRole('button', { name: /^Post (Outfit|Anyway)$/ }).click()

  await expect(page.getByText('Posted! Looking good.')).toBeVisible()
  await expect(page.getByAltText("Sam Lee's outfit")).toBeVisible()
  await expect(page.getByText('Emerald slip dress')).toBeVisible()
})

test("other guests' posts and likes show up live", async ({ page, browser, event }) => {
  // Someone posts behind this page's back (straight to the database, no
  // ping), so it can only appear here once a live update arrives.
  await page.goto(`/event/${event.code}`)
  await expect(page.getByText('No outfits yet')).toBeVisible()

  const { data: postId, error } = await anonClient().rpc('insert_outfit_post', {
    p_code: event.code,
    p_display_name: 'Jordan',
    p_image_url: fakeImage(event.id, 'jordan'),
    p_caption: null,
    p_guest_token: newGuestToken(),
    p_colors: [],
  })
  expect(error).toBeNull()
  expect(postId).toBeTruthy()

  // A second guest, in their own browser, likes it from the event page,
  // which announces the change to everyone viewing.
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(`/event/${event.code}`)
  await otherPage.getByRole('button', { name: 'Like' }).click()
  await expect(otherPage.getByRole('button', { name: 'Unlike' })).toBeVisible()

  // The first page never reloaded, but now has the post and the like.
  await expect(page.getByText('Jordan', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Like' })).toContainText('1')
  await other.close()
})

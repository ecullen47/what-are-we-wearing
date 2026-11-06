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

test('tapping a photo in the Outfits feed opens it full size', async ({ page, event }) => {
  const guest = anonClient()
  const { error: postError } = await guest.rpc('insert_outfit_post', {
    p_code: event.code,
    p_display_name: 'Sam',
    p_image_url: fakeImage(event.id, 'outfit'),
    p_caption: 'Emerald slip dress',
    p_guest_token: newGuestToken(),
    p_colors: [],
  })
  expect(postError).toBeNull()
  const { error: pollError } = await guest.rpc('create_outfit_poll', {
    p_code: event.code,
    p_display_name: 'Priya',
    p_guest_token: newGuestToken(),
    p_image_urls: [fakeImage(event.id, 'a'), fakeImage(event.id, 'b')],
    p_caption: 'Which one?',
  })
  expect(pollError).toBeNull()

  await page.goto(`/event/${event.code}`)
  await expect(page.getByRole('tab', { name: 'Outfits' })).toBeVisible()
  const viewer = page.getByRole('dialog', { name: 'Photo viewer' })

  await page.getByRole('button', { name: "View Sam's outfit full size" }).click()
  await expect(viewer.getByText('Emerald slip dress')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer).toHaveCount(0)

  // Poll options open too, without casting a vote.
  await page.getByRole('button', { name: "View Priya's option 2 full size" }).click()
  await expect(viewer.getByText('Option 2 of 2')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Vote', exact: true })).toHaveCount(2)
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

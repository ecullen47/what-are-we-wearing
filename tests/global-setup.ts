import { sweepStaleTestEvents } from './helpers'

export default async function setup() {
  await sweepStaleTestEvents()
}

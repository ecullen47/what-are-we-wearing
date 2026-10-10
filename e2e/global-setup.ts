import { sweepStaleTestEvents } from '../tests/helpers'

export default async function setup() {
  await sweepStaleTestEvents()
}

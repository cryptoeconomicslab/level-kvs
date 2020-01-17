import memdown from 'memdown'
import { LevelKeyValueStore } from './LevelKeyValueStore'
import { Bytes } from '@cryptoeconomicslab/primitives'

export class InMemoryKeyValueStore extends LevelKeyValueStore {
  constructor(prefix: Bytes) {
    super(prefix, memdown())
  }
}

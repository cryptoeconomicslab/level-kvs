import {
  RangeDb,
  KeyValueStore,
  RangeRecord,
  RangeStore
} from '@cryptoeconomicslab/db'
import { Bytes } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '../src'

describe('RangeDb for InMemoryKVS', () => {
  let kvs: KeyValueStore
  let rangeDb: RangeDb
  const testDbName = Bytes.fromString('root')
  const alice = Bytes.fromString('alice')
  const bob = Bytes.fromString('bob')
  const carol = Bytes.fromString('carol')
  beforeEach(async () => {
    kvs = new InMemoryKeyValueStore(testDbName)
    await kvs.open()
    rangeDb = new RangeDb(kvs)
  })
  afterEach(async () => {
    await kvs.close()
  })

  describe('createKey', () => {
    it('return key', async () => {
      expect(RangeDb.createKey(BigInt(0x1234))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000001234'
        )
      )
      expect(RangeDb.createKey(BigInt(0x1200))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000001200'
        )
      )
      expect(RangeDb.createKey(BigInt(0x120))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000000120'
        )
      )
    })
  })

  describe.each([BigInt(0), BigInt(2) ** BigInt(100)])(
    'baseStart: %p',
    baseStart => {
      function testPut(store: RangeStore, s: bigint, e: bigint, value: Bytes) {
        return store.put(baseStart + s, baseStart + e, value)
      }
      function testGet(store: RangeStore, s: bigint, e: bigint) {
        return store.get(baseStart + s, baseStart + e)
      }
      function testDel(store: RangeStore, s: bigint, e: bigint) {
        return store.del(baseStart + s, baseStart + e)
      }
      function testRangeRecord(s: bigint, e: bigint, value: Bytes) {
        return new RangeRecord(baseStart + s, baseStart + e, value)
      }

      describe('bucket', () => {
        let bucketA: RangeStore
        let bucketB: RangeStore
        beforeEach(async () => {
          bucketA = await rangeDb.bucket(Bytes.fromString('a'))
          bucketB = await rangeDb.bucket(Bytes.fromString('b'))
        })
        it('buckets are independent', async () => {
          await testPut(rangeDb, BigInt(0), BigInt(100), alice)
          await testPut(bucketA, BigInt(100), BigInt(200), bob)
          await testPut(bucketB, BigInt(200), BigInt(300), carol)
          const rangesA = await testGet(bucketA, BigInt(0), BigInt(300))
          const rangesB = await testGet(bucketB, BigInt(0), BigInt(300))
          // TODO: fix spec
          // expect(ranges).toEqual([testRangeRecord(BigInt(0), BigInt(100), alice)])
          // or
          // expect(ranges).toEqual([
          //   testRangeRecord(BigInt(0), BigInt(100), alice),
          //   testRangeRecord(BigInt(100), BigInt(200), bob),
          //   testRangeRecord(BigInt(200), BigInt(300), carol)
          // ])
          expect(rangesA).toEqual([
            testRangeRecord(BigInt(100), BigInt(200), bob)
          ])
          expect(rangesB).toEqual([
            testRangeRecord(BigInt(200), BigInt(300), carol)
          ])
        })
      })

      describe.each(['rangedb', 'bucket'])('RangeStoreType: %p', testDbType => {
        let rangeStore: RangeStore

        beforeEach(async () => {
          rangeStore = rangeDb
          if (testDbType == 'bucket') {
            rangeStore = await rangeStore.bucket(
              Bytes.fromString('test_bucket')
            )
          }
        })

        describe('get', () => {
          it('get a range', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(500), alice)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(1000))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(500), alice)
            ])
          })
          it('get ranges', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(100), alice)
            await testPut(rangeStore, BigInt(100), BigInt(200), bob)
            await testPut(rangeStore, BigInt(200), BigInt(300), carol)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(300))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(100), alice),
              testRangeRecord(BigInt(100), BigInt(200), bob),
              testRangeRecord(BigInt(200), BigInt(300), carol)
            ])
          })
          it('get mid range', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(100), alice)
            await testPut(rangeStore, BigInt(100), BigInt(200), bob)
            await testPut(rangeStore, BigInt(200), BigInt(300), carol)
            const ranges = await testGet(rangeStore, BigInt(100), BigInt(150))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(100), BigInt(200), bob)
            ])
          })
          it('get small range', async () => {
            await testPut(rangeStore, BigInt(120), BigInt(150), alice)
            await testPut(rangeStore, BigInt(0), BigInt(20), bob)
            await testPut(rangeStore, BigInt(500), BigInt(600), carol)
            const ranges = await testGet(rangeStore, BigInt(100), BigInt(200))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(120), BigInt(150), alice)
            ])
          })
          it('get large range', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(500), alice)
            const ranges = await testGet(rangeStore, BigInt(100), BigInt(200))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(500), alice)
            ])
          })
          it('get no ranges', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(500), alice)
            const ranges = await testGet(rangeStore, BigInt(1000), BigInt(2000))
            expect(ranges).toEqual([])
          })
          it('get no ranges edge case, later query', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(500), alice)
            const ranges = await testGet(rangeStore, BigInt(500), BigInt(1000))
            expect(ranges).toEqual([])
          })
          it('get no ranges edge case, fomer query', async () => {
            await testPut(rangeStore, BigInt(500), BigInt(1000), alice)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(500))
            expect(ranges).toEqual([])
          })

          it('get ranges correctly', async () => {
            await rangeStore.put(BigInt(0x100), BigInt(0x120), alice)
            await rangeStore.put(BigInt(0x120), BigInt(0x200), bob)
            await rangeStore.put(BigInt(0x1000), BigInt(0x1200), carol)
            const ranges = await rangeStore.get(BigInt(0), BigInt(0x2000))
            expect(ranges).toEqual([
              new RangeRecord(BigInt(0x100), BigInt(0x120), alice),
              new RangeRecord(BigInt(0x120), BigInt(0x200), bob),
              new RangeRecord(BigInt(0x1000), BigInt(0x1200), carol)
            ])
          })
        })

        describe('put', () => {
          beforeEach(async () => {
            await testPut(rangeStore, BigInt(0), BigInt(1000), alice)
            await testPut(rangeStore, BigInt(1000), BigInt(2000), bob)
          })
          it('put to former', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(500), carol)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(2000))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(500), carol),
              testRangeRecord(BigInt(500), BigInt(1000), alice),
              testRangeRecord(BigInt(1000), BigInt(2000), bob)
            ])
          })
          it('put to middle', async () => {
            await testPut(rangeStore, BigInt(200), BigInt(500), carol)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(2000))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(200), alice),
              testRangeRecord(BigInt(200), BigInt(500), carol),
              testRangeRecord(BigInt(500), BigInt(1000), alice),
              testRangeRecord(BigInt(1000), BigInt(2000), bob)
            ])
          })
          it('put to later', async () => {
            await testPut(rangeStore, BigInt(500), BigInt(1000), carol)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(2000))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(500), alice),
              testRangeRecord(BigInt(500), BigInt(1000), carol),
              testRangeRecord(BigInt(1000), BigInt(2000), bob)
            ])
          })
          it('put across', async () => {
            await testPut(rangeStore, BigInt(500), BigInt(1500), carol)
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(2000))
            expect(ranges).toEqual([
              testRangeRecord(BigInt(0), BigInt(500), alice),
              testRangeRecord(BigInt(500), BigInt(1500), carol),
              testRangeRecord(BigInt(1500), BigInt(2000), bob)
            ])
          })
        })

        describe('del', () => {
          it('del ranges', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(100), alice)
            await testPut(rangeStore, BigInt(100), BigInt(200), bob)
            await testPut(rangeStore, BigInt(200), BigInt(300), carol)
            await testDel(rangeStore, BigInt(0), BigInt(300))
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(300))
            expect(ranges).toEqual([])
          })

          it('del middle range', async () => {
            await testPut(rangeStore, BigInt(0), BigInt(100), alice)
            await testDel(rangeStore, BigInt(10), BigInt(20))
            const ranges = await testGet(rangeStore, BigInt(0), BigInt(100))
            // del method is not used in public, no correct spec exists.
            expect(ranges).toEqual([])
          })
        })
      })
    }
  )
})

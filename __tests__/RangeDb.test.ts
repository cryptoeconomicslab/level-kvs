import {
  RangeDb,
  KeyValueStore,
  RangeRecord,
  RangeStore
} from '@cryptoeconomicslab/db'
import { Bytes } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '../src'
import JSBI from 'jsbi'

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
      expect(RangeDb.createKey(JSBI.BigInt(0x1234))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000001234'
        )
      )
      expect(RangeDb.createKey(JSBI.BigInt(0x1200))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000001200'
        )
      )
      expect(RangeDb.createKey(JSBI.BigInt(0x120))).toEqual(
        Bytes.fromHexString(
          '0x0000000000000000000000000000000000000000000000000000000000000120'
        )
      )
    })
  })

  describe.each([
    [JSBI.BigInt(0)],
    [JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(100))]
  ])('baseStart: %p', (baseStart: JSBI) => {
    function testPut(store: RangeStore, s: JSBI, e: JSBI, value: Bytes) {
      return store.put(JSBI.add(baseStart, s), JSBI.add(baseStart, e), value)
    }
    function testGet(store: RangeStore, s: JSBI, e: JSBI) {
      return store.get(JSBI.add(baseStart, s), JSBI.add(baseStart, e))
    }
    function testDel(store: RangeStore, s: JSBI, e: JSBI) {
      return store.del(JSBI.add(baseStart, s), JSBI.add(baseStart, e))
    }
    function testRangeRecord(s: JSBI, e: JSBI, value: Bytes) {
      return new RangeRecord(
        JSBI.add(baseStart, s),
        JSBI.add(baseStart, e),
        value
      )
    }

    describe('bucket', () => {
      let bucketA: RangeStore
      let bucketB: RangeStore
      beforeEach(async () => {
        bucketA = await rangeDb.bucket(Bytes.fromString('a'))
        bucketB = await rangeDb.bucket(Bytes.fromString('b'))
      })
      it('buckets are independent', async () => {
        await testPut(rangeDb, JSBI.BigInt(0), JSBI.BigInt(100), alice)
        await testPut(bucketA, JSBI.BigInt(100), JSBI.BigInt(200), bob)
        await testPut(bucketB, JSBI.BigInt(200), JSBI.BigInt(300), carol)
        const rangesA = await testGet(bucketA, JSBI.BigInt(0), JSBI.BigInt(300))
        const rangesB = await testGet(bucketB, JSBI.BigInt(0), JSBI.BigInt(300))
        // TODO: fix spec
        // expect(ranges).toEqual([testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(100), alice)])
        // or
        // expect(ranges).toEqual([
        //   testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(100), alice),
        //   testRangeRecord(JSBI.BigInt(100), JSBI.BigInt(200), bob),
        //   testRangeRecord(JSBI.BigInt(200), JSBI.BigInt(300), carol)
        // ])
        expect(rangesA).toEqual([
          testRangeRecord(JSBI.BigInt(100), JSBI.BigInt(200), bob)
        ])
        expect(rangesB).toEqual([
          testRangeRecord(JSBI.BigInt(200), JSBI.BigInt(300), carol)
        ])
      })
    })

    describe.each(['rangedb', 'bucket'])('RangeStoreType: %p', testDbType => {
      let rangeStore: RangeStore

      beforeEach(async () => {
        rangeStore = rangeDb
        if (testDbType == 'bucket') {
          rangeStore = await rangeStore.bucket(Bytes.fromString('test_bucket'))
        }
      })

      describe('get', () => {
        it('get a range', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(500), alice)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(1000)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(500), alice)
          ])
        })
        it('get ranges', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(100), alice)
          await testPut(rangeStore, JSBI.BigInt(100), JSBI.BigInt(200), bob)
          await testPut(rangeStore, JSBI.BigInt(200), JSBI.BigInt(300), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(300)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(100), alice),
            testRangeRecord(JSBI.BigInt(100), JSBI.BigInt(200), bob),
            testRangeRecord(JSBI.BigInt(200), JSBI.BigInt(300), carol)
          ])
        })
        it('get mid range', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(100), alice)
          await testPut(rangeStore, JSBI.BigInt(100), JSBI.BigInt(200), bob)
          await testPut(rangeStore, JSBI.BigInt(200), JSBI.BigInt(300), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(100),
            JSBI.BigInt(150)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(100), JSBI.BigInt(200), bob)
          ])
        })
        it('get small range', async () => {
          await testPut(rangeStore, JSBI.BigInt(120), JSBI.BigInt(150), alice)
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(20), bob)
          await testPut(rangeStore, JSBI.BigInt(500), JSBI.BigInt(600), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(100),
            JSBI.BigInt(200)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(120), JSBI.BigInt(150), alice)
          ])
        })
        it('get large range', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(500), alice)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(100),
            JSBI.BigInt(200)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(500), alice)
          ])
        })
        it('get no ranges', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(500), alice)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(1000),
            JSBI.BigInt(2000)
          )
          expect(ranges).toEqual([])
        })
        it('get no ranges edge case, later query', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(500), alice)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(500),
            JSBI.BigInt(1000)
          )
          expect(ranges).toEqual([])
        })
        it('get no ranges edge case, fomer query', async () => {
          await testPut(rangeStore, JSBI.BigInt(500), JSBI.BigInt(1000), alice)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(500)
          )
          expect(ranges).toEqual([])
        })

        it('get ranges correctly', async () => {
          await rangeStore.put(JSBI.BigInt(0x100), JSBI.BigInt(0x120), alice)
          await rangeStore.put(JSBI.BigInt(0x120), JSBI.BigInt(0x200), bob)
          await rangeStore.put(JSBI.BigInt(0x1000), JSBI.BigInt(0x1200), carol)
          const ranges = await rangeStore.get(
            JSBI.BigInt(0),
            JSBI.BigInt(0x2000)
          )
          expect(ranges).toEqual([
            new RangeRecord(JSBI.BigInt(0x100), JSBI.BigInt(0x120), alice),
            new RangeRecord(JSBI.BigInt(0x120), JSBI.BigInt(0x200), bob),
            new RangeRecord(JSBI.BigInt(0x1000), JSBI.BigInt(0x1200), carol)
          ])
        })
      })

      describe('put', () => {
        beforeEach(async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(1000), alice)
          await testPut(rangeStore, JSBI.BigInt(1000), JSBI.BigInt(2000), bob)
        })
        it('put to former', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(500), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(2000)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(500), carol),
            testRangeRecord(JSBI.BigInt(500), JSBI.BigInt(1000), alice),
            testRangeRecord(JSBI.BigInt(1000), JSBI.BigInt(2000), bob)
          ])
        })
        it('put to middle', async () => {
          await testPut(rangeStore, JSBI.BigInt(200), JSBI.BigInt(500), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(2000)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(200), alice),
            testRangeRecord(JSBI.BigInt(200), JSBI.BigInt(500), carol),
            testRangeRecord(JSBI.BigInt(500), JSBI.BigInt(1000), alice),
            testRangeRecord(JSBI.BigInt(1000), JSBI.BigInt(2000), bob)
          ])
        })
        it('put to later', async () => {
          await testPut(rangeStore, JSBI.BigInt(500), JSBI.BigInt(1000), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(2000)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(500), alice),
            testRangeRecord(JSBI.BigInt(500), JSBI.BigInt(1000), carol),
            testRangeRecord(JSBI.BigInt(1000), JSBI.BigInt(2000), bob)
          ])
        })
        it('put across', async () => {
          await testPut(rangeStore, JSBI.BigInt(500), JSBI.BigInt(1500), carol)
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(2000)
          )
          expect(ranges).toEqual([
            testRangeRecord(JSBI.BigInt(0), JSBI.BigInt(500), alice),
            testRangeRecord(JSBI.BigInt(500), JSBI.BigInt(1500), carol),
            testRangeRecord(JSBI.BigInt(1500), JSBI.BigInt(2000), bob)
          ])
        })
      })

      describe('del', () => {
        it('del ranges', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(100), alice)
          await testPut(rangeStore, JSBI.BigInt(100), JSBI.BigInt(200), bob)
          await testPut(rangeStore, JSBI.BigInt(200), JSBI.BigInt(300), carol)
          await testDel(rangeStore, JSBI.BigInt(0), JSBI.BigInt(300))
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(300)
          )
          expect(ranges).toEqual([])
        })

        it('del middle range', async () => {
          await testPut(rangeStore, JSBI.BigInt(0), JSBI.BigInt(100), alice)
          await testDel(rangeStore, JSBI.BigInt(10), JSBI.BigInt(20))
          const ranges = await testGet(
            rangeStore,
            JSBI.BigInt(0),
            JSBI.BigInt(100)
          )
          // del method is not used in public, no correct spec exists.
          expect(ranges).toEqual([])
        })
      })
    })
  })
})

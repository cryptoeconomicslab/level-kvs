import { KeyValueStore, BatchOperation } from '@cryptoeconomicslab/db'
import { Bytes } from '@cryptoeconomicslab/primitives'
import { InMemoryKeyValueStore } from '../src'

const testDbName = Bytes.fromString('root')
const testDbKey = Bytes.fromString('aaa')
const testDbValue = Bytes.fromString('value')

describe('InMemoryKeyValueStore', () => {
  describe('get', () => {
    let kvs: InMemoryKeyValueStore
    beforeEach(async () => {
      kvs = new InMemoryKeyValueStore(testDbName)
      await kvs.open()
    })

    afterEach(async () => {
      await kvs.close()
    })

    it('succeed to get', async () => {
      await kvs.put(testDbKey, testDbValue)
      const result = await kvs.get(testDbKey)
      expect(result).toEqual(testDbValue)
    })

    it('fail to get', async () => {
      const result = await kvs.get(testDbKey)
      expect(result).toBeNull()
    })
  })

  describe('del', () => {
    let kvs: InMemoryKeyValueStore
    beforeEach(async () => {
      kvs = new InMemoryKeyValueStore(testDbName)
      await kvs.open()
    })

    afterEach(async () => {
      await kvs.close()
    })

    it('succeed to del', async () => {
      await kvs.put(testDbKey, testDbValue)
      expect(await kvs.get(testDbKey)).toEqual(testDbValue)
      await kvs.del(testDbKey)
      const result = await kvs.get(testDbKey)
      expect(result).toBeNull()
    })

    it('delete key which does not exist', async () => {
      expect(await kvs.get(testDbKey)).toBeNull()
      await kvs.del(testDbKey)
    })
  })

  describe('iter', () => {
    const testDbKey0 = Bytes.fromString('0')
    const testDbKey1 = Bytes.fromString('1')
    const testDbKey2 = Bytes.fromString('2')
    let kvs: InMemoryKeyValueStore
    beforeEach(async () => {
      kvs = new InMemoryKeyValueStore(testDbName)
      await kvs.open()
      await kvs.put(testDbKey0, testDbKey0)
      await kvs.put(testDbKey1, testDbKey1)
      await kvs.put(testDbKey2, testDbKey2)
    })

    afterEach(async () => {
      await kvs.close()
    })

    it('succeed to next', async () => {
      await kvs.put(testDbKey, testDbValue)
      const iter = kvs.iter(testDbKey)
      const result = await iter.next()
      expect(result).not.toBeNull()
    })

    it('end of iterator', async () => {
      const iter = kvs.iter(testDbKey)
      const result = await iter.next()
      expect(result).toBeNull()
    })

    it('get ordered keys', async () => {
      const iter = kvs.iter(testDbKey0)
      const result0 = await iter.next()
      const result1 = await iter.next()
      expect(result0).not.toBeNull()
      expect(result1).not.toBeNull()
      if (result0 !== null && result1 !== null) {
        expect(result0.key).toEqual(testDbKey0)
        expect(result0.value).toEqual(testDbKey0)
        expect(result1.key).toEqual(testDbKey1)
        expect(result1.value).toEqual(testDbKey1)
      }
    })
  })

  describe('bucket', () => {
    const testEmptyBucketName = Bytes.fromString('bucket1')
    const testNotEmptyBucketName = Bytes.fromString('bucket2')
    const testDbKey0 = Bytes.fromString('0')
    const testDbKey1 = Bytes.fromString('1')
    let kvs: InMemoryKeyValueStore
    let testNotEmptyBucket: KeyValueStore

    beforeEach(async () => {
      kvs = new InMemoryKeyValueStore(testDbName)
      await kvs.open()
      testNotEmptyBucket = await kvs.bucket(testNotEmptyBucketName)
      await testNotEmptyBucket.put(testDbKey0, testDbKey0)
      await testNotEmptyBucket.put(testDbKey1, testDbKey1)
    })

    afterEach(async () => {
      await kvs.close()
      await testNotEmptyBucket.close()
    })

    it('succeed to get bucket', async () => {
      const bucket = await kvs.bucket(testEmptyBucketName)
      await bucket.put(testDbKey, testDbValue)
      const value = await bucket.get(testDbKey)
      expect(value).toEqual(testDbValue)
    })

    it('succeed to get bucket with same key', async () => {
      const bucket = await kvs.bucket(testEmptyBucketName)
      await bucket.put(testDbKey, testDbValue)
      const bucket2 = await kvs.bucket(testEmptyBucketName)
      const value = await bucket2.get(testDbKey)
      expect(value).toEqual(testDbValue)
    })

    it('succeed to get values from iterator of bucket', async () => {
      const iter = testNotEmptyBucket.iter(testDbKey0)
      const result0 = await iter.next()
      const result1 = await iter.next()
      expect(result0).not.toBeNull()
      expect(result1).not.toBeNull()
      if (result0 !== null && result1 !== null) {
        expect(result0.key).toEqual(testDbKey0)
        expect(result0.value).toEqual(testDbKey0)
        expect(result1.key).toEqual(testDbKey1)
        expect(result1.value).toEqual(testDbKey1)
      }
    })

    it('next returns null for new bucket', async () => {
      const bucket = await kvs.bucket(testEmptyBucketName)
      const iter = bucket.iter(testDbKey0)
      const result = await iter.next()
      expect(result).toBeNull()
    })
  })

  describe('batch', () => {
    const testDbKey0 = Bytes.fromString('0')
    const testDbKey1 = Bytes.fromString('1')
    let kvs: InMemoryKeyValueStore

    beforeEach(async () => {
      kvs = new InMemoryKeyValueStore(testDbName)
      await kvs.open()
    })

    afterEach(async () => {
      await kvs.close()
    })

    test('batch put', async () => {
      const operations: BatchOperation[] = [
        { type: 'Put', key: testDbKey0, value: testDbKey0 },
        { type: 'Put', key: testDbKey1, value: testDbKey1 }
      ]

      await kvs.batch(operations)
      let result = await kvs.get(testDbKey0)
      expect(result).toEqual(testDbKey0)
      result = await kvs.get(testDbKey1)
      expect(result).toEqual(testDbKey1)
    })

    test('batch del', async () => {
      await kvs.put(testDbKey0, testDbKey0)
      const operations: BatchOperation[] = [
        { type: 'Del', key: testDbKey0 },
        { type: 'Put', key: testDbKey1, value: testDbKey1 }
      ]
      await kvs.batch(operations)

      let result = await kvs.get(testDbKey0)
      expect(result).toBeNull()
      result = await kvs.get(testDbKey1)
      expect(result).toEqual(testDbKey1)
    })
  })
})

import { Iterator, KeyValueStore, BatchOperation } from '@cryptoeconomicslab/db'
import { Bytes } from '@cryptoeconomicslab/primitives'
import levelup, { LevelUp } from 'levelup'
import { AbstractLevelDOWN, AbstractIterator } from 'abstract-leveldown'
import memdown from 'memdown'
import { promisify } from 'es6-promisify'

export class LevelKeyValueStoreIterator implements Iterator {
  public iter: AbstractIterator<Buffer, Buffer>
  private parentKvs: LevelKeyValueStore
  constructor(
    iter: AbstractIterator<Buffer, Buffer>,
    parentKvs: LevelKeyValueStore
  ) {
    this.iter = iter
    this.parentKvs = parentKvs
  }
  public next(): Promise<{ key: Bytes; value: Bytes } | null> {
    return new Promise((resolve, reject) => {
      this.iter.next((err, key, value) => {
        if (err) {
          reject(err)
        } else {
          const prefix = this.parentKvs.prefix
          if (key && Bytes.fromBuffer(key).startsWith(prefix)) {
            resolve({
              key: this.parentKvs.getKeyFromBuffer(key),
              value: LevelKeyValueStore.getValueFromBuffer(value)
            })
          } else {
            resolve(null)
          }
        }
      })
    })
  }
}

/**
 * LevelKeyValueStore
 * prefix is used to represent separated bucket. bucket name must be suffixed
 * with dot in inner representation so as not to continue iterating on next bucket.
 */
export class LevelKeyValueStore implements KeyValueStore {
  /*
   * `dbName` is optional to distinguish root kvs which has db connection and bucket.
   * root kvs has dbName but bucket doesn't have.
   */
  public dbName?: Bytes
  public prefix: Bytes = Bytes.default()
  public db: LevelUp
  private _put: (key: Buffer, value: Buffer) => Promise<void>
  private _del: (key: Buffer) => Promise<void>

  constructor(
    prefix: Bytes,
    public readonly leveldown: AbstractLevelDOWN = memdown(),
    db?: LevelUp
  ) {
    this.prefix = prefix.suffix('.')
    if (db) {
      this.db = db
    } else {
      this.dbName = prefix.suffix('.')
      this.db = levelup(leveldown)
    }
    this._put = promisify(this.db.put.bind(this.db))
    this._del = promisify(this.db.del.bind(this.db))
  }

  public async get(key: Bytes): Promise<Bytes | null> {
    return new Promise(resolve => {
      this.db.get(this.convertKeyIntoBuffer(key), (err, value) => {
        if (err) {
          return resolve(null)
        } else {
          return resolve(LevelKeyValueStore.getValueFromBuffer(value))
        }
      })
    })
  }

  public async put(key: Bytes, value: Bytes): Promise<void> {
    await this._put(
      this.convertKeyIntoBuffer(key),
      LevelKeyValueStore.convertValueIntoBuffer(value)
    )
  }

  public async del(key: Bytes): Promise<void> {
    await this._del(this.convertKeyIntoBuffer(key))
  }

  public async batch(operations: BatchOperation[]): Promise<void> {
    return new Promise(resolve => {
      let batch = this.db.batch()
      operations.forEach(op => {
        if (op.type === 'Put') {
          batch = batch.put(
            this.convertKeyIntoBuffer(op.key),
            LevelKeyValueStore.convertValueIntoBuffer(op.value)
          )
        } else if (op.type === 'Del') {
          batch = batch.del(this.convertKeyIntoBuffer(op.key))
        }
      })
      batch.write(() => {
        resolve()
      })
    })
  }

  /**
   * `iter` returns `LevelKeyValueStoreIterator` which is for getting values sorted by their keys.
   * @param bound We can get values greater than `bound` in dictionary order.
   * Please see the document for AbstractIterator's options. https://github.com/snowyu/abstract-iterator#abstractiterator----
   */
  public iter(
    bound: Bytes,
    lowerBoundExclusive?: boolean
  ): LevelKeyValueStoreIterator {
    const option: any = {
      gte: this.convertKeyIntoBuffer(bound),
      lt: Buffer.from(this.prefix.increment().data),
      reverse: false,
      keys: true,
      values: true,
      keyAsBuffer: true,
      valueAsBuffer: true
    }
    if (lowerBoundExclusive) {
      option.gt = option.gte
      delete option.gte
    }

    return new LevelKeyValueStoreIterator(this.db.iterator(option), this)
  }

  public bucket(key: Bytes): Promise<KeyValueStore> {
    return Promise.resolve(
      new LevelKeyValueStore(
        this.concatKeyWithPrefix(key),
        this.leveldown,
        this.db
      )
    )
  }

  protected concatKeyWithPrefix(key: Bytes): Bytes {
    return Bytes.concat(this.prefix, key)
  }

  private convertKeyIntoBuffer(key: Bytes): Buffer {
    return Buffer.from(this.concatKeyWithPrefix(key).data)
  }

  private static convertValueIntoBuffer(value: Bytes): Buffer {
    return Buffer.from(value.data)
  }

  /**
   * Converts key to Bytes and remove current prefix from key to get correct key inside bucket.
   * @param key
   */
  public getKeyFromBuffer(key: Buffer): Bytes {
    return this.removePrefix(Bytes.from(Uint8Array.from(key)))
  }

  public static getValueFromBuffer(value: Buffer): Bytes {
    return Bytes.from(Uint8Array.from(value))
  }

  private removePrefix(key: Bytes): Bytes {
    return Bytes.from(key.data.slice(this.prefix.data.length))
  }

  public async close(): Promise<void> {
    await this.db.close()
  }

  public async open(): Promise<void> {
    await this.db.open()
  }
}

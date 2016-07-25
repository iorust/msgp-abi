'use strict'

const ffi = require('ffi')
const ref = require('ref')
const tman = require('tman')
const struct = require('ref-struct')
const EventEmitter = require('events')
const Buf = struct({
  ptr: 'pointer',
  len: ref.types.size_t
})

const lib = ffi.Library('../../target/release/libmsgp_abi.dylib', {
  encode: [Buf, [Buf]],
  decode: [Buf, [Buf]],
  create_decoder: ['pointer', []],
  feed_decoder: ['size_t', ['pointer', Buf]],
  read_decoder: [Buf, ['pointer']],
  get_decoder_buffer_len: ['size_t', ['pointer']],
  get_decoder_result_len: ['size_t', ['pointer']],
  drop_decoder: ['void', ['pointer']]
})

Buf.prototype.toBuffer = function () {
  return this.len ? ref.reinterpret(this.ptr, this.len, 0) : null
}

Buf.prototype.toString = function () {
  return this.toBuffer().toString()
}

class Msgp extends EventEmitter {
  constructor () {
    super()
    // legacy from old stream.
    this.writable = true
    this.ptr = lib.create_decoder()
  }

  static encode (buffer) {
    let res = lib.encode(new Buf({ptr: buffer, len: buffer.length}))
    return res.toBuffer()
  }

  static decode (buffer) {
    let res = lib.decode(new Buf({ptr: buffer, len: buffer.length}))
    return res.toBuffer()
  }

  write (buffer) {
    let res = lib.feed_decoder(this.ptr, new Buf({ptr: buffer, len: buffer.length}))
    while (res--) {
      res = lib.read_decoder(this.ptr)
      if (res.len) this.emit('data', res.toBuffer())
      else this.emit('null')
    }
  }

  end (buffer) {
    if (buffer) this.write(buffer)

    lib.drop_decoder(this.ptr)
    this.writable = false
    this.ptr = null
    this.emit('finish')
  }
}

module.exports = Msgp

tman(function () {
  const assert = require('assert')

  tman.it('encode', function () {
    let buf = Msgp.encode(new Buffer([0x1, 0x2, 0x3, 0x4, 0x5]))
    console.log('Encode:', buf)
    assert.ok(buf.equals(new Buffer([0x5, 0x1, 0x2, 0x3, 0x4, 0x5])))
  })

  tman.it('decode', function () {
    let buf = Msgp.decode(new Buffer([0x5, 0x1, 0x2, 0x3, 0x4, 0x5]))
    console.log('Decode:', buf)
    assert.ok(buf.equals(new Buffer([0x1, 0x2, 0x3, 0x4, 0x5])))

    assert.ok(Msgp.decode(new Buffer([])) === null)
    assert.ok(Msgp.decode(new Buffer([0x81, 0x80])) === null)
    assert.ok(Msgp.decode(new Buffer([0x5, 0x2, 0x3, 0x4])) === null)
  })

  tman.it('Class Msgp', function () {
    let res = []
    let msgp = new Msgp()
    msgp.on('data', (buf) => res.push(buf))
    msgp.write(new Buffer([0x5, 0x1, 0x2, 0x3, 0x4, 0x5]))
    msgp.write(new Buffer([0x5, 0x1, 0x2, 0x3]))
    msgp.write(new Buffer([0x4, 0x5]))
    msgp.end()
    assert.ok(res[0].equals(new Buffer([0x1, 0x2, 0x3, 0x4, 0x5])))
    assert.ok(res[1].equals(new Buffer([0x1, 0x2, 0x3, 0x4, 0x5])))
  })
})

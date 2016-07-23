'use strict'

const ffi = require('ffi')
const ref = require('ref')
const struct = require('ref-struct')
const EventEmitter = require('events')
const U8Array = require('ref-array')(ref.types.uint8)
const Buf = struct({
  ptr: U8Array,
  len: ref.types.size_t
})

const lib = ffi.Library('../target/release/libmsgp_abi.dylib', {
  encode: [Buf, [Buf]],
  decode: [Buf, [Buf]],
  create_decoder: ['pointer', []],
  feed_decoder: ['size_t', ['pointer', Buf]],
  read_decoder: [Buf, ['pointer']],
  get_decoder_buffer_len: ['size_t', ['pointer']],
  get_decoder_result_len: ['size_t', ['pointer']],
  drop_decoder: ['void', ['pointer']]
})

class Msgp extends EventEmitter {
  constructor () {
    super()
    // legacy from old stream.
    this.writable = true
    this.ptr = lib.create_decoder()
  }

  static encode (buffer) {
    let arr = new U8Array(buffer)
    let res = lib.encode(new Buf({ptr: arr, len: buffer.length}))
    let buf = new Buffer(res.len)
    for (let i = 0; i < res.len; i++) buf[i] = res.ptr[i]
    console.log(100, buf.length, buf)
    return buf
  }

  static decode (buffer) {
    let arr = new U8Array(buffer)
    let res = lib.decode(new Buf({ptr: arr, len: buffer.length}))
    console.log(222, res)
    return res
  }

  write (buffer) {
    let arr = new U8Array(buffer)
    let res = lib.feed_decoder(this.ptr, new Buf({ptr: arr, len: buffer.length}))
    console.log(333, res)
    res = lib.read_decoder()
    console.log(444, res)
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

console.log('Result:', Msgp.encode(new Buffer([0x1, 0x2, 0x3, 0x4, 0x5])))

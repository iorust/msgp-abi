// #![warn(missing_docs)]
#![doc(html_logo_url = "https://avatars3.githubusercontent.com/u/15439811?v=3&s=200",
       html_favicon_url = "https://iorust.github.io/favicon.ico",
       html_root_url = "https://iorust.github.io",
       html_playground_url = "https://play.rust-lang.org",
       issue_tracker_base_url = "https://github.com/iorust/msgp-rust/issues")]

//! Byte message protocol for Rust.

extern crate libc;
extern crate msgp;

use std::slice;
use std::mem::{transmute, forget, drop};

use libc::{uint8_t, size_t};

// A struct that can be passed between C and Rust
#[repr(C)]
#[derive(Debug)]
pub struct Buf {
    ptr: *const uint8_t,
    len: size_t,
}

#[no_mangle]
pub extern fn encode(buf: Buf) -> Buf {
    let val: &[u8] = unsafe {
        assert!(!buf.ptr.is_null());
        slice::from_raw_parts(buf.ptr, buf.len as usize)
    };

    let res = msgp::encode(val);
    let ptr = res.as_ptr();
    let len = res.len();
    forget(res);

    Buf { ptr: ptr, len: len }
}

#[no_mangle]
pub extern fn decode(buf: Buf) -> Buf {
    let val: &[u8] = unsafe {
        assert!(!buf.ptr.is_null());
        slice::from_raw_parts(buf.ptr, buf.len as usize)
    };

    if let Some(res) = msgp::decode(val) {
        let ptr = res.as_ptr();
        let len = res.len();
        forget(res);

        return Buf { ptr: ptr, len: len };
    }

    Buf { ptr: [].as_ptr(), len: 0 }
}

#[no_mangle]
pub extern fn create_decoder() -> *mut msgp::Decoder {
    let decoder = unsafe { transmute(Box::new(msgp::Decoder::new())) };
    decoder
}

#[no_mangle]
pub extern fn feed_decoder(ptr: *mut msgp::Decoder, buf: Buf) -> size_t {
    let mut decoder = unsafe { &mut *ptr };
    let val: &[u8] = unsafe {
        assert!(!buf.ptr.is_null());
        slice::from_raw_parts(buf.ptr, buf.len as usize)
    };
    if let Ok(size) = decoder.feed(val) {
        return size;
    }
    0
}

#[no_mangle]
pub extern fn read_decoder(ptr: *mut msgp::Decoder) -> Buf {
    let mut decoder = unsafe { &mut *ptr };
    if let Some(res) = decoder.read() {
        let ptr = res.as_ptr();
        let len = res.len();
        forget(res);
        return Buf { ptr: ptr, len: len };
    }
    Buf { ptr: [].as_ptr(), len: 0 }
}

#[no_mangle]
pub extern fn get_decoder_buffer_len(ptr: *const msgp::Decoder) -> size_t {
    let decoder = unsafe { &*ptr };
    decoder.buffer_len()
}

#[no_mangle]
pub extern fn get_decoder_result_len(ptr: *const msgp::Decoder) -> size_t {
    let decoder = unsafe { &*ptr };
    decoder.result_len()
}

#[no_mangle]
pub extern fn drop_decoder(ptr: *mut msgp::Decoder) {
    drop(ptr);
    // let mut decoder: Box<msgp::Decoder> = unsafe { transmute(ptr) };
    // Drop
}

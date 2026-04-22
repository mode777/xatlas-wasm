# xatlas-wasm example

## Purpose
The xatlas example shall be ported to a javascript web-application.

## Steps
- Purpose of this example is the usage of lib/xatlas.mjs
- Example to port is located in thirdparty/xatlas/example/example_c99.c
- Don't port the c++ code to wasm or try to make a straight port, instead adopt the functionality for a browser app
- Create a custom loader for obj format instead of using objzero
- Also use the lib/xatlas.d.ts as reference

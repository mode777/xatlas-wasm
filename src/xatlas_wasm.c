#include <stdint.h>
#include <stddef.h>
#include "xatlas_c.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#else
#define EMSCRIPTEN_KEEPALIVE
#endif

/* ── Atlas accessors ─────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE uint32_t xatlasAtlas_getWidth(const xatlasAtlas *a) { return a->width; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasAtlas_getHeight(const xatlasAtlas *a) { return a->height; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasAtlas_getAtlasCount(const xatlasAtlas *a) { return a->atlasCount; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasAtlas_getChartCount(const xatlasAtlas *a) { return a->chartCount; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasAtlas_getMeshCount(const xatlasAtlas *a) { return a->meshCount; }
EMSCRIPTEN_KEEPALIVE float    xatlasAtlas_getTexelsPerUnit(const xatlasAtlas *a) { return a->texelsPerUnit; }

EMSCRIPTEN_KEEPALIVE float xatlasAtlas_getUtilization(const xatlasAtlas *a, uint32_t index) {
    return a->utilization[index];
}

EMSCRIPTEN_KEEPALIVE const xatlasMesh *xatlasAtlas_getMesh(const xatlasAtlas *a, uint32_t index) {
    return &a->meshes[index];
}

EMSCRIPTEN_KEEPALIVE const uint32_t *xatlasAtlas_getImage(const xatlasAtlas *a) {
    return a->image;
}

/* ── Mesh accessors ──────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE uint32_t xatlasMesh_getVertexCount(const xatlasMesh *m) { return m->vertexCount; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasMesh_getIndexCount(const xatlasMesh *m) { return m->indexCount; }
EMSCRIPTEN_KEEPALIVE uint32_t xatlasMesh_getChartCount(const xatlasMesh *m) { return m->chartCount; }

EMSCRIPTEN_KEEPALIVE const xatlasVertex *xatlasMesh_getVertexArray(const xatlasMesh *m) {
    return m->vertexArray;
}

EMSCRIPTEN_KEEPALIVE const uint32_t *xatlasMesh_getIndexArray(const xatlasMesh *m) {
    return m->indexArray;
}

EMSCRIPTEN_KEEPALIVE const xatlasChart *xatlasMesh_getChartArray(const xatlasMesh *m) {
    return m->chartArray;
}

/* ── Vertex accessors (index into vertex array) ──────────────────── */

EMSCRIPTEN_KEEPALIVE int32_t xatlasVertex_getAtlasIndex(const xatlasVertex *arr, uint32_t i) {
    return arr[i].atlasIndex;
}

EMSCRIPTEN_KEEPALIVE int32_t xatlasVertex_getChartIndex(const xatlasVertex *arr, uint32_t i) {
    return arr[i].chartIndex;
}

EMSCRIPTEN_KEEPALIVE float xatlasVertex_getUV0(const xatlasVertex *arr, uint32_t i) {
    return arr[i].uv[0];
}

EMSCRIPTEN_KEEPALIVE float xatlasVertex_getUV1(const xatlasVertex *arr, uint32_t i) {
    return arr[i].uv[1];
}

EMSCRIPTEN_KEEPALIVE uint32_t xatlasVertex_getXref(const xatlasVertex *arr, uint32_t i) {
    return arr[i].xref;
}

/* ── Chart accessors (index into chart array) ────────────────────── */

EMSCRIPTEN_KEEPALIVE uint32_t xatlasChart_getAtlasIndex(const xatlasChart *arr, uint32_t i) {
    return arr[i].atlasIndex;
}

EMSCRIPTEN_KEEPALIVE uint32_t xatlasChart_getFaceCount(const xatlasChart *arr, uint32_t i) {
    return arr[i].faceCount;
}

EMSCRIPTEN_KEEPALIVE int xatlasChart_getType(const xatlasChart *arr, uint32_t i) {
    return (int)arr[i].type;
}

EMSCRIPTEN_KEEPALIVE uint32_t xatlasChart_getMaterial(const xatlasChart *arr, uint32_t i) {
    return arr[i].material;
}

EMSCRIPTEN_KEEPALIVE const uint32_t *xatlasChart_getFaceArray(const xatlasChart *arr, uint32_t i) {
    return arr[i].faceArray;
}

/* ── Struct sizes (for heap allocation in JS) ────────────────────── */

EMSCRIPTEN_KEEPALIVE size_t xatlasMeshDecl_size(void) { return sizeof(xatlasMeshDecl); }
EMSCRIPTEN_KEEPALIVE size_t xatlasUvMeshDecl_size(void) { return sizeof(xatlasUvMeshDecl); }
EMSCRIPTEN_KEEPALIVE size_t xatlasChartOptions_size(void) { return sizeof(xatlasChartOptions); }
EMSCRIPTEN_KEEPALIVE size_t xatlasPackOptions_size(void) { return sizeof(xatlasPackOptions); }

cmake_minimum_required(VERSION 3.13)
project(xatlas-wasm C CXX)

set(CMAKE_CXX_STANDARD 11)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(XATLAS_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/thirdparty/xatlas/source/xatlas")

# xatlas library object
add_library(xatlas_obj OBJECT
    ${XATLAS_SOURCE_DIR}/xatlas.cpp
)
target_include_directories(xatlas_obj PRIVATE ${XATLAS_SOURCE_DIR})
target_compile_definitions(xatlas_obj PRIVATE
    XATLAS_C_API=1
    XA_MULTITHREADED=0
)
target_compile_options(xatlas_obj PRIVATE -O2 -flto)

# Accessor helpers
add_library(xatlas_wasm_obj OBJECT
    src/xatlas_wasm.c
)
target_include_directories(xatlas_wasm_obj PRIVATE ${XATLAS_SOURCE_DIR})

# Emscripten executable (produces .js + .wasm)
add_executable(xatlas
    $<TARGET_OBJECTS:xatlas_obj>
    $<TARGET_OBJECTS:xatlas_wasm_obj>
)

set(EXPORTED_FUNCTIONS
    _malloc
    _free
    # Core API
    _xatlasCreate
    _xatlasDestroy
    _xatlasAddMesh
    _xatlasAddMeshJoin
    _xatlasAddUvMesh
    _xatlasComputeCharts
    _xatlasPackCharts
    _xatlasGenerate
    _xatlasSetProgressCallback
    _xatlasSetAlloc
    _xatlasSetPrint
    _xatlasAddMeshErrorString
    _xatlasProgressCategoryString
    _xatlasMeshDeclInit
    _xatlasUvMeshDeclInit
    _xatlasChartOptionsInit
    _xatlasPackOptionsInit
    # Atlas accessors
    _xatlasAtlas_getWidth
    _xatlasAtlas_getHeight
    _xatlasAtlas_getAtlasCount
    _xatlasAtlas_getChartCount
    _xatlasAtlas_getMeshCount
    _xatlasAtlas_getTexelsPerUnit
    _xatlasAtlas_getUtilization
    _xatlasAtlas_getMesh
    _xatlasAtlas_getImage
    # Mesh accessors
    _xatlasMesh_getVertexCount
    _xatlasMesh_getIndexCount
    _xatlasMesh_getChartCount
    _xatlasMesh_getVertexArray
    _xatlasMesh_getIndexArray
    _xatlasMesh_getChartArray
    # Vertex accessors
    _xatlasVertex_getAtlasIndex
    _xatlasVertex_getChartIndex
    _xatlasVertex_getUV0
    _xatlasVertex_getUV1
    _xatlasVertex_getXref
    # Chart accessors
    _xatlasChart_getAtlasIndex
    _xatlasChart_getFaceCount
    _xatlasChart_getType
    _xatlasChart_getMaterial
    _xatlasChart_getFaceArray
    # Struct sizes
    _xatlasMeshDecl_size
    _xatlasUvMeshDecl_size
    _xatlasChartOptions_size
    _xatlasPackOptions_size
)

list(JOIN EXPORTED_FUNCTIONS "," EXPORTED_FUNCTIONS_STR)

set(EXPORTED_RUNTIME_METHODS
    ccall
    cwrap
    getValue
    setValue
    addFunction
    removeFunction
    UTF8ToString
    HEAPU8
    HEAPU16
    HEAPU32
    HEAPF32
    HEAP32
)

list(JOIN EXPORTED_RUNTIME_METHODS "," EXPORTED_RUNTIME_METHODS_STR)

set_target_properties(xatlas PROPERTIES
    OUTPUT_NAME "xatlas"
    SUFFIX ".mjs"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/dist"
)

target_link_options(xatlas PRIVATE
    -O2
    -flto
    "SHELL:-s MODULARIZE=1"
    "SHELL:-s EXPORT_ES6=1"
    "SHELL:-s EXPORT_NAME=createXAtlasModule"
    "SHELL:-s EXPORTED_FUNCTIONS=[${EXPORTED_FUNCTIONS_STR}]"
    "SHELL:-s EXPORTED_RUNTIME_METHODS=[${EXPORTED_RUNTIME_METHODS_STR}]"
    "SHELL:-s ALLOW_MEMORY_GROWTH=1"
    "SHELL:-s ALLOW_TABLE_GROWTH=1"
    "SHELL:-s NO_EXIT_RUNTIME=1"
    "SHELL:-s ENVIRONMENT=web,node"
    "SHELL:-s SINGLE_FILE=0"
)

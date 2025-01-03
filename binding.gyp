{
  "targets": [
    {
      "target_name": "video_reader",
      "sources": [
        "video_reader.cpp",
        "video_reader.h",
        "ffmpeglibs/lib/libavcodec.a",
        "ffmpeglibs/lib/libavdevice.a",
        "ffmpeglibs/lib/libavfilter.a",
        "ffmpeglibs/lib/libavformat.a",
        "ffmpeglibs/lib/libavformat.a",
        "ffmpeglibs/lib/libavutil.a",
        "ffmpeglibs/lib/libswresample.a",
        "ffmpeglibs/lib/libswscale.a",
        "onnxlibs/lib/libonnxruntime.a",
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")", 
        "ffmpeglibs/include", 
        "onnxlibs/include", 
      ],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "cflags": [
        "-fPIC",
        "-fexceptions"
      ],
      "cflags_cc": [
        "-fPIC",
        "-fexceptions"
      ],
      "libraries": [
        "${PWD}/ffmpeglibs/lib/libavcodec.a",
        "${PWD}/ffmpeglibs/lib/libavdevice.a",
        "${PWD}/ffmpeglibs/lib/libavfilter.a",
        "${PWD}/ffmpeglibs/lib/libavformat.a",
        "${PWD}/ffmpeglibs/lib/libavformat.a",
        "${PWD}/ffmpeglibs/lib/libavutil.a",
        "${PWD}/ffmpeglibs/lib/libswresample.a",
        "${PWD}/ffmpeglibs/lib/libswscale.a",
        "${PWD}/onnxlibs/lib/libonnxruntime.a",
        "-lm",
        "-lstdc++",
        "-lc",
      ],
      "xcode_settings": {
          "MACOSX_DEPLOYMENT_TARGET": "14",
          "OTHER_CFLAGS": ["-fexceptions"],
      }
    },
    {
    "target_name": "copy_binary",
    "type": "none",
    "dependencies": [ "video_reader" ],
    "copies": [
        {
          "destination": "resources",
          "files": [ "<(PRODUCT_DIR)/video_reader.node" ]
        }
      ]
    }
  ],
}

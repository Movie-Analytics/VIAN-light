{
  "targets": [
    {
      "target_name": "video_reader",
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
        "-fno-omit-frame-pointer",
        "-march=x86-64",
        "-mtune=generic"
      ],
      "conditions": [
        ["OS=='win'", {
          "msvs_settings": {
            "VCCLCompilerTool": {
              "ExceptionHandling": 1,
              "AdditionalOptions": [
                "/EHsc",
                "/MT"
              ],
              "RuntimeLibrary": 0
            },
            "VCLinkerTool": {
              "AdditionalOptions": [
                "/NODEFAULTLIB:MSVCRT",
                "/NODEFAULTLIB:MSVCRTD"
              ]
            }
          },
          "sources": [
            "video_reader/video_reader.cpp",
            "video_reader/video_reader.h",
            "video_reader/video_reader_wrapper.cpp",
            "video_reader/video_reader_wrapper.h",
            "video_reader/worker.cpp",
            "video_reader/worker.h",
          ],
          "libraries": [
            "<(module_root_dir)/onnxlibs/lib/onnxruntime.lib",
            "<(module_root_dir)/ffmpeglibs/lib/libavcodec.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavdevice.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavfilter.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavformat.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavutil.a",
            "<(module_root_dir)/ffmpeglibs/lib/libswresample.a",
            "<(module_root_dir)/ffmpeglibs/lib/libswscale.a",
            "libcmt.lib",
            "libvcruntime.lib",
            "libucrt.lib",
            "kernel32.lib",
            "Bcrypt.lib",
            "Secur32.lib",
            "ws2_32.lib",
            "Strmiids.lib",
            "User32.lib",
            "mfplat.lib",
            "mfuuid.lib",
            "mf.lib",
            "mfreadwrite.lib",
            "dxva2.lib"
          ],
          "defines": [
            "NAPI_DISABLE_CPP_EXCEPTIONS",
            "FF_API_NEXT_STRUCT_NAMES=0",
            "_HAS_EXCEPTIONS=1"
          ]
        }],
        ["OS!='win'", {
          "sources": [
            "video_reader/video_reader.cpp",
            "video_reader/video_reader.h",
            "video_reader/video_reader_wrapper.cpp",
            "video_reader/video_reader_wrapper.h",
            "video_reader/worker.cpp",
            "video_reader/worker.h",
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
          "libraries": [
            "<(module_root_dir)/ffmpeglibs/lib/libavcodec.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavdevice.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavfilter.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavformat.a",
            "<(module_root_dir)/ffmpeglibs/lib/libavutil.a",
            "<(module_root_dir)/ffmpeglibs/lib/libswresample.a",
            "<(module_root_dir)/ffmpeglibs/lib/libswscale.a",
            "<(module_root_dir)/onnxlibs/lib/libonnxruntime.a",
            "-lm",
            "-lstdc++",
            "-lc"
          ]
        }]
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

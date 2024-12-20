{
  "targets": [
    {
      "target_name": "video_reader",
      "sources": [
        "example.cpp",
        "example.h",
      ],
      'include_dirs': [
        "<!@(node -p \"require('node-addon-api').include\")", 
        "./ffmpeglibs", 
        "./ffmpeglibs/include", 
        "./onnxlibs2/include", 
        "./onnxlibs2"
      ],
      'dependencies': ["<!(node -p \"require('node-addon-api').gyp\")"],
      'cflags!': [ '-fno-exceptions' ],
      'cflags_cc!': [ '-fno-exceptions' ],
      'cflags': [
        '-fPIC',
        '-fvisibility=hidden',
      ],
      'cflags_cc': [
        '-fPIC',
        '-fvisibility=hidden',
      ],
      "libraries": [
        "-L${PWD}/ffmpeglibs/lib",
        "-Wl,-Bstatic",
        "-lavcodec",
        "-lavformat",
        "-lavutil",
        "-lswscale",
        "-L${PWD}/onnxlibs2/lib",
        "-Wl,-Bstatic",
        "-lonnxruntime",
        "-Wl,-Bdynamic",
        "-lm",
        "-lstdc++",
        '-lc',
      ],
    }
  ]
}

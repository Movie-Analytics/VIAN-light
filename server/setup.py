import pybind11
from pybind11.setup_helpers import Pybind11Extension
from setuptools import setup

ext_modules = [
    Pybind11Extension(
        'video_reader',
        ['../video_reader/video_reader.cpp',
         '../video_reader/python_wrapper.cpp',
         ],
        include_dirs=[
            pybind11.get_include(),
            '../onnxlibs/include',
            '../ffmpeglibs/include',
            '../video_reader'
        ],
        library_dirs=[
            '../onnxlibs/lib'
            '../ffmpeglibs/lib'
        ],
        extra_compile_args=['-std=c++14', '-fPIC'],
        extra_link_args=[
            '-L../ffmpeglibs/lib',
            '-Wl,-Bstatic,--start-group',
            '-lavutil',
            '-lavcodec',
            '-lavdevice',
            '-lavfilter',
            '-lavformat',
            '-lswresample',
            '-lswscale',
            '-Wl,--end-group',
            '-L../onnxlibs/lib',
            '-Wl,-Bstatic',
            '-lonnxruntime',
            '-Wl,-Bdynamic',
            '-ldrm',
            '-lm',
            '-lc',
            '-lz',
            '-llzma',
            '-lbz2',
            '-lstdc++',
        ],
        language='c++'
    ),
]

setup(
    name='video_reader',
    ext_modules=ext_modules,
    install_requires=['pybind11>=2.6.0'],
    setup_requires=['pybind11>=2.6.0'],
)

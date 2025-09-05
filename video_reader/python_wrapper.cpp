#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include <video_reader.h>

namespace py = pybind11;

PYBIND11_MODULE(video_reader, m) {
    m.doc() = "Python bindings for VideoReader class";

    py::class_<VideoReader>(m, "VideoReader")
        .def(py::init<const std::string&>(), py::arg("file_path"),
             "Initialize VideoReader with a video file path")

        .def("open", &VideoReader::Open,
             "Open the video file and initialize the decoder")

        .def("get_frame_rate", &VideoReader::getFrameRate,
             "Get the frame rate of the video")

        .def("is_done", &VideoReader::Done,
             "Check if we've reached the end of the video")

        .def("detect_shots", &VideoReader::DetectShots, py::arg("onnx_model_path"),
             "Detect shot boundaries in the video using the specified ONNX model")

        .def("generate_screenshots", &VideoReader::generateScreenshots,
             py::arg("directory"), py::arg("frame_stamps"),
             "Generate screenshots at specified frame timestamps")

        .def("generate_screenshot", &VideoReader::generateScreenshot,
             py::arg("directory"), py::arg("frame"),
             "Generate a screenshot at a specific frame number");
}

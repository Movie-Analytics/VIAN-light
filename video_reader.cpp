#include "video_reader.h"
using namespace std;

#include <iostream>
#include <iomanip>
#include <string>
#include <sstream>
#include <iomanip>
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>
#include <onnxruntime_cxx_api.h>
#include <vector>
#include <cmath>
#include <onnxruntime_cxx_api.h>


VideoReader::VideoReader(const std::string& file_path) : file_path(file_path) {
}

VideoReader::~VideoReader() {
    cout << "destructor" << endl;
    if (format_ctx) {
        avformat_close_input(&format_ctx);
    }
    if (codec_ctx) {
        avcodec_free_context(&codec_ctx);
    }
    if (frame) {
        av_frame_free(&frame);
    }
    if (file) {
      fclose(file);
    }
    if (parser) {
      av_parser_close(parser);
    }
  }


bool VideoReader::Open() {
    cout << "Open" << endl;
    if (avformat_open_input(&format_ctx, file_path.c_str(), nullptr, nullptr) < 0) {
        return false;
    }
    cout << "open2 " << endl;

    if (avformat_find_stream_info(format_ctx, nullptr) < 0) {
        return false;
    }

    for (uint32_t i = 0; i < format_ctx->nb_streams; i++) {
      fprintf(stderr, "open stream %i %d %d %d %d %d %d %d\n", i, format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_UNKNOWN,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_DATA,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_SUBTITLE,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_ATTACHMENT,
                                              format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_NB
                                               );
        if (format_ctx->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO) {
            fprintf(stderr, "inf if %d\n", 1);
            video_stream_index = i;
            break;
        }
    }
    fprintf(stderr, "afterwards %d\n", video_stream_index);

    if (video_stream_index == -1) {
        return false;
    }

    cout << "open 3" << endl;
    AVCodecParameters* codec_params = format_ctx->streams[video_stream_index]->codecpar;
    const AVCodec* codec = avcodec_find_decoder(codec_params->codec_id);
    if (!codec) {
        return false;
    }

    codec_ctx = avcodec_alloc_context3(codec);
    if (!codec_ctx) {
        return false;
    }

    cout << "open 5" << endl;
    if (avcodec_parameters_to_context(codec_ctx, codec_params) < 0) {
        return false;
    }

    if (avcodec_open2(codec_ctx, codec, nullptr) < 0) {
        return false;
    }

    parser = av_parser_init(codec->id);
    if (!parser) {
        return false;
    }
    cout << "open 6" << endl;

    frame = av_frame_alloc();
    if (!frame) {
      return false;
    }

    file = fopen(file_path.c_str(), "rb");
    if (!file) {
        return false;
    }
    return true;
  }

double VideoReader::getFrameRate() {
    return av_q2d(format_ctx->streams[video_stream_index]->r_frame_rate);
}

std::vector<uint8_t>& VideoReader::ReadNextFrame(std::vector<uint8_t>& out_frame_data) {
    AVPacket packet;
    int response;

    while (av_read_frame(format_ctx, &packet) >= 0) {
        if (packet.stream_index == video_stream_index) {
            response = avcodec_send_packet(codec_ctx, &packet);
            if (response < 0) {
                av_packet_unref(&packet);
                finished = true;
                return out_frame_data;
            }

            response = avcodec_receive_frame(codec_ctx, frame);
            if (response == AVERROR(EAGAIN) || response == AVERROR_EOF) {
                av_packet_unref(&packet);
                continue;
            } else if (response < 0) {
                av_packet_unref(&packet);
                finished = true;
                return out_frame_data;
            }
            fprintf(stderr, "frame num%" PRId64 "\n", codec_ctx->frame_num);

            // TODO get cache sws context?
            SwsContext* sws_ctx = sws_getContext(
                frame->width, frame->height, codec_ctx->pix_fmt,
                48, 27, AV_PIX_FMT_RGB24,
                SWS_BICUBIC, nullptr, nullptr, nullptr
            );

            AVFrame* frame2 = av_frame_alloc();
            int num_bytes = av_image_get_buffer_size(AV_PIX_FMT_RGB24, 48, 27, 1);
            uint8_t* frame2_buffer = (uint8_t*)av_malloc(num_bytes);

            av_image_fill_arrays(frame2->data, frame2->linesize, frame2_buffer, AV_PIX_FMT_RGB24, 48, 27, 1);
            sws_scale(sws_ctx, frame->data, frame->linesize, 0, frame->height, frame2->data, frame2->linesize);

            for (int y = 0; y < 27; ++y) {
                uint8_t* row_ptr = frame2->data[0] + y * frame2->linesize[0];
                out_frame_data.insert(out_frame_data.end(), row_ptr, row_ptr + (48 * 3)); // 48 pixels * 3 bytes (RGB)
            }

            av_free(frame2_buffer);
            av_frame_free(&frame2);
            sws_freeContext(sws_ctx);
            av_packet_unref(&packet);
            finished = false;
            return out_frame_data;
        }
        av_packet_unref(&packet);
    }

    finished = true;
    return out_frame_data;
}

bool VideoReader::Done() const {
    return finished;
}

std::vector<std::vector<int>> VideoReader::DetectShots(const std::string& onnx_model_path) {
    std::vector<std::vector<int>> shots;
    std::vector<float> allPredictions;

    finished = false;

    try {
        // ONNX Runtime setup
        Ort::Env env(ORT_LOGGING_LEVEL_WARNING, "shot_detection");
        Ort::SessionOptions session_options;
        session_options.SetIntraOpNumThreads(1);
        #ifdef _WIN32
            std::wstring wide_path(onnx_model_path.begin(), onnx_model_path.end());
            Ort::Session session(env, wide_path.c_str(), session_options);
        #else
            Ort::Session session(env, onnx_model_path.c_str(), session_options);
        #endif

        // Inference parameters
        const int inputWidth = 48;
        const int inputHeight = 27;
        const int inputChannels = 3;
        const int sequenceLength = 100;
        const int stepSize = 50;
        const int paddingStart = 25;

        // Sliding window management
        std::vector<std::vector<uint8_t>> frameWindow;
        unsigned long frameCounter = 1;

        // Initial padding setup
        std::vector<uint8_t> frameData;
        ReadNextFrame(frameData);
        for (int i = 0; i <= paddingStart; ++i) {
            frameWindow.push_back(frameData);
        }

        // Process video in chunks
        while (!Done()) {
            // Collect frames for the current window
            while(frameWindow.size() < sequenceLength && !Done()) {
                std::vector<uint8_t> frameData;
                ReadNextFrame(frameData);
                frameCounter++;
                if (!frameData.empty()) {
                    frameWindow.push_back(frameData);
                }
            }

            // Add end padding if we're at the end of the video
            while(frameWindow.size() < sequenceLength && Done()) {
                frameWindow.push_back(frameWindow.back());
            }

            // Process current window if large enough
            if (frameWindow.size() >= sequenceLength) {
                // Prepare input tensor
                std::vector<float> inputData;
                inputData.reserve(sequenceLength * inputWidth * inputHeight * inputChannels);

                for (size_t i = 0; i < sequenceLength; ++i) {
                    for (size_t j = 0; j < inputWidth * inputHeight * inputChannels; ++j) {
                        inputData.push_back(frameWindow[i][j]);
                    }
                }

                // Create ONNX tensor
                std::vector<int64_t> inputShape = {1, 100, 27, 48, 3};
                Ort::MemoryInfo memoryInfo = Ort::MemoryInfo::CreateCpu(
                    OrtArenaAllocator, OrtMemTypeDefault);
                Ort::Value inputTensor = Ort::Value::CreateTensor<float>(
                    memoryInfo, inputData.data(), inputData.size(), inputShape.data(), inputShape.size());

                // Prepare input feeds
                std::vector<const char*> inputNames = {"input"};
                std::vector<const char*> outputNames = {"534"};

                // Run inference
                auto outputTensors = session.Run(Ort::RunOptions{nullptr},
                                                inputNames.data(), &inputTensor, 1,
                                                outputNames.data(), 1);

                // Extract predictions (25 to 75 indices for the current window)
                float* rawResult = outputTensors[0].GetTensorMutableData<float>();
                std::vector<float> windowPredictions(rawResult + 25, rawResult + 75);

                // Append to overall predictions
                allPredictions.insert(allPredictions.end(),
                                    windowPredictions.begin(),
                                    windowPredictions.end());

                // Slide the window
                frameWindow.erase(frameWindow.begin(), frameWindow.begin() + stepSize);
            }
        }

        // Convert predictions to shot boundaries
        std::vector<int> binaryPredictions;
        for (size_t i=0; i <= frameCounter; i++) {
            binaryPredictions.push_back(allPredictions[i] > 0.5 ? 1 : 0);
        }

        // Find shot boundaries
        int start = 0;
        int prevState = 0;
        for (size_t i = 0; i < binaryPredictions.size(); ++i) {
            int currState = binaryPredictions[i];

            if (prevState == 1 && currState == 0) {
                start = i;
            }

            if (prevState == 0 && currState == 1 && i != 0) {
                shots.push_back({start, static_cast<int>(i)});
            }

            prevState = currState;
        }

        // Handle last shot if needed
        if (prevState == 0) {
            shots.push_back({start, static_cast<int>(binaryPredictions.size() - 1)});
        }

        // If no shots detected, return full video as a single shot
        if (shots.empty()) {
            shots.push_back({0, static_cast<int>(binaryPredictions.size() - 1)});
        }

    } catch (const Ort::Exception& exception) {
        std::cerr << "ONNX Runtime error: " << exception.what() << std::endl;
    }

    return shots;
}


int VideoReader::generateScreenshots(const std::string& directory, const std::vector<int>& frameStamps) {
    cout << "gen" << endl;
    AVPacket packet;
    int response;

    while (av_read_frame(format_ctx, &packet) >= 0) {
        if (packet.stream_index == video_stream_index) {
            response = avcodec_send_packet(codec_ctx, &packet);
            if (response < 0) {
                av_packet_unref(&packet);
                return -1;
            }

            response = avcodec_receive_frame(codec_ctx, frame);
            if (response == AVERROR(EAGAIN) || response == AVERROR_EOF) {
                av_packet_unref(&packet);
                continue;
            } else if (response < 0) {
                av_packet_unref(&packet);
                return -1;
            }

            if (std::find(frameStamps.begin(), frameStamps.end(), codec_ctx->frame_num -1) != frameStamps.end()) {
                fprintf(stderr, "frame num %" PRId64 "\n", codec_ctx->frame_num);
                std::ostringstream path;
                path << directory << '/' << std::setw(8) << std::setfill('0') << codec_ctx->frame_num-1 << ".jpg";

                if (saveFrameAsJpeg(codec_ctx->pix_fmt, frame, path.str()) < 0) {
                    av_packet_unref(&packet);
                    return -1;
                }

                // Generate a mini thumbnail
                AVPixelFormat scaled_pix_fmt = AV_PIX_FMT_YUV420P;
                SwsContext* sws_ctx = sws_getContext(
                    frame->width, frame->height, static_cast<AVPixelFormat>(frame->format),
                    48, 27, scaled_pix_fmt,
                    SWS_BICUBIC, nullptr, nullptr, nullptr
                );

                if (!sws_ctx) {
                    av_packet_unref(&packet);
                    return -1;
                }

                AVFrame* frame2 = av_frame_alloc();
                frame2->width = 48;
                frame2->height = 27;
                frame2->format = scaled_pix_fmt;
                int num_bytes = av_image_get_buffer_size(scaled_pix_fmt, 48, 27, 1);
                uint8_t* frame2_buffer = (uint8_t*)av_malloc(num_bytes);

                if (!frame2 || !frame2_buffer) {
                    av_free(frame2_buffer);
                    av_frame_free(&frame2);
                    sws_freeContext(sws_ctx);
                    av_packet_unref(&packet);
                    return -1;
                }

                av_image_fill_arrays(frame2->data, frame2->linesize, frame2_buffer, scaled_pix_fmt, 48, 27, 1);
                sws_scale(sws_ctx, frame->data, frame->linesize, 0, frame->height, frame2->data, frame2->linesize);
                frame2->color_range = AVCOL_RANGE_JPEG;

                std::ostringstream path_mini;
                path_mini << directory << '/' << std::setw(8) << std::setfill('0') << codec_ctx->frame_num-1 << "_mini.jpg";
                saveFrameAsJpeg(scaled_pix_fmt, frame2, path_mini.str());

                av_free(frame2_buffer);
                av_frame_free(&frame2);
                sws_freeContext(sws_ctx);
            }
            av_packet_unref(&packet);
        }
        av_packet_unref(&packet);
    }
    return 0;
}

int VideoReader::saveFrameAsJpeg(AVPixelFormat pix_fmt, AVFrame* pFrame, const std::string& path) {
    int ret;

    const AVCodec* jpegCodec = avcodec_find_encoder(AV_CODEC_ID_MJPEG);
    if (!jpegCodec) {
        return -1;
    }

    AVCodecContext* jpegContext = avcodec_alloc_context3(jpegCodec);
    if (!jpegContext) {
        return -1;
    }

    jpegContext->pix_fmt = pix_fmt;
    jpegContext->height = pFrame->height;
    jpegContext->width = pFrame->width;
    jpegContext->color_range = pFrame->color_range;
    jpegContext->time_base = AVRational{1, 25};
    jpegContext->strict_std_compliance = FF_COMPLIANCE_UNOFFICIAL;

    if ((ret = avcodec_open2(jpegContext, jpegCodec, nullptr)) < 0) {
        printf("ret %d\n", ret);
        avcodec_free_context(&jpegContext);
        return ret;
    }

    AVPacket* packet = av_packet_alloc();
    if (!packet) {
        avcodec_free_context(&jpegContext);
        return -1;
    }

    if ((ret = avcodec_send_frame(jpegContext, pFrame)) < 0) {
        avcodec_free_context(&jpegContext);
        return ret;
    }

    if ((ret = avcodec_receive_packet(jpegContext, packet)) < 0) {
        av_packet_unref(packet);
        avcodec_free_context(&jpegContext);
        return ret;
    }

    FILE* file = fopen(path.c_str(), "wb");
    if (!file) {
        av_packet_unref(packet);
        avcodec_free_context(&jpegContext);
        return -1;
    }

    fwrite(packet->data, 1, packet->size, file);
    fclose(file);

    av_packet_unref(packet);
    avcodec_free_context(&jpegContext);

    return 0;
}

Napi::Value VideoReaderWrapper::GenerateScreenshots(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 2 || !info[0].IsString() || !info[1].IsArray()) {
        Napi::TypeError::New(env, "Directory path and frame stamps array are required").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string directory = info[0].As<Napi::String>();
    Napi::Array frameStampsArray = info[1].As<Napi::Array>();

    std::vector<int> frameStamps;
    for (size_t i = 0; i < frameStampsArray.Length(); ++i) {
        Napi::Value elem = frameStampsArray[i];

        if (!elem.IsNumber()) {
            Napi::TypeError::New(env, "Frame stamp must be an array of integers").ThrowAsJavaScriptException();
            return env.Null();
        }

        frameStamps.push_back(elem.As<Napi::Number>());
    }

    int result = videoReader.generateScreenshots(directory, frameStamps);
    cout << "wrap2" << endl;
    if (result < 0) {
        Napi::Error::New(env, "Failed to generate screenshots").ThrowAsJavaScriptException();
        return env.Null();
    }

    return Napi::Boolean::New(env, true);
}


Napi::Value VideoReaderWrapper::DetectShots(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();


    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "ONNX model path is required").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string onnxModelPath = info[0].As<Napi::String>();
    std::vector<std::vector<int>> shots = videoReader.DetectShots(onnxModelPath);

    // Convert shots to JS array
    Napi::Array shotsArray = Napi::Array::New(env, shots.size());
    for (size_t i = 0; i < shots.size(); ++i) {
        Napi::Array shotArray = Napi::Array::New(env, 2);
        shotArray.Set(0u, Napi::Number::New(env, shots[i][0]));
        shotArray.Set(1u, Napi::Number::New(env, shots[i][1]));
        shotsArray.Set(i, shotArray);
    }

    return shotsArray;
}


Napi::FunctionReference* VideoReaderWrapper::constructor = nullptr;

Napi::Object VideoReaderWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoReader", {
        InstanceMethod<&VideoReaderWrapper::Open>("open"),
        InstanceMethod<&VideoReaderWrapper::GetFrameRate>("getFrameRate"),
        InstanceMethod<&VideoReaderWrapper::ReadNextFrame>("readNextFrame"),
        InstanceMethod<&VideoReaderWrapper::DetectShots>("detectShots"),
        InstanceMethod<&VideoReaderWrapper::GenerateScreenshots>("generateScreenshots"),
        InstanceMethod<&VideoReaderWrapper::Done>("done"),
    });
    cout << "Wrapper init" << endl;

    constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    exports.Set("VideoReader", func);
    env.SetInstanceData<Napi::FunctionReference>(constructor);
    return exports;
}

VideoReaderWrapper::VideoReaderWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoReaderWrapper>(info),      videoReader(info[0].As<Napi::String>()), // Initialize VideoReader here
    finished(false) {
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(info.Env(), "File path is required").ThrowAsJavaScriptException();
    }

    std::string filePath = info[0].As<Napi::String>();
    videoReader = VideoReader(filePath);
}

Napi::Value VideoReaderWrapper::Open(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    bool success = videoReader.Open();
    return Napi::Boolean::New(env, success);
}
Napi::Value VideoReaderWrapper::GetFrameRate(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    double fps = videoReader.getFrameRate();
    return Napi::Number::New(env, fps);
}

Napi::Value VideoReaderWrapper::ReadNextFrame(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::vector<uint8_t> frameData;
    frameData = videoReader.ReadNextFrame(frameData);

    if (frameData.empty()) {
        return env.Null();
    }

    // Create a Node.js ArrayBuffer
    Napi::ArrayBuffer buffer = Napi::ArrayBuffer::New(env, frameData.size());
    std::memcpy(buffer.Data(), frameData.data(), frameData.size());

    // Wrap the ArrayBuffer into a Uint8Array
    return Napi::TypedArrayOf<uint8_t>::New(env, frameData.size(), buffer, 0);
}

Napi::Value VideoReaderWrapper::Done(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    return Napi::Boolean::New(env, videoReader.Done());
}

// Initialize native add-on
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    VideoReaderWrapper::Init(env, exports);
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)

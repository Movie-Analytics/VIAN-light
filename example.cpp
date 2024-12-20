#include "example.h"
using namespace std;

#include <iostream>
#include <string>
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>

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

    for (uint i = 0; i < format_ctx->nb_streams; i++) {
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
                fprintf(stderr, "frame num %ld\n", codec_ctx->frame_num);

                SwsContext* sws_ctx = sws_getContext(
                    frame->width, frame->height, codec_ctx->pix_fmt,
                    48, 27, AV_PIX_FMT_RGB24,
                    SWS_BICUBIC, nullptr, nullptr, nullptr
                );

                uint8_t* rgb_data = (uint8_t*)malloc(frame->width * frame->height * 3);
                uint8_t* dest[1] = {rgb_data};
                int linesize[1] = {frame->width * 3};

                sws_scale(sws_ctx, frame->data, frame->linesize, 0, frame->height, dest, linesize);


                out_frame_data.insert(out_frame_data.end(), rgb_data, rgb_data + 48 * 27 * 3);

                free(rgb_data);
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


void VideoReader::testonnxloading() {
    try {
        Ort::Env env(ORT_LOGGING_LEVEL_WARNING, "test");

        Ort::SessionOptions session_options;
        session_options.SetIntraOpNumThreads(1);

        const char* model_path = "test.onnx";
        Ort::Session session(env, model_path, session_options);

        std::cout << "Model loaded successfully: " << model_path << std::endl;
    } catch (const Ort::Exception& exception) {
        std::cerr << "Error while loading the model: " << exception.what() << std::endl;
        return -1;
    }

  return 0;
}


Napi::FunctionReference* VideoReaderWrapper::constructor = nullptr;

Napi::Object VideoReaderWrapper::Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = DefineClass(env, "VideoReader", {
        InstanceMethod<&VideoReaderWrapper::Open>("open"),
        InstanceMethod<&VideoReaderWrapper::GetFrameRate>("getFrameRate"),
        InstanceMethod<&VideoReaderWrapper::ReadNextFrame>("readNextFrame"),
        InstanceMethod<&VideoReaderWrapper::Done>("done"),
    });
    cout << "init 1" << endl;

    constructor = new Napi::FunctionReference();
    *constructor = Napi::Persistent(func);
    cout << "init 2" << endl;
    exports.Set("VideoReader", func);
    cout << "init 3" << endl;
    env.SetInstanceData<Napi::FunctionReference>(constructor);
    cout << "init 4" << endl;
    return exports;
}

VideoReaderWrapper::VideoReaderWrapper(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<VideoReaderWrapper>(info),      videoReader(info[0].As<Napi::String>()), // Initialize VideoReader here
    finished(false) {
        cout << "wrap 1" << endl;
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(info.Env(), "File path is required").ThrowAsJavaScriptException();
    }
    cout << "wrap 2" << endl;

    std::string filePath = info[0].As<Napi::String>();
    cout << "wrap 3" << endl;
    videoReader = VideoReader(filePath);
    cout << "wrap 4" << endl;
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

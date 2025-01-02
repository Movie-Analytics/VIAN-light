#ifndef VIDEO_READER_H
#define VIDEO_READER_H

#include <napi.h>
#include <string>
#include <vector>

// FFmpeg Headers
extern "C" {
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libswscale/swscale.h>
#include <libavutil/imgutils.h>
}

class VideoReader {
public:
    explicit VideoReader(const std::string& file_path);
    ~VideoReader();

    bool Open();
    double getFrameRate();
    std::vector<uint8_t>& ReadNextFrame(std::vector<uint8_t>& out_frame_data);
    bool Done() const;
    std::vector<std::vector<int>> DetectShots(const std::string& onnx_model_path);
    int saveFrameAsJpeg(AVPixelFormat pix_fmt, AVFrame* pFrame, const std::string& path);
    int generateScreenshots(const std::string& directory, const std::vector<int>& frameStamps);

private:
    std::string file_path;
    AVFormatContext* format_ctx = nullptr;
    AVCodecContext* codec_ctx = nullptr;
    AVCodecParserContext *parser = nullptr;
    AVFrame* frame = nullptr;
    int video_stream_index = -1;
    bool finished = false;
    FILE *file = nullptr;
};

class VideoReaderWrapper : public Napi::ObjectWrap<VideoReaderWrapper> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports); // Initialize Node.js bindings
    VideoReaderWrapper(const Napi::CallbackInfo& info);

private:
    static Napi::FunctionReference* constructor;

    VideoReader videoReader;
    bool finished = false;

    Napi::Value Open(const Napi::CallbackInfo& info);
    Napi::Value GetFrameRate(const Napi::CallbackInfo& info);
    Napi::Value ReadNextFrame(const Napi::CallbackInfo& info);
    Napi::Value Done(const Napi::CallbackInfo& info);
    Napi::Value DetectShots(const Napi::CallbackInfo& info);
    Napi::Value GenerateScreenshots(const Napi::CallbackInfo& info);
};

#endif

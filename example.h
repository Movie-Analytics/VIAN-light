#ifndef VIDEO_READER_H
#define VIDEO_READER_H

#include <napi.h> // Include for Node.js Addon API
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
    VideoReaderWrapper(const Napi::CallbackInfo& info);            // Constructor

private:
    static Napi::FunctionReference* constructor;

    VideoReader videoReader; // Instance of VideoReader
    bool finished = false;

    // Node.js exposed methods
    Napi::Value Open(const Napi::CallbackInfo& info);
    Napi::Value GetFrameRate(const Napi::CallbackInfo& info);
    Napi::Value ReadNextFrame(const Napi::CallbackInfo& info);
    Napi::Value Done(const Napi::CallbackInfo& info);
};

#endif // VIDEO_READER_H

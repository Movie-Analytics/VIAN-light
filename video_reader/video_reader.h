#ifndef VIDEO_READER_H
#define VIDEO_READER_H

#include <string>
#include <vector>
#include <atomic>

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

    std::vector<std::vector<int>> DetectShots(const std::string& onnx_model_path);
    bool Done() const;
    int generateScreenshots(const std::string& directory, const std::vector<int>& frameStamps);
    int generateScreenshot(const std::string& directory, int frame);
    double getFrameRate();
    bool Open();
    static void setCancelled(bool value);
    static bool isCancelled();
    void cleanup();

private:
    std::string file_path;
    AVFormatContext* format_ctx = nullptr;
    AVCodecContext* codec_ctx = nullptr;
    AVCodecParserContext *parser = nullptr;
    AVFrame* frame = nullptr;
    int video_stream_index = -1;
    bool finished = false;
    FILE *file = nullptr;
    static std::atomic<bool> cancelled;

    std::vector<uint8_t>& ReadNextFrame(std::vector<uint8_t>& out_frame_data);
    int saveFrameAsJpeg(AVPixelFormat pix_fmt, AVFrame* pFrame, const std::string& path);
    int saveFrame(const std::string& directory, int frame);
    static void signalHandler(int signum);
};

#endif

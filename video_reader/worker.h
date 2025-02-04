#ifndef WORKER_H
#define WORKER_H

#include <napi.h>
#include <any>
#include "video_reader.h"


using WorkerFunction = std::function<void(VideoReader*, std::any&)>;
using ResultHandler = std::function<Napi::Value(Napi::Env, const std::any&)>;


class Worker : public Napi::AsyncWorker {
public:
    Worker(Napi::Function& callback, 
           VideoReader* videoReader,
           WorkerFunction execFunc,
           ResultHandler resultFunc);
    ~Worker();
    void Cancel();

protected:
    void Execute() override;
    void OnOK() override;
    void OnError(const Napi::Error& error) override;

private:
    VideoReader* videoReader;
    WorkerFunction execFunction;
    ResultHandler resultHandler;
    std::any result;
};

#endif

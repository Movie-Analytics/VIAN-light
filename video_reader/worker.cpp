#include "worker.h"


Worker::Worker(Napi::Function& callback, 
               VideoReader* videoReader,
               WorkerFunction execFunc,
               ResultHandler resultFunc)
    : Napi::AsyncWorker(callback),
      videoReader(videoReader),
      execFunction(std::move(execFunc)),
      resultHandler(std::move(resultFunc)) {}

Worker::~Worker() {}

void Worker::Cancel() {
    if (videoReader) {
        videoReader->setCancelled(true);
    }
}

void Worker::Execute() {
    try {
        printf("execute");
        execFunction(videoReader, result);
        if (videoReader->isCancelled()) {
            SetError("Operation cancelled");
        }
    } catch (const std::exception& e) {
        printf("exception");
        SetError(e.what());
    }
}

void Worker::OnOK() {
    printf("ok");
    Napi::HandleScope scope(Env());
    Napi::Value jsResult = resultHandler(Env(), result);
    printf("callback");
    Callback().Call({Env().Null(), jsResult});
}

void Worker::OnError(const Napi::Error& error) {
    Callback().Call({error.Value(), Env().Undefined()});
}

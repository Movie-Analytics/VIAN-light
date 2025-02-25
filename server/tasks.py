import logging
import uuid
from zipfile import ZIP_DEFLATED, ZipFile

import video_reader
from celery import Celery, Task

import config
import database as db

logger = logging.getLogger(__name__)

celery_app = Celery(
    __name__,
    broker=config.REDIS_URL,
    backend=config.REDIS_URL
)


@celery_app.task(name='video info')
def get_video_info(video: str, job: int) -> dict|None:
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        video = video_reader.VideoReader(video)
        video.open()
        fps = video.get_frame_rate()

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, {'fps': fps})
        return {'fps': fps}
    except Exception:
        logger.exception('Exception during video info')
        db.update_job(next(db.get_session()), job, status='FAILED')
        raise


@celery_app.task(name='shotboundary detection', bind=True)
def shotboundary_detection(self: Task, video: str, job: int) -> list|None:
    logger.info('Starting shotboundary detection')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)
        reader.open()
        shots = reader.detect_shots(config.ONNXMODEL)

        if self.AsyncResult(self.request.id).state == 'REVOKED':
            db.update_job(session, job, status='CANCELED')
            return None

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, shots)
        return shots
    except Exception:
        logger.exception('Exception during shotboundary detection')
        db.update_job(next(db.get_session()), job, status='FAILED')
        raise


@celery_app.task(name='screenshots generation', bind=True)
def screenshots_generation(
    self: Task,
    video: str,
    directory: str,
    frames: list[int],
    job: int
) -> list|None:
    logger.info('Starting screenshots generation')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)
        reader.open()
        success = reader.generate_screenshots(str(config.DATA_DIR / directory), frames)

        if success != 0:
            db.update_job(session, job, status='FAILED')
            return None

        if self.AsyncResult(self.request.id).state == 'REVOKED':
            db.update_job(session, job, status='CANCELED')
            return None

        screenshots = [
            {
                'frame': frame,
                'thumbnail': (f'{config.API_PREFIX}{directory}/'
                              f'{str(frame).zfill(8)}_mini.jpg'),
                'image': f'{config.API_PREFIX}{directory}/{str(frame).zfill(8)}.jpg'
            }
            for frame in frames
        ]
        db.update_job(session, job, status='DONE')
        db.create_result(session, job, screenshots)
        return screenshots
    except Exception:
        logger.exception('Exception during screenshots generation')
        db.update_job(next(db.get_session()), job, status='FAILED')
        raise


@celery_app.task(name='screenshot generation')
def screenshot_generation(
    video: str,
    directory: str,
    frame: int,
    job: int
) -> dict|None:
    logger.info('Starting screenshot generation')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)
        reader.open()
        success = reader.generate_screenshot(str(config.DATA_DIR / directory), frame)
        if success != 0:
            db.update_job(session, job, status='FAILED')
            return None

        screenshot = {
            'frame': frame,
            'thumbnail': (f'{config.API_PREFIX}{directory}/'
                          f'{str(frame).zfill(8)}_mini.jpg'),
            'image': f'{config.API_PREFIX}{directory}/{str(frame).zfill(8)}.jpg'
        }

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, screenshot)
        return screenshot
    except Exception:
        db.update_job(next(db.get_session()), job, status='FAILED')
        logger.exception('Exception during screenshot generation')
        raise


@celery_app.task(name='export screenshot')
def export_screenshots(
    timelines: list[dict],
    frames: list[int]|None,
    projectid: str, job: int
) -> str|None:
    logger.info('Starting screenshots export')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')
        zip_path = config.EXPORT_DIR / f'screenshots-{uuid.uuid4()}.zip'
        with ZipFile(config.DATA_DIR / zip_path, 'w', ZIP_DEFLATED) as zipf:
            for timeline in timelines:
                if not timeline['type'].startswith('screenshots'):
                    continue

                timeline_frames = [
                    f['image'].split('/')[-1]
                    for f in timeline['data']
                    if frames is None or f['frame'] in frames
                ]
                t_path = timeline['name'] + ' - ' + timeline['id']
                if len(timeline_frames):
                    zipf.mkdir(t_path)

                frame_dir = config.DATA_DIR / config.SCREENSHOT_UPLOAD_DIR / projectid
                for frame in timeline_frames:
                    zipf.write(frame_dir / frame, t_path + '/' + frame)
        zip_path = config.API_PREFIX + str(zip_path)
        db.update_job(session, job, status='DONE')
        db.create_result(session, job, zip_path)
        return zip_path
    except Exception:
        db.update_job(next(db.get_session()), job, status='FAILED')
        logger.exception('Exception during screenshot export')
        raise
